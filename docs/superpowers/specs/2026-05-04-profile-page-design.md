# Profile Page — Design

**Date:** 2026-05-04
**Status:** Spec — pending plan

## Problem

`TODO.md` (Tier 2) lists "User profile page — the profile menu item navigates nowhere. There's a `/me` endpoint but no page to view/edit display name, etc."

`ProfileMenu.jsx` exposes a "Profile" item whose `onClick` only closes the menu (`frontend/src/components/ProfileMenu.jsx:107`). The backend already has `GET /me` returning `{ id, displayName, balance, role, email }`, and a full `/me/addresses` CRUD module that is currently only reachable mid-checkout.

## Goals

- A `/profile` route the user lands on from `ProfileMenu`.
- View account info (email, display name, balance) and edit display name.
- Manage saved addresses (list / add / edit / delete) outside of checkout.
- Change password with current-password verification.
- Inline per-section feedback for save success/failure.

## Non-goals

- Email change. Supabase has a separate flow; deferred.
- Account deletion, 2FA/MFA, avatar upload.
- Toast notifications. Tier 3 in `TODO.md`; inline status used until toasts ship.
- Frontend tests. Project has none today; manual verification only.
- Refactor of `AddressForm.jsx` / existing addresses CRUD; reuse as-is.

## User flow

1. User clicks the avatar button in the header → menu opens → clicks "Profile".
2. Page navigates to `/profile`. If the session has expired or the user is logged out, redirect to `/`.
3. Page shows three stacked sections:
   - **Account** — email (read-only), display name (inline-edit), balance (read-only).
   - **Saved addresses** — list with add/edit/delete.
   - **Security** — change password (current + new + confirm).
4. Each section saves independently and shows inline feedback.

## Architecture

### Route + entry

- New route `/profile` registered in `frontend/src/App.jsx`, rendered as `<ProfilePage />` inside the standard `<main>` shell.
- The page is auth-guarded the same way `OrderHistoryPage` is: early `if (!user) return <Navigate to="/" replace />`.
- `ProfileMenu.jsx`'s "Profile" item updates from a no-op `onClick` to `() => { setOpen(false); navigate('/profile'); }` — same pattern already used by the "Order History" and "Admin" items in that file.

### Page layout

`ProfilePage.jsx` mirrors `OrderHistoryPage.jsx`'s layout:

- Centered heading `Profile` with the existing `<Ornament />`.
- "Back to home" button using the same `BACK_BTN` class set as `OrderHistoryPage`.
- Vertical stack of three section cards (`bg-surface border border-line rounded-xl`).

`ProfilePage` itself is a thin container — auth guard, layout, heading. Each section is its own component for isolation.

### Component breakdown

```
frontend/src/pages/ProfilePage.jsx              # container
frontend/src/components/profile/AccountSection.jsx
frontend/src/components/profile/AddressesSection.jsx
frontend/src/components/profile/SecuritySection.jsx
```

Each section owns its own `{ saving, error, success }` state. No shared form state across sections.

#### `AccountSection`

- Reads `user.email` and `profile.displayName`, `profile.balance` from `useAuth()`.
- Display name has two states:
  - **View**: shows the current name with an "Edit" button next to it.
  - **Edit**: text input pre-populated, plus Save / Cancel buttons. Same enter-edit-mode feel as the address-edit affordance in `OrderHistoryPage` / `OrderCard`.
- Email and balance are plain read-only rows.

#### `AddressesSection`

- Loads via existing `fetchAddresses(authedFetch)` in a mount effect with a `cancelled` guard (same pattern as `OrderHistoryPage`).
- Shows a list of saved addresses. Each list item has Edit / Delete buttons.
- "Add address" toggles a form; "Edit" opens the same form pre-populated. Reuses `frontend/src/components/AddressForm.jsx` as-is.
- Uses existing `addressesService` functions: `createAddress`, `updateAddress`, `deleteAddress`.
- Empty state: "No saved addresses yet."

#### `SecuritySection`

Three inputs: current password, new password, confirm new password.

Submit handler:

1. Client-side validation:
   - New password length ≥ 6 (Supabase default minimum).
   - Confirm matches new.
   - On failure, set inline error and return without any network call.
2. Verify current password: `supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })`. If it fails → inline error "Current password is incorrect." under the current-password field.
3. On success: `supabase.auth.updateUser({ password: newPassword })`. If it fails → show the message returned by Supabase under the new-password field.
4. On full success: clear inputs, show inline "Password updated" status that auto-clears after 3s.

The user is **not** signed out. `signInWithPassword` refreshes the session for the same user; no redirect, no state churn beyond the AuthProvider's normal token-refresh handling.

### Backend changes

Only one new endpoint: **`PATCH /me`** to update display name.

- Auth: same `requireAuth` middleware as `GET /me`.
- Body: `{ displayName: string }`.
- Validation lives in a pure helper `backend/lib/displayName.js` with `normalizeDisplayName(input)` returning `{ ok: true, value } | { ok: false, error }`. This mirrors the `backend/lib/address.js` + `tests/address.test.js` pattern already used in the project. Rules:
  - `displayName` must be a string.
  - After `.trim()`: length 1–50.
- Controller `updateMe` calls the helper. On `{ ok: false }`, return 400 with `{ error: <message> }` via the existing `httpError` / `sendHttpError` pattern in `meController.js`. On `{ ok: true }`, run `prisma.user.update({ where: { id: req.user.id }, data: { displayName: value } })` and return the same shape as `GET /me`: `{ user: { id, displayName, balance, role, email } }`.
- Wired in `backend/routes/meRoutes.js` as `router.patch('/', updateMe)`.

No backend changes for password (Supabase client handles it) or addresses (`/me/addresses` CRUD already exists).

### New service function

Extend `frontend/src/services/profileService.js` (currently exports only `fetchProfile`) with:

```js
export async function updateMyProfile(authedFetch, { displayName }) {
  const res = await authedFetch('/me', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Failed to update profile');
  }
  return res.json(); // { user: {...} }
}
```

## Data flow

### On mount

- `ProfilePage` is auth-guarded; if `!user`, `<Navigate to="/" replace />`.
- `AccountSection` reads from `useAuth()` directly (`user`, `profile`) — no fetch needed; `AuthProvider` already loads profile when the session token is available (`refreshProfile` in `AuthProvider.jsx`).
- `AddressesSection` calls `fetchAddresses(authedFetch)` in a mount effect with a `cancelled` guard.
- `SecuritySection` needs no initial data.

### Display name save

```
user clicks Save in edit mode
  ↓
trim client-side; if empty or > 50 chars → inline error, no network call
  ↓
if trimmed === current displayName → exit edit mode silently (no request)
  ↓
updateMyProfile(authedFetch, { displayName: trimmed })
  ↓
on 2xx → await refreshProfile() (already on auth context)
  ↓
exit edit mode; show inline "Saved" (clears after 3s)
on error → keep edit mode open; show inline red error; preserve typed value
```

`refreshProfile` is the existing function on `AuthContext`; it re-fetches `/me` and updates the global `profile`, so consumers like `ProfileMenu`'s initial/name stay in sync after the rename.

### Address CRUD

- Reuse existing `addressesService` functions verbatim.
- Local list state lives in `AddressesSection`. After each successful create/update/delete, update the local list from the response payload — no optimistic UI.
- Errors render inline above the form.

### Password change

```
user submits Security form
  ↓
client validation (length, match)
  ↓
signInWithPassword({ email: user.email, password: current })
  ↓ (fail)  inline "Current password is incorrect"
  ↓ (ok)
updateUser({ password: new })
  ↓ (fail)  inline error from Supabase under new-password field
  ↓ (ok)
clear inputs; inline "Password updated" (clears after 3s)
```

### Inline status pattern

- Each section has its own `{ saving, error, success }` state.
- Success message: small green line below the section, auto-clears via `setTimeout` (cleared in cleanup if the component unmounts).
- Error: small red line, persists until the next save attempt or until the user changes the input.

## Validation rules

| Field | Rule | Where enforced |
|-------|------|----------------|
| `displayName` | required, trimmed length 1–50 | client (UX) and server (`PATCH /me`) |
| `newPassword` | length ≥ 6 | client only (Supabase enforces server-side) |
| `confirmPassword` | must equal `newPassword` | client only |
| `currentPassword` | non-empty | client; verified by Supabase |

## Edge cases

| Case | Behavior |
|------|----------|
| Display name same as current | Skip the request; exit edit mode silently. |
| Display name too long / empty | Client-side error inline; no network call. |
| Server rejects display name (400) | Keep edit mode open; show server's `error` message inline. |
| Wrong current password | Inline "Current password is incorrect"; nothing changes. |
| Supabase password policy rejects new password | Inline error from Supabase under new-password field. |
| Session expires while user is on the page | Auth guard re-evaluates because `user` is in context; user is redirected to `/`. |
| User signs out from another tab | Same as above. |
| Address fetch fails | Section shows an inline error ("Could not load addresses."); add/edit/delete are still permitted (the new entries will appear on next refresh). |
| Component unmounts during save | `cancelled` guard in effects; `setTimeout` for success auto-clear is cleared in cleanup. |

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/pages/ProfilePage.jsx` | Container: auth guard, layout, heading, "Back to home", section stack. |
| Create | `frontend/src/components/profile/AccountSection.jsx` | Email/balance read-only; inline-edit display name. |
| Create | `frontend/src/components/profile/AddressesSection.jsx` | List + add/edit/delete using existing `AddressForm` and `addressesService`. |
| Create | `frontend/src/components/profile/SecuritySection.jsx` | Change-password form with current-password verification. |
| Modify | `frontend/src/App.jsx` | Register `<Route path="/profile" element={<ProfilePage />} />`. |
| Modify | `frontend/src/components/ProfileMenu.jsx` | "Profile" item navigates to `/profile`. |
| Modify | `frontend/src/services/profileService.js` | Add `updateMyProfile(authedFetch, { displayName })`. |
| Create | `backend/lib/displayName.js` | `normalizeDisplayName(input)` → `{ ok: true, value } \| { ok: false, error }`. |
| Modify | `backend/controllers/meController.js` | Add `updateMe` handler that uses `normalizeDisplayName` and `prisma.user.update`. |
| Modify | `backend/routes/meRoutes.js` | `router.patch('/', updateMe)`. |
| Create | `backend/tests/displayName.test.js` | Pure-helper tests for `normalizeDisplayName` (mirrors `address.test.js`). |
| Create | `docs/superpowers/specs/2026-05-04-profile-page-design.md` | This spec. |
| Create | `docs/superpowers/plans/2026-05-04-profile-page-plan.md` | Implementation plan (written by the writing-plans skill). |

No schema changes. No new dependencies. No changes to RLS or auth middleware order.

## Test plan

### Backend (`node:test`)

`backend/tests/displayName.test.js` — pure-helper tests for `normalizeDisplayName`, following the style of `address.test.js`:

- Accepts a valid name, trims surrounding whitespace, returns `{ ok: true, value }`.
- Rejects empty string with `{ ok: false, error }`.
- Rejects whitespace-only string.
- Rejects strings longer than 50 chars.
- Rejects non-string input (number, object, null, undefined).
- Accepts a 50-char string at the boundary.
- Accepts unicode characters (e.g., names with non-ASCII letters).

Controller-level / HTTP-level coverage of `PATCH /me` is verified manually under "Frontend (manual)" below — this matches the project's existing testing approach (no Express or DB integration tests exist today).

### Frontend (manual)

- Open profile menu, click "Profile" → lands on `/profile`.
- Edit display name → save → header avatar initial updates; refresh page → still updated.
- Edit display name to empty/whitespace → inline error, no network call.
- Edit display name to > 50 chars → inline error.
- Add an address from `/profile` → it appears in `/checkout`'s `AddressSelector`.
- Edit an address → updates in both `/profile` and `/checkout`.
- Delete an address → disappears from both views.
- Change password with wrong current → "Current password is incorrect".
- Change password with mismatched confirm → inline error before any network call.
- Change password successfully → inline "Password updated"; sign out and back in with the new password works.
- Visit `/profile` while logged out → redirects to `/`.

## Open questions

None.

## Out of scope (future work)

- Toast notifications (Tier 3 in `TODO.md`) — would replace per-section inline success messages.
- Email change flow.
- Account deletion / data export.
- 2FA / MFA.
- Avatar upload.
- A "danger zone" section for destructive actions.
