# Supabase Auth — Design

**Date:** 2026-04-20
**Branch:** `feat/login`
**Status:** Approved by user, ready for implementation planning

## Problem

The Brooklyn Bakery app currently has no authentication. All users — including anonymous curl clients — can hit any backend route. The frontend has a cart but no concept of a user, and no notion of which actions should require identity.

We want to:
- Let anyone browse products and pages (no change to public browsing).
- Let anyone add/remove items in the cart (cart persists in `localStorage`).
- Gate **checkout** behind authentication — clicking "Checkout" prompts login/signup if the user isn't authenticated.
- Prevent unauthenticated curl/non-browser clients from hitting protected backend routes.

Supabase Postgres tables are out of scope. Only Supabase Auth is used. When the DB is added later, the auth infrastructure does not need to change.

## Scope

**In scope**
- Supabase project setup instructions (manual, one-time)
- Email + password sign up and log in (no email confirmation)
- Login modal with Log in / Sign up tabs
- React `AuthProvider` + `useAuth` hook
- Logout control in the header
- Client-side cart with `localStorage` persistence (lazy init + write-on-change)
- Checkout flow that requires auth, with pending-intent replay after login
- Backend `requireAuth` middleware verifying Supabase JWTs via `supabase.auth.getUser(token)`
- A stub `POST /orders` endpoint that accepts a cart payload and returns `{ ok: true, received: <cart> }`, protected by `requireAuth`
- Env file additions and `.gitignore` updates

**Out of scope**
- Magic link, OAuth providers
- Email confirmation / verification flow
- Password reset / "forgot password"
- Server-side cart persistence (revisit when Postgres is introduced)
- Merging guest cart with a server cart at login time
- Real payment processing / real order fulfillment
- Automated test framework (none exists in the project; manual test plan documented)

## Architecture

### Supabase (manual, one-time)
- Create a Supabase project.
- Enable **Email** provider; **disable** "Confirm email".
- In **Project Settings → API Keys**, create (or use) the new-format keys — do **not** use the legacy `anon` / `service_role` JWT keys (deprecated):
  - `SUPABASE_URL` — public
  - Publishable key (`sb_publishable_...`) — public, frontend
  - Secret key (`sb_secret_...`) — secret, backend only, never shipped to the browser

**Key-header rules (important):**
- Publishable and secret keys are **not** JWTs. They cannot be sent in an `Authorization: Bearer` header. The Supabase JS SDK places them in the `apikey` header automatically when you init a client with them.
- The `Authorization: Bearer <token>` header we send on protected API calls carries the **user's** access token (a JWT issued by Supabase on sign-in), never the publishable/secret keys.

### Frontend (React / Vite)

New files:
- `frontend/src/lib/supabase.js` — single Supabase client instance using `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `frontend/src/auth/AuthProvider.jsx` — Context provider. Holds `user`, `session`, `loginOpen`, `pendingCheckout`. Exposes `signIn`, `signUp`, `signOut`, `openLogin`, `closeLogin`, `requestCheckout`. Subscribes to `supabase.auth.onAuthStateChange` and hydrates initial session with `supabase.auth.getSession()`.
- `frontend/src/auth/useAuth.js` — thin hook reading the context.
- `frontend/src/components/LoginModal.jsx` — modal with Log in / Sign up tabs. Inline error display. Auto-closes on successful auth.

Changes to existing files:
- `frontend/src/main.jsx` — wrap `<App />` in `<AuthProvider>`.
- `frontend/src/App.jsx` — cart state is lazy-initialized from `localStorage`; a `useEffect` writes on change (wrap `setItem` in try/catch to tolerate private-mode browsers).
- `frontend/src/components/Header.jsx` — add "Log in" button when logged out; "Log out" + user email when logged in.
- `frontend/src/components/CartDrawer.jsx` — `handleCheckout` no longer calls `alert`. It calls the new `requestCheckout` function from `useAuth`. That function:
  1. If `user` present, POSTs to `/orders` with the cart and bearer token, shows result.
  2. If `user` absent, stores cart as `pendingCheckout` and calls `openLogin()`.
- New `frontend/.env.example` with `VITE_SUPABASE_URL=`, `VITE_SUPABASE_PUBLISHABLE_KEY=`.

### Backend (Express)

New files:
- `backend/lib/supabase.js` — admin Supabase client using `SUPABASE_URL` + `SUPABASE_SECRET_KEY`.
- `backend/middleware/requireAuth.js` — reads `Authorization: Bearer <token>`, calls `supabase.auth.getUser(token)`, attaches `req.user = { id, email }`, or returns 401 JSON. Using `getUser` for v1 (network call, catches logouts in real time). `supabase.auth.getClaims(token)` — local JWKS verification, faster — is a documented future optimization once request volume warrants it.
- `backend/routes/orderRoutes.js` — `POST /` → `createOrder`.
- `backend/controllers/orderController.js` — `createOrder` returns `{ ok: true, received: req.body }` and logs `req.user.id`.

Changes to existing files:
- `backend/server.js` — `app.use('/orders', requireAuth, orderRoutes)`.
- `backend/.env.example` — add `SUPABASE_URL=`, `SUPABASE_SECRET_KEY=`.
- `.gitignore` (root or per-package) — ensure `.env` and `frontend/.env`, `backend/.env` are ignored (verify existing state before editing).

### Dependencies to install
- Frontend: `@supabase/supabase-js`
- Backend: `@supabase/supabase-js`

## Data Flow

### Signup
1. User opens modal, picks Sign up tab, submits email + password.
2. `supabase.auth.signUp({ email, password })`.
3. With email confirmation disabled, Supabase returns a session immediately.
4. `onAuthStateChange` fires → `AuthProvider` sets `user` → modal closes.

### Login
1. Same as signup but `signInWithPassword`.
2. On error, inline message (e.g. "Invalid login credentials"); modal stays open.

### Logout
1. Header "Log out" → `supabase.auth.signOut()`.
2. `onAuthStateChange` clears `user`. Any `pendingCheckout` is cleared on logout.

### Checkout (logged out)
1. User clicks Checkout in `CartDrawer`.
2. `requestCheckout(cart)`:
   - No `user` → stash cart in `pendingCheckout`, call `openLogin()`.
3. Modal opens. User logs in or signs up.
4. An effect in `AuthProvider` watches `[user, pendingCheckout]`. When both become truthy, it POSTs `/orders` with `Authorization: Bearer <access_token>`, clears `pendingCheckout`, closes the modal.
5. User dismisses modal without logging in → `closeLogin()` clears `pendingCheckout`.

### Checkout (logged in)
1. `requestCheckout(cart)` sees `user`, POSTs `/orders` directly.
2. Response displayed (simple confirmation for now; replaces the current `alert`).

### Authenticated backend call
1. Frontend: `fetch('/orders', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(cart) })`.
2. `requireAuth` extracts token → `supabase.auth.getUser(token)` using the service-role client → attaches `req.user`.
3. `createOrder` responds with `{ ok: true, received: <cart> }`.
4. Curl without token → 401.

### Session persistence
- Supabase SDK stores session in `localStorage` by default. On app mount, `AuthProvider` calls `getSession()` once to hydrate, then subscribes to `onAuthStateChange`. Token refresh is automatic.

### Cart persistence
- `useState` lazy initializer reads `localStorage.getItem('cart')` (JSON.parse, try/catch).
- `useEffect` on `[cart]` writes JSON.stringify to `localStorage` (try/catch).
- No per-user key for now; cart is shared across logged-in/out state on the same browser. This is intentional simplicity — revisit when DB is added.

## Error Handling

### Frontend
- Auth errors (invalid creds, email already registered) → inline message from Supabase error text.
- Network failure during auth → generic "Couldn't reach auth server, try again".
- Modal never auto-dismisses on error.
- Checkout API 401 (token expired between gate and request) → clear session, reopen login modal with "Session expired, please log in again", keep `pendingCheckout` so it replays after re-login.
- Checkout button disables itself while in flight (prevents double-submit).

### Backend
- Missing `Authorization` → `401 { error: 'Missing token' }`.
- Malformed (no `Bearer ` prefix) → `401 { error: 'Invalid auth header' }`.
- Invalid/expired token → `401 { error: 'Invalid token' }`.
- Supabase unreachable → `503 { error: 'Auth service unavailable' }`.
- No token contents or stack traces in responses.

### Edge cases
- `localStorage` disabled/blocked (private mode) → Supabase falls back to in-memory; cart writes wrapped in try/catch, app keeps functioning (no persistence).
- Two tabs, logout in one → other tab receives `SIGNED_OUT` via storage event → both reflect logged-out state.
- Logout mid-checkout → `pendingCheckout` cleared along with user.
- Empty cart at checkout → button is only rendered when cart has items (existing behavior); no extra guard.

## Testing (manual)

No test framework exists in the project; introducing one is out of scope. Manual steps:

1. `curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" -d '{}'` → expect **401**.
2. Sign up with a fresh email → expect immediate login (no email confirmation).
3. Log out, refresh browser → expect still logged out.
4. Log in, refresh browser → expect still logged in (session in localStorage).
5. While logged out: add items → click Checkout → modal opens → log in → order posts automatically → confirmation shows.
6. While logged in: add items → click Checkout → order posts directly.
7. Tamper with token in devtools (change one character) → click Checkout → 401 → modal reopens with "Session expired".
8. Open two tabs, log out in one → second tab reflects logged-out within a second or two.
9. Add items, refresh → cart survives.
10. Enable private browsing → app still works, cart doesn't persist (no crash).

## Security Notes

- `SUPABASE_SECRET_KEY` (the `sb_secret_...` value) is backend-only. Never exposed to the frontend. Never logged.
- Access tokens are stored in `localStorage` by default (Supabase SDK). This is the Supabase-recommended default; acceptable for this project. Revisit if/when threat model demands httpOnly cookies.
- Backend rejects all requests to `/orders` without a valid token. No anonymous order creation path.
- `.env` files are gitignored.

## Open Questions

None at design-approval time. To be resolved during implementation if discovered:
- Exact copy and visual polish of `LoginModal` — follow existing app styling conventions in `App.css`.
- Whether to show a toast or inline banner after successful order submission — simplest: replace current `alert` with a similar unobtrusive confirmation.
