# Cookie Clicker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `CookieClicker` functional — clicks increment the logged-in user's `User.balance` without a DB call per click, a server-enforced 10/sec rate cap prevents abuse, and guests accumulate locally with migration on login.

**Architecture:** Clicks accumulate in a React hook's ref. A flush triggered by a 5-second interval, a 50-click threshold, page-hide, or logout sends `POST /me/clicks { delta, elapsedMs }`. The server caps the delta using a token-bucket-style formula against `User.lastClickFlushAt`, credits the balance inside a `FOR UPDATE` transaction, and returns the new balance. Guest clicks are mirrored to `localStorage` and migrated on the first successful authenticated flush.

**Tech Stack:** Prisma (Postgres), Express, React 19, Tailwind v4, Supabase Auth, `node:test` for backend tests. No frontend test framework.

**Important execution notes:**

- **Do not create commits.** The user will commit manually after the plan is complete.
- **Scope is cookie-clicker only.** Do not refactor or touch adjacent files beyond what this plan specifies, even if they look related.
- **Base spec:** `docs/superpowers/specs/2026-04-21-cookie-clicker-design.md` — consult for rationale on any unclear decision.

---

## File Structure

### Backend (create/modify)

| Path                                                                        | Status           | Responsibility                                                                   |
| --------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------- |
| `backend/prisma/schema.prisma`                                              | modify           | Add `lastClickFlushAt` to `User`                                                 |
| `backend/prisma/migrations/<ts>_add_user_last_click_flush_at/migration.sql` | create (via CLI) | Adds the column                                                                  |
| `backend/lib/clickCredit.js`                                                | create           | Pure `computeCredit` function — rate-cap math, no I/O                            |
| `backend/services/clickService.js`                                          | create           | `creditClicks` — wraps `computeCredit` in a Prisma transaction with `FOR UPDATE` |
| `backend/controllers/meController.js`                                       | modify           | Add `flushClicks` controller                                                     |
| `backend/routes/meRoutes.js`                                                | modify           | Mount `POST /clicks`                                                             |
| `backend/tests/clickCredit.test.js`                                         | create           | Unit tests for `computeCredit` (matches project's pure-function test convention) |

### Frontend (create/modify)

| Path                                        | Status | Responsibility                                                                 |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `frontend/src/hooks/useCookieClicker.js`    | create | All pending state, client throttle, flush, guest localStorage, login migration |
| `frontend/src/components/CookieClicker.jsx` | modify | Consume hook; show "Log in to save" hint for guests; change `+10` to `+1`      |

### Not touched

- `frontend/src/auth/AuthProvider.jsx` — reuse `profile`, `authedFetch`, `refreshProfile` as-is.
- `frontend/src/App.jsx`, `frontend/src/App.css` (deleted), `frontend/src/lib/styles.js` — unchanged.
- Any other components from the in-progress Tailwind refactor.

---

## Task 1: Add `lastClickFlushAt` column to `User`

**Files:**

- Modify: `backend/prisma/schema.prisma`
- Create (via CLI): `backend/prisma/migrations/<timestamp>_add_user_last_click_flush_at/migration.sql`

- [ ] **Step 1: Add field to Prisma schema**

In `backend/prisma/schema.prisma`, inside `model User { ... }`, add after `updatedAt`:

```prisma
  lastClickFlushAt DateTime? @map("last_click_flush_at") @db.Timestamptz(6)
```

Resulting `User` block (for reference — existing fields shown for placement):

```prisma
model User {
  id               String    @id @db.Uuid
  balance          Int       @default(0)
  role             UserRole  @default(customer)
  displayName      String?   @map("display_name")
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime  @default(now()) @map("updated_at") @db.Timestamptz(6)
  lastClickFlushAt DateTime? @map("last_click_flush_at") @db.Timestamptz(6)

  cartItems CartItem[]
  orders    Order[]

  @@map("users")
}
```

- [ ] **Step 2: Generate the migration**

Run from `backend/`:

```bash
npm run db:migrate -- --name add_user_last_click_flush_at
```

Expected: Prisma creates a new folder under `backend/prisma/migrations/`, writes `migration.sql` containing something like `ALTER TABLE "users" ADD COLUMN "last_click_flush_at" TIMESTAMPTZ;`, applies it to the dev DB, and regenerates the client.

- [ ] **Step 3: Verify the migration file**

Run:

```bash
cat backend/prisma/migrations/*add_user_last_click_flush_at/migration.sql
```

Expected content (exact formatting may vary):

```sql
-- AlterTable
ALTER TABLE "users" ADD COLUMN "last_click_flush_at" TIMESTAMPTZ(6);
```

- [ ] **Step 4: Verify client types include the field**

Run:

```bash
grep -n "lastClickFlushAt" backend/node_modules/.prisma/client/index.d.ts | head -5
```

Expected: at least one match under the `User` type.

---

## Task 2: Pure `computeCredit` function (TDD)

**Files:**

- Create: `backend/lib/clickCredit.js`
- Test: `backend/tests/clickCredit.test.js`

The pure function contains all rate-cap math. No DB, no side effects — matches the project's convention of testing pure helpers (see `backend/tests/cart.test.js` ↔ `backend/lib/cart.js`).

- [ ] **Step 1: Create empty module**

Create `backend/lib/clickCredit.js`:

```js
export const RATE_PER_SEC = 10;
export const BURST_BONUS = 20;
export const MAX_FIRST_WINDOW_MS = 3_600_000;
export const MAX_DELTA = 100_000;
export const MAX_ELAPSED_MS = 86_400_000;
```

(Implementation added in Step 3; constants exported first so tests can import them.)

- [ ] **Step 2: Write failing tests**

Create `backend/tests/clickCredit.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  computeCredit,
  RATE_PER_SEC,
  BURST_BONUS,
  MAX_FIRST_WINDOW_MS,
} from "../lib/clickCredit.js";

const NOW = new Date("2026-04-21T12:00:00Z");

test("computeCredit: credits full delta when under the rate cap", () => {
  const result = computeCredit({
    delta: 5,
    elapsedMs: 1000,
    lastClickFlushAt: new Date(NOW.getTime() - 1000),
    now: NOW,
  });
  assert.equal(result.credited, 5);
});

test("computeCredit: caps delta silently when over the rate", () => {
  // 100ms elapsed → floor(100/1000)*10 + 20 = 0 + 20 = 20 max
  const result = computeCredit({
    delta: 5000,
    elapsedMs: 100,
    lastClickFlushAt: new Date(NOW.getTime() - 100),
    now: NOW,
  });
  assert.equal(result.credited, 20);
});

test("computeCredit: uses the smaller of client and server elapsed", () => {
  // Client claims 10s, server says 1s → use 1s. maxAllowed = 10 + 20 = 30.
  const result = computeCredit({
    delta: 1000,
    elapsedMs: 10_000,
    lastClickFlushAt: new Date(NOW.getTime() - 1000),
    now: NOW,
  });
  assert.equal(result.credited, 30);
});

test("computeCredit: uses client elapsed (clamped) when lastClickFlushAt is null", () => {
  // First flush ever: server trusts client up to MAX_FIRST_WINDOW_MS.
  const result = computeCredit({
    delta: 50,
    elapsedMs: 10_000,
    lastClickFlushAt: null,
    now: NOW,
  });
  // maxAllowed = floor(10_000/1000)*10 + 20 = 100 + 20 = 120. delta=50 passes.
  assert.equal(result.credited, 50);
});

test("computeCredit: clamps huge client elapsed to MAX_FIRST_WINDOW_MS on null lastClickFlushAt", () => {
  // Client claims 24h; clamp to 1h. maxAllowed = 3600*10 + 20 = 36_020.
  const result = computeCredit({
    delta: 1_000_000,
    elapsedMs: 86_400_000,
    lastClickFlushAt: null,
    now: NOW,
  });
  const expectedMax =
    Math.floor(MAX_FIRST_WINDOW_MS / 1000) * RATE_PER_SEC + BURST_BONUS;
  assert.equal(result.credited, expectedMax);
});

test("computeCredit: returns 0 credited for zero delta", () => {
  const result = computeCredit({
    delta: 0,
    elapsedMs: 1000,
    lastClickFlushAt: new Date(NOW.getTime() - 1000),
    now: NOW,
  });
  assert.equal(result.credited, 0);
});

test("computeCredit: throws on negative delta", () => {
  assert.throws(
    () =>
      computeCredit({
        delta: -1,
        elapsedMs: 1000,
        lastClickFlushAt: null,
        now: NOW,
      }),
    /delta/i,
  );
});

test("computeCredit: throws on non-integer delta", () => {
  assert.throws(
    () =>
      computeCredit({
        delta: 1.5,
        elapsedMs: 1000,
        lastClickFlushAt: null,
        now: NOW,
      }),
    /delta/i,
  );
});

test("computeCredit: throws on non-positive elapsedMs", () => {
  assert.throws(
    () =>
      computeCredit({
        delta: 5,
        elapsedMs: 0,
        lastClickFlushAt: null,
        now: NOW,
      }),
    /elapsed/i,
  );
});
```

- [ ] **Step 3: Run tests — verify they fail**

Run from `backend/`:

```bash
node --test tests/clickCredit.test.js
```

Expected: all `computeCredit` tests fail with `TypeError: computeCredit is not a function` (or similar import error).

- [ ] **Step 4: Implement `computeCredit`**

Edit `backend/lib/clickCredit.js` — keep the constants from Step 1 and append:

```js
export function computeCredit({ delta, elapsedMs, lastClickFlushAt, now }) {
  if (!Number.isInteger(delta) || delta < 0) {
    throw new Error("delta must be a non-negative integer");
  }
  if (!Number.isInteger(elapsedMs) || elapsedMs <= 0) {
    throw new Error("elapsedMs must be a positive integer");
  }

  let effectiveElapsed;
  if (lastClickFlushAt == null) {
    effectiveElapsed = Math.min(elapsedMs, MAX_FIRST_WINDOW_MS);
  } else {
    const serverElapsed = now.getTime() - lastClickFlushAt.getTime();
    effectiveElapsed = Math.min(elapsedMs, Math.max(0, serverElapsed));
  }

  const maxAllowed =
    Math.floor(effectiveElapsed / 1000) * RATE_PER_SEC + BURST_BONUS;
  const credited = Math.min(delta, maxAllowed);
  return { credited };
}
```

- [ ] **Step 5: Run tests — verify they pass**

Run:

```bash
node --test tests/clickCredit.test.js
```

Expected: all 9 tests pass.

---

## Task 3: `creditClicks` service

**Files:**

- Create: `backend/services/clickService.js`

Wraps `computeCredit` in a `$transaction` with a row lock, mirroring the `FOR UPDATE` pattern from `services/orderService.js:placeOrder`.

- [ ] **Step 1: Create the service**

Create `backend/services/clickService.js`:

```js
import { prisma } from "../lib/prisma.js";
import { httpError } from "../lib/httpError.js";
import {
  computeCredit,
  MAX_DELTA,
  MAX_ELAPSED_MS,
} from "../lib/clickCredit.js";

export async function creditClicks({ userId, delta, elapsedMs }) {
  if (!Number.isInteger(delta) || delta <= 0 || delta > MAX_DELTA) {
    throw httpError(400, "Invalid delta");
  }
  if (
    !Number.isInteger(elapsedMs) ||
    elapsedMs <= 0 ||
    elapsedMs > MAX_ELAPSED_MS
  ) {
    throw httpError(400, "Invalid elapsedMs");
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
            SELECT balance, last_click_flush_at
            FROM users
            WHERE id = ${userId}::uuid
            FOR UPDATE
        `;
    if (rows.length === 0) {
      throw httpError(500, "Profile missing");
    }

    const now = new Date();
    const lastClickFlushAt = rows[0].last_click_flush_at; // may be null
    const { credited } = computeCredit({
      delta,
      elapsedMs,
      lastClickFlushAt,
      now,
    });

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        balance: { increment: credited },
        lastClickFlushAt: now,
      },
      select: { balance: true },
    });

    return { balance: updated.balance, credited };
  });
}
```

- [ ] **Step 2: Smoke-check imports by starting the server**

Run from `backend/`:

```bash
npm run dev
```

Expected: server starts without module-resolution errors, logs `Server is running on http://127.0.0.1:3000`. Stop it with Ctrl-C.

(No unit test for the service — matches the project convention that services using the DB are not unit-tested; the pure helper in Task 2 covers the logic.)

---

## Task 4: `flushClicks` controller + route

**Files:**

- Modify: `backend/controllers/meController.js`
- Modify: `backend/routes/meRoutes.js`

- [ ] **Step 1: Add the controller**

Edit `backend/controllers/meController.js`. Add a new import and a new exported function. Leave `getMe` exactly as it is.

After the existing import line `import { httpError, sendHttpError } from '../lib/httpError.js';`, add:

```js
import { creditClicks } from "../services/clickService.js";
```

After the `getMe` function, append:

```js
export async function flushClicks(req, res) {
  try {
    const { delta, elapsedMs } = req.body ?? {};
    const result = await creditClicks({
      userId: req.user.id,
      delta,
      elapsedMs,
    });
    res.json(result);
  } catch (err) {
    if (err.http) return sendHttpError(res, err);
    console.error("flushClicks failed:", err);
    res.status(500).json({ error: "Failed to credit clicks" });
  }
}
```

- [ ] **Step 2: Mount the route**

Edit `backend/routes/meRoutes.js`. Replace the current import line with:

```js
import { getMe, flushClicks } from "../controllers/meController.js";
```

Add below the existing `router.get('/', getMe);` line:

```js
router.post("/clicks", flushClicks);
```

- [ ] **Step 3: Manual smoke test**

Start the dev server from repo root:

```bash
npm run dev
```

In another shell, grab a Supabase access token (e.g., from `localStorage` in the browser after logging into the frontend — key `sb-<project>-auth-token`, extract `.access_token`). Then:

```bash
TOKEN='<paste access token>'
curl -sS -X POST http://127.0.0.1:3000/me/clicks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"delta":5,"elapsedMs":1000}' \
  | jq
```

Expected response:

```json
{ "balance": <new_balance>, "credited": 5 }
```

Then try to exceed the cap:

```bash
curl -sS -X POST http://127.0.0.1:3000/me/clicks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"delta":5000,"elapsedMs":100}' \
  | jq
```

Expected: `credited` ≤ 20 (burst bonus plus rate; exact value depends on server-side elapsed since the previous flush).

Then test validation:

```bash
curl -sS -i -X POST http://127.0.0.1:3000/me/clicks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"delta":-1,"elapsedMs":1000}'
```

Expected: `HTTP/1.1 400` with `{"error":"Invalid delta"}`.

Stop the server.

---

## Task 5: `useCookieClicker` hook

**Files:**

- Create: `frontend/src/hooks/useCookieClicker.js`

This is the largest task. The whole hook lands in one commit-worthy unit because a half-built hook is not usable or testable.

- [ ] **Step 1: Create the hook file**

Create `frontend/src/hooks/useCookieClicker.js`:

```js
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth.js";

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:3000";
const GUEST_KEY = "bb:guestClicks";
const FLUSH_INTERVAL_MS = 5000;
const THRESHOLD = 50;
const CLICKS_PER_SEC = 10;

function readGuestClicks() {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      !Number.isInteger(parsed.pending) ||
      parsed.pending <= 0 ||
      !Number.isFinite(parsed.firstClickAt)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeGuestClicks(pending, firstClickAt) {
  try {
    if (pending <= 0) {
      localStorage.removeItem(GUEST_KEY);
    } else {
      localStorage.setItem(
        GUEST_KEY,
        JSON.stringify({ pending, firstClickAt }),
      );
    }
  } catch {
    // localStorage unavailable (Safari private mode). Fall back to in-memory only.
  }
}

export function useCookieClicker() {
  const { session, profile, authedFetch, refreshProfile } = useAuth();
  const accessToken = session?.access_token ?? null;
  const isAuthenticated = Boolean(accessToken);

  const pendingRef = useRef(0);
  const windowStartRef = useRef(null); // performance.now() for authed; Date.now() for guest
  const guestFirstClickAtRef = useRef(null); // wall-clock Date.now() of first guest click
  const clickTimesRef = useRef([]);
  const tokenRef = useRef(accessToken);
  const prevTokenRef = useRef(accessToken);
  const flushingRef = useRef(false);
  const guestWriteTimerRef = useRef(null);
  const [tick, setTick] = useState(0);

  const rerender = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  // Hydrate guest state from localStorage on mount (only while unauthenticated).
  useEffect(() => {
    if (isAuthenticated) return;
    const saved = readGuestClicks();
    if (saved) {
      pendingRef.current = saved.pending;
      guestFirstClickAtRef.current = saved.firstClickAt;
      rerender();
    }
  }, [isAuthenticated, rerender]);

  const scheduleGuestWrite = useCallback(() => {
    if (guestWriteTimerRef.current) return;
    guestWriteTimerRef.current = setTimeout(() => {
      guestWriteTimerRef.current = null;
      writeGuestClicks(
        pendingRef.current,
        guestFirstClickAtRef.current ?? Date.now(),
      );
    }, 500);
  }, []);

  const doFlush = useCallback(
    async ({ keepalive = false } = {}) => {
      if (pendingRef.current === 0) return;
      if (!isAuthenticated || !accessToken) return;
      if (flushingRef.current) return;

      const delta = pendingRef.current;
      const elapsedMs = Math.max(
        1,
        Math.round(
          performance.now() - (windowStartRef.current ?? performance.now()),
        ),
      );

      pendingRef.current = 0;
      windowStartRef.current = null;
      rerender();

      flushingRef.current = true;
      try {
        const res = await authedFetch("/me/clicks", {
          method: "POST",
          body: JSON.stringify({ delta, elapsedMs }),
          keepalive,
        });
        if (res.ok) {
          await refreshProfile();
        } else {
          // 4xx/5xx: drop these clicks. Next tick will try fresh pending.
          // eslint-disable-next-line no-console
          console.warn("flush /me/clicks failed:", res.status);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("flush /me/clicks error:", err);
      } finally {
        flushingRef.current = false;
      }
    },
    [accessToken, authedFetch, isAuthenticated, refreshProfile, rerender],
  );

  // Guest → authenticated migration, and logout flush.
  useEffect(() => {
    const prevToken = prevTokenRef.current;
    prevTokenRef.current = accessToken;

    // Logout: use the previous token to flush before it's gone.
    if (prevToken && !accessToken && pendingRef.current > 0) {
      const delta = pendingRef.current;
      const elapsedMs = Math.max(
        1,
        Math.round(
          performance.now() - (windowStartRef.current ?? performance.now()),
        ),
      );
      pendingRef.current = 0;
      windowStartRef.current = null;
      rerender();
      // Raw fetch with the pre-transition token; keepalive so it survives unload.
      fetch(`${API_BASE}/me/clicks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${prevToken}`,
        },
        body: JSON.stringify({ delta, elapsedMs }),
        keepalive: true,
      }).catch(() => {});
      return;
    }

    // Login: migrate guest clicks if any.
    if (!prevToken && accessToken) {
      const guest = readGuestClicks();
      if (!guest) return;
      const elapsedMs = Math.max(1, Date.now() - guest.firstClickAt);
      // Use authedFetch — token is now set.
      authedFetch("/me/clicks", {
        method: "POST",
        body: JSON.stringify({ delta: guest.pending, elapsedMs }),
      })
        .then((res) => {
          if (res.ok) {
            writeGuestClicks(0, 0); // removes key
            pendingRef.current = 0;
            guestFirstClickAtRef.current = null;
            rerender();
            refreshProfile();
          }
        })
        .catch(() => {});
    }
  }, [accessToken, authedFetch, refreshProfile, rerender]);

  // 5s flush interval + page-hide flush (only while authenticated).
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      doFlush();
    }, FLUSH_INTERVAL_MS);

    const onHide = () => {
      if (document.visibilityState === "hidden") {
        doFlush({ keepalive: true });
      }
    };
    const onPageHide = () => doFlush({ keepalive: true });

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [isAuthenticated, doFlush]);

  const handleClick = useCallback(() => {
    const nowPerf = performance.now();

    // Client-side throttle: prune to the last 1000ms, drop if >= 10.
    const times = clickTimesRef.current;
    while (times.length && nowPerf - times[0] > 1000) {
      times.shift();
    }
    if (times.length >= CLICKS_PER_SEC) return false;
    times.push(nowPerf);

    if (pendingRef.current === 0) {
      windowStartRef.current = nowPerf;
    }
    pendingRef.current += 1;

    if (!isAuthenticated) {
      if (guestFirstClickAtRef.current == null) {
        guestFirstClickAtRef.current = Date.now();
      }
      scheduleGuestWrite();
    } else if (pendingRef.current >= THRESHOLD) {
      doFlush();
    }

    rerender();
    return true;
  }, [doFlush, isAuthenticated, rerender, scheduleGuestWrite]);

  const displayPoints = isAuthenticated
    ? (profile?.balance ?? 0) + pendingRef.current
    : pendingRef.current;

  // Reference `tick` so re-renders actually read current refs.
  void tick;

  return { displayPoints, handleClick, isAuthenticated };
}
```

- [ ] **Step 2: Lint check**

Run from `frontend/`:

```bash
npm run lint
```

Expected: no new errors. The hook uses `useCallback` and `useEffect` with complete dependency arrays.

---

## Task 6: Wire `CookieClicker.jsx` to the hook

**Files:**

- Modify: `frontend/src/components/CookieClicker.jsx`

Replace the component body to consume `useCookieClicker`, change `+10` to `+1`, and render a "Log in to save your points" hint when not authenticated.

- [ ] **Step 1: Replace the component**

Overwrite `frontend/src/components/CookieClicker.jsx` with:

```jsx
import { useRef, useState } from "react";
import { useCookieClicker } from "../hooks/useCookieClicker.js";

export default function CookieClicker() {
  const { displayPoints, handleClick, isAuthenticated } = useCookieClicker();
  const [floatingTexts, setFloatingTexts] = useState([]);
  const idRef = useRef(0);

  const handleCookieClick = (e) => {
    const accepted = handleClick();
    if (!accepted) return;

    const id = ++idRef.current;
    setFloatingTexts((prev) => [
      ...prev,
      { id, x: e.clientX, y: e.clientY, points: 1 },
    ]);
  };

  const removeFloater = (id) => {
    setFloatingTexts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-8 w-full h-full">
        <div className="bg-surface p-6 rounded-lg border border-line text-center shadow-card">
          <p className="text-5xl font-bold text-accent m-0 font-display">
            {displayPoints}
          </p>
          <p className="text-[0.9rem] text-muted mt-2 mb-0 uppercase tracking-[0.05em]">
            Points
          </p>
        </div>

        <button
          className="text-[14rem] bg-none border-none cursor-pointer p-0 transition-transform duration-100 ease-in-out select-none leading-none drop-shadow-[0_4px_12px_rgba(61,47,36,0.15)] hover:scale-105 active:animate-cookie-click"
          onClick={handleCookieClick}
        >
          🍪
        </button>

        {!isAuthenticated && (
          <p className="text-xs text-muted text-center max-w-[18rem] italic">
            Log in to save your points.
          </p>
        )}
      </div>

      {floatingTexts.map((text) => (
        <div
          key={text.id}
          className="fixed pointer-events-none text-[1.75rem] font-bold text-accent animate-float-up [text-shadow:0_2px_4px_rgba(0,0,0,0.1)] font-display"
          style={{
            left: `${text.x}px`,
            top: `${text.y}px`,
          }}
          onAnimationEnd={() => removeFloater(text.id)}
        >
          +{text.points}
        </div>
      ))}
    </>
  );
}
```

Notes on the changes:

- Floating-text `points` is hardcoded to `1` (spec Section Summary: click value is 1).
- `handleClick()` returns a boolean indicating whether the click was accepted (it's rejected when the client throttle is saturated). If rejected, no floater spawns — user sees the UI go quiet for a moment, which is the desired subtle "you're too fast" signal.
- The login hint uses Tailwind tokens already defined in `frontend/src/index.css` (`text-muted` → `--color-muted`).

- [ ] **Step 2: Lint check**

Run from `frontend/`:

```bash
npm run lint
```

Expected: no new errors.

---

## Task 7: Manual QA

No frontend test framework exists, so verify the feature end-to-end by hand. The following checklist mirrors the spec's Testing section — run every item.

**Files:** none (verification only)

- [ ] **Step 1: Start both servers**

From repo root:

```bash
npm run dev
```

Expected: backend on `127.0.0.1:3000`, frontend on `127.0.0.1:5173`.

- [ ] **Step 2: Authenticated flush (5s interval)**

1. Log in as an existing test user.
2. Note current balance in cart drawer / header area (or via `curl /me` with the token).
3. Click the cookie exactly 20 times at a relaxed pace (not max speed).
4. Wait 6 seconds without clicking.
5. Check balance again. Expected: increased by 20.
6. Confirm in the Network tab a `POST /me/clicks` request fired ~5s after the last click.

- [ ] **Step 3: Authenticated threshold flush**

1. While logged in, click 55 times as fast as the client throttle allows.
2. Expected: a `POST /me/clicks` fires as soon as the 50-click threshold is crossed, and again ~5s after clicking stops.
3. Rough balance gain: 50–55 points (may be slightly fewer if the server trimmed by cap; not an error).

- [ ] **Step 4: Server rate cap**

1. In DevTools Console, run:
   ```js
   for (let i = 0; i < 500; i++)
     document.querySelector("button.active\\:animate-cookie-click").click();
   ```
2. Expected: the client throttle admits at most ~10 clicks; the displayed number jumps by a small amount. After the next flush, the server-side balance confirms the cap held.

- [ ] **Step 5: Guest accumulation + localStorage persistence**

1. Log out.
2. Click 30 times.
3. Expected: displayed points = 30. Login hint "Log in to save your points." appears.
4. DevTools → Application → Local Storage → `bb:guestClicks` has `{ pending: 30, firstClickAt: <ms> }`.
5. Refresh the page. Expected: points display still shows 30.

- [ ] **Step 6: Guest → login migration**

1. Continuing from Step 5 with 30 pending guest points, log in.
2. Expected shortly after login: a `POST /me/clicks { delta: 30, elapsedMs: <ms-since-first-click> }` fires; server returns `credited: 30` (assuming elapsed exceeds ~1 second); `bb:guestClicks` is removed from localStorage; user's balance increases by ~30.

- [ ] **Step 7: Logout mid-session flush**

1. Log in. Click 10 times. Immediately log out (don't wait for the 5s interval).
2. Expected: a `POST /me/clicks` fires using the pre-logout token. Balance increments before the session fully tears down. Check by logging back in and confirming balance reflects those 10.

- [ ] **Step 8: Page-close flush**

1. Log in. Click 5 times. Close the tab (or navigate to another site).
2. Re-open the app, log in as the same user.
3. Expected: balance reflects the 5 points. (If not, `keepalive` may have failed — log it but not a hard blocker for this feature.)

- [ ] **Step 9: Safari private mode / localStorage-unavailable fallback**

1. Open in Safari private mode (or set `localStorage` to throw via Storage blocking).
2. While logged out, click 10 times. Expected: counter works in-memory; no JS error in the console.
3. Refresh. Expected: counter resets to 0 (persistence is lost; this is acceptable per spec).

- [ ] **Step 10: Backend tests still pass**

From `backend/`:

```bash
npm test
```

Expected: all tests pass (the existing `cart.test.js` plus the new `clickCredit.test.js`).

---

## Self-Review — Coverage Map

| Spec requirement                                                                                  | Task                                         |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `User.lastClickFlushAt` column                                                                    | Task 1                                       |
| Rate-cap math (`RATE_PER_SEC`, `BURST_BONUS`, `MAX_FIRST_WINDOW_MS`, server vs client elapsed)    | Task 2                                       |
| `MAX_DELTA` / `MAX_ELAPSED_MS` request validation                                                 | Task 3                                       |
| `FOR UPDATE` row lock + balance increment + `lastClickFlushAt` update                             | Task 3                                       |
| `POST /me/clicks` endpoint + auth via existing middleware                                         | Task 4                                       |
| Response `{ balance, credited }`                                                                  | Tasks 3–4                                    |
| 400s for invalid input                                                                            | Task 3 (via `httpError`) + Task 4 smoke test |
| Client `useCookieClicker` hook                                                                    | Task 5                                       |
| 10-clicks/sec client throttle (rolling 1000ms window)                                             | Task 5                                       |
| Flush triggers: 5s interval, 50-click threshold, page-hide (`keepalive`), logout, login-migration | Task 5                                       |
| Guest `bb:guestClicks` localStorage persistence + try/catch for Safari private mode               | Task 5                                       |
| Login-migration flush clears localStorage on success                                              | Task 5                                       |
| `displayPoints` = `profile.balance + pending` (authed) / `pending` (guest)                        | Task 5                                       |
| `CookieClicker.jsx` consumes hook; `+10` → `+1`; "Log in to save your points." hint               | Task 6                                       |
| Reuse `AuthProvider`'s `profile`, `authedFetch`, `refreshProfile`                                 | Task 5                                       |
| Manual QA across all edge cases                                                                   | Task 7                                       |

All spec sections map to at least one task. No placeholders, no references to undefined types or functions. The plan is self-contained and does not depend on files outside the scope listed in File Structure.
