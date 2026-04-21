# Cookie Clicker — Design

**Date:** 2026-04-21
**Branch:** `feature/cookie-clicker`
**Status:** Approved for planning

## Summary

Make the existing `CookieClicker` component functional: clicks increment the logged-in user's `User.balance` in the database without a DB call per click, a 10-clicks-per-second cap prevents abuse, and logged-out users accumulate points locally with a prompt to log in to save them.

Click value is **1 point per click** (down from the current placeholder `10`).

## Goals

- Clicks translate into real, spendable balance for authenticated users.
- No DB write per click — writes are batched.
- Server is the source of truth for the 10/sec rate cap (client throttle is UX only).
- Guest clicks accumulate locally and migrate into balance on login.

## Non-goals (YAGNI)

- Per-IP rate limiting, CAPTCHA, auto-click heuristics beyond the 10/sec cap.
- A separate "click-earned" balance distinct from purchase-spent balance.
- Leaderboards, upgrades, click multipliers, achievements.
- Admin UI for inspecting or resetting click balances.

## Architecture

### Data flow

```
click → client throttle (≤10/sec) → pending++ (in hook state)
  │
  │   flush triggers: 5s interval, pending ≥ 50, page-hide, auth change
  ▼
POST /me/clicks { delta, elapsedMs }
  │
  ▼
server: cap at rate, FOR UPDATE lock, balance += credited, lastClickFlushAt = now
  │
  ▼
response { balance, credited } → client displays authoritative balance
```

### New pieces

- **Backend**
  - One new endpoint: `POST /me/clicks` (mounted under `/me`, auth required).
  - One new column on `User`: `lastClickFlushAt` — nullable `DateTime @db.Timestamptz(6)`, maps to `last_click_flush_at`.
- **Frontend**
  - New hook `frontend/src/hooks/useCookieClicker.js` owning pending state, throttle, flush, and guest localStorage.
  - `CookieClicker.jsx` refactored to consume the hook; keeps the floating-`+N` animation but with `+1` per click.
- **Storage**
  - `localStorage` key `bb:guestClicks` — shape `{ pending: number, firstClickAt: number }` (wall-clock ms).

## Backend contract

### `POST /me/clicks`

Mounted under `/me` → `requireAuth` already applies. No admin gate.

**Request body**

```json
{ "delta": 42, "elapsedMs": 5000 }
```

- `delta` — positive integer, ≤ `MAX_DELTA` (100_000). Rejects garbage without consuming balance budget.
- `elapsedMs` — positive integer representing the client's flush window duration.

**Validation**

- 400 if either field is missing, non-integer, ≤ 0, or exceeds `MAX_DELTA`/`MAX_ELAPSED_MS`.
- 401 from `requireAuth` if no valid bearer token.

**Constants**

| Name                  | Value       | Purpose                                              |
|-----------------------|-------------|------------------------------------------------------|
| `RATE_PER_SEC`        | 10          | Max sustained clicks per second                       |
| `BURST_BONUS`         | 20          | One-time burst allowance added to maxAllowed          |
| `MAX_FIRST_WINDOW_MS` | 3_600_000   | Cap on elapsed window when `lastClickFlushAt` is null |
| `MAX_DELTA`           | 100_000     | Hard cap on a single request's delta                  |
| `MAX_ELAPSED_MS`      | 86_400_000  | 24h — hard cap on `elapsedMs` in a single request     |

**Rate-enforcement math**

```
clientElapsed = body.elapsedMs

if (user.lastClickFlushAt == null):
  serverElapsed = min(clientElapsed, MAX_FIRST_WINDOW_MS)
else:
  serverElapsed = now - user.lastClickFlushAt

effectiveElapsed = min(clientElapsed, serverElapsed)

maxAllowed = floor(effectiveElapsed / 1000) * RATE_PER_SEC + BURST_BONUS
credited   = min(delta, maxAllowed)        // silent cap
```

**Transaction**

Mirrors the `FOR UPDATE` lock pattern used in `createOrder` so concurrent flushes serialize:

```
BEGIN;
  SELECT id, balance, last_click_flush_at FROM users WHERE id = $userId FOR UPDATE;
  -- compute credited per math above
  UPDATE users
     SET balance = balance + $credited,
         last_click_flush_at = now()
   WHERE id = $userId;
COMMIT;
```

**Response** (`200`)

```json
{ "balance": 1234, "credited": 40 }
```

- `balance` — authoritative post-update user balance.
- `credited` — how many points were actually added. Client may compare to `delta` if it wants, but the spec'd behavior is to cap silently and just display the new balance.

### Prisma schema change

```prisma
model User {
  // ... existing fields
  lastClickFlushAt DateTime? @map("last_click_flush_at") @db.Timestamptz(6)
}
```

Migration adds a nullable column; no backfill required.

## Frontend: `useCookieClicker` hook

**Location:** `frontend/src/hooks/useCookieClicker.js`

**Dependencies from `useAuth()`**

- `profile?.balance` — authoritative balance, already fetched and kept fresh by `AuthProvider`.
- `authedFetch(path, init)` — wrapped fetch that injects the bearer token.
- `refreshProfile()` — re-fetches `/me` and updates `profile`, so the rest of the app (cart, checkout) sees new balances.
- `session?.access_token` — used only to detect auth transitions; the token itself is already in `authedFetch`.

**State / refs**

- `pendingRef` — number; unflushed clicks.
- `windowStartRef` — `performance.now()` timestamp of the first click in the current flush window (used to compute `elapsedMs`). `null` when `pending === 0`.
- `clickTimesRef` — rolling array of `performance.now()` values for the 10/sec client throttle.
- `tokenRef` — mirrors `session?.access_token`; retained so a logout-triggered flush can use the previous (still-valid) token even after context updates to null.
- `pendingTick` (useState, number) — incremented on each pending change to trigger re-renders for `displayPoints`.
- `displayPoints` (derived) — for authenticated users: `(profile?.balance ?? 0) + pendingRef`. For guests: `pendingRef`.

**Public API**

```js
const { displayPoints, handleClick, isAuthenticated } = useCookieClicker()
```

**`handleClick()`**

1. Prune `clickTimesRef` to entries within the last 1000ms.
2. If `clickTimesRef.length >= 10`, drop the click (no visual, no increment).
3. Push `performance.now()` onto `clickTimesRef`.
4. If `pendingRef === 0`, set `windowStartRef = performance.now()`.
5. `pendingRef++`; trigger a re-render for `displayPoints`.
6. If `pendingRef >= 50`, call `flush()` immediately.

**`flush()`**

- No-op if `pendingRef === 0`.
- **Guest:** no-op (guest data persists in localStorage; migrates on login).
- **Authenticated:**
  - Snapshot `delta = pendingRef`, `elapsedMs = performance.now() - windowStartRef`.
  - Reset `pendingRef = 0`, `windowStartRef = null` **before** the network call (new clicks during flight accumulate into a new window).
  - `authedFetch('/me/clicks', { method: 'POST', body: JSON.stringify({ delta, elapsedMs }), keepalive: true })`.
  - On 2xx: call `refreshProfile()` so `profile.balance` is re-synced across the app. The response's `balance` field is authoritative but we use `refreshProfile()` to keep a single source of truth.
  - On network error or 5xx: log and move on. Do not re-add to pending — next 5s tick will send a fresh flush.
  - On 401: log and stop flushing. Auth context will handle re-login on its own. Up to ~5s of clicks are lost.

**Logout flush** — auth transition `true → false` is observed via `session?.access_token` in a `useEffect`. On that transition, if `pendingRef > 0`, fire a flush using `tokenRef.current` (the pre-transition token captured before the effect re-ran) via a raw `fetch` with `keepalive: true`. This avoids the race where `authedFetch` now throws because the context's token is already null.

**Flush triggers**

| Trigger                   | Wiring                                                        |
|---------------------------|---------------------------------------------------------------|
| Every 5s                  | `setInterval(flush, 5000)` in a `useEffect` gated on auth      |
| pending ≥ 50              | Inline call from `handleClick`                                |
| Page-hide                 | `visibilitychange` + `pagehide` listeners → `flush()` using `fetch(..., { keepalive: true })` |
| Logout                    | `useEffect` on auth change: flush before token becomes invalid |
| Login (guest migration)   | See below                                                     |

`fetch keepalive` is used instead of `navigator.sendBeacon` so the bearer token can ride in the `Authorization` header.

**Guest mode**

- `pendingRef` and `windowStartAt` (wall-clock ms) are mirrored to `localStorage.bb:guestClicks` debounced ~500ms to avoid thrash.
- Hint rendered in `CookieClicker.jsx`: *"Log in to save your points."* Styled subtly, hidden when `isAuthenticated`.
- Access to `localStorage` is wrapped in try/catch. If unavailable (Safari private mode), fall back to in-memory only; guest progress then lasts only the session.

**Guest → authenticated migration**

On auth transition `false → true` (observed via `session?.access_token` in a `useEffect`):

1. Read `localStorage.bb:guestClicks`. If absent or `pending === 0`, done.
2. Call `authedFetch('/me/clicks', ...)` with:
   - `delta = guest.pending`
   - `elapsedMs = Date.now() - guest.firstClickAt` (wall clock — `performance.now()` resets per page load and can't span the unauthenticated→authenticated page lifecycle).
3. On 2xx: delete `localStorage.bb:guestClicks` and call `refreshProfile()`. Server caps via `MAX_FIRST_WINDOW_MS` if `lastClickFlushAt` is null on the target account.
4. On failure: leave localStorage; retried on the next 5s flush tick.

**Balance source** — `displayPoints` reads `profile?.balance` directly from `useAuth()`. `AuthProvider` already fetches `/me` on session change and exposes `refreshProfile()`. The hook does not fetch `/me` itself.

## Error handling & edge cases

- **Network failure during flush** → drop; do not re-increment pending (avoids double-credit on retry). Acceptable loss ≤ ~5s of clicks.
- **Server caps delta** → client shows authoritative `balance`; displayed number may dip relative to optimistic `balance + pending`. Honest users won't hit the cap in practice.
- **Page-hide flush fails silently** → at most a few seconds lost; `keepalive` has no retry.
- **Multi-tab** — each tab has independent `pending` and client throttle. Server serializes via row lock; one tab's flush may cap if another just ran. Not broken; slightly suboptimal.
- **Clock skew** — intra-session timing uses `performance.now()` (monotonic). Guest `firstClickAt` uses `Date.now()`; skew risk bounded by `MAX_FIRST_WINDOW_MS`.
- **Long guest session** — server-side `MAX_FIRST_WINDOW_MS = 1h` caps the first-flush window to ~36_020 credits max.
- **DevTools click spam** — server cap is the backstop; client throttle is UX only.
- **Floating animation** — update existing `+10` text to `+1`.

## Testing

### Backend (`node:test`, matches existing `backend/tests/*.test.js` pattern)

- `POST /me/clicks` happy path: `delta=5, elapsedMs=1000` with fresh account → `credited=5`, balance += 5, `lastClickFlushAt` set.
- Rate cap: `delta=5000, elapsedMs=100` → `credited` equals the burst-plus-rate formula, balance increments only by that amount, response returns the capped `credited`.
- First-flush null `lastClickFlushAt`: huge client `elapsedMs` is clamped by `MAX_FIRST_WINDOW_MS`.
- Second flush after first: `serverElapsed = now - lastClickFlushAt`, uses the smaller of client/server.
- Invalid input: negative delta, zero delta, non-integer, missing field, delta > `MAX_DELTA`, elapsedMs > `MAX_ELAPSED_MS` → 400.
- Unauthenticated: smoke test that `requireAuth` rejects (one test; behavior already covered by middleware elsewhere).
- Concurrency: two flushes for the same user serialize via the row lock and neither is lost (mirror the style of existing order-controller concurrency tests).

### Frontend

No test framework in `frontend/`. Manual QA checklist:

- Single tab, authenticated: click 20 times, wait 5s, balance in `/me` increments by 20.
- Click-through: click rapidly for 10s, confirm no more than ~100 credits + burst land server-side.
- Multi-tab: click in two tabs concurrently; sum of credits across tabs respects cap; no crashes.
- Logout mid-session: pending flushes before token invalidates (check network tab).
- Guest mode: click 50 times, reload, counter persists; log in, balance increments by ~50 (subject to first-window cap).
- Safari private mode: guest clicks work in-memory, lose on reload without throwing.
- Page close with pending: `fetch keepalive` request observed in network tab.

## Open questions

None at time of writing. Any ambiguity discovered during implementation should be resolved by updating this spec rather than guessing.

## Out of scope

- Leaderboards / social features.
- Click upgrades (auto-clicker, click multipliers).
- Anti-cheat beyond the server-side rate cap.
- Separating earned-balance from spent-balance.
- Admin tooling for click balances.
