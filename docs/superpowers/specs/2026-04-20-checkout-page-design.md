# Checkout Page Design

**Date:** 2026-04-20
**Status:** Approved
**Branch:** `check-out`

## Problem

The app currently performs checkout as a single click in the cart drawer: the "Checkout" button triggers `POST /orders` directly from `AuthProvider.requestCheckout`. There is no review step, no visibility into the user's point balance, and errors surface through `alert()`. Users cannot see what they're committing to or what they'll have left after purchase.

## Goals

- A dedicated `/checkout` page that shows the full cart, the user's current balance, and the balance after purchase.
- Order creation happens only when the user explicitly confirms on `/checkout`.
- Users can still adjust quantities or remove items from the checkout page.
- Success and error states are inline, not alerts.

Out of scope:
- Header-level balance display (planned separately; this spec sets it up via `GET /me` but does not wire it into the header).
- An order history page (`/orders`).
- Any test coverage.

## Architecture

### New backend endpoint: `GET /me`

Returns the authenticated user's profile. Reusable by the checkout page today and by header UI later.

- Route: `app.use('/me', requireAuth, meRoutes)` in `backend/server.js`.
- Files:
  - `backend/routes/meRoutes.js` — `GET /` → `getMe`.
  - `backend/controllers/meController.js` — `getMe`.
- Controller selects only safe fields from Prisma and merges `email` from the Supabase session (email is not a column on `public.users` — it lives on `auth.users` and is already on `req.user` via `requireAuth`):
  ```js
  const profile = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, displayName: true, balance: true, role: true },
  });
  if (!profile) return sendHttpError(res, httpError(404, 'Profile not found'));
  res.json({ user: { ...profile, email: req.user.email } });
  ```
- `401` handled by `requireAuth`.
- `404` defensive — the `auth.users` → `public.users` trigger guarantees existence; returning 404 rather than crashing is safer than assuming.

No schema changes. No migration.

### Router

Introduce `react-router-dom` (v6+). `main.jsx` wraps the tree in `<BrowserRouter>` **outside** `<AuthProvider>` so AuthProvider can use `useNavigate`.

```
<BrowserRouter>
  <AuthProvider>
    <App />
  </AuthProvider>
</BrowserRouter>
```

`App.jsx` splits into routes. Header, Footer, and LoginModal stay always-mounted. CategoryNav and CartDrawer mount only on `/`.

- `/` — renders `CategoryNav` + `<main><HomePage /></main>` + `CartDrawer`.
- `/checkout` — renders `<main><CheckoutPage /></main>` only.

Cart state (`useCart`) stays hoisted in `App.jsx` and is passed via props to both page components, matching the existing pattern.

### Header cart button

`Header.jsx` reads the current route via `useLocation()` and hides the cart icon when `pathname === '/checkout'`. The drawer isn't mounted on that route; showing the button would no-op.

### AuthProvider changes

Add profile state:

- New state: `profile` (`{ id, email, displayName, balance, role } | null`).
- New callback: `refreshProfile()` — calls `GET /me` via `authedFetch`, stores the response in `profile`, and returns it.
- Lifecycle (inside the existing `onAuthStateChange` handler):
  - On any event producing a non-null session (`INITIAL_SESSION` on page load, `SIGNED_IN` on login, `TOKEN_REFRESHED`) → call `refreshProfile()`.
  - On sign-out → `setProfile(null)`.
- Context value exposes `profile` and `refreshProfile`.

Rewrite `requestCheckout` to be pure navigation:

```js
const requestCheckout = useCallback(() => {
  if (!user || !session?.access_token) {
    setLoginReason('checkout');
    setLoginOpen(true);
    return;
  }
  navigate('/checkout');
}, [user, session?.access_token, navigate]);
```

Place-order logic moves out of AuthProvider entirely.

### `useCart` changes

Add a `removeItem` helper (sugar over `setQty(item, 0)`) and include it in the hook's return. Cleaner than threading `setQty` through props.

### CheckoutPage (`frontend/src/pages/CheckoutPage.jsx`)

**Props.** `cart`, `increment`, `decrement`, `removeItem`, `clearCart` — all passed from `App.jsx` (same wiring pattern as `HomePage`/`CartDrawer`).
**Hooks.** `useAuth()` for `user`, `profile`, `refreshProfile`, `authedFetch`. `useNavigate()` for navigation buttons.

**Local state.**
- `submitting: boolean` — request-in-flight flag.
- `error: string | null` — inline error copy.
- `order: { id, total } | null` — set on success; presence triggers success-state render.

**Render states.**

1. **Unauthenticated** (`!user`) → `<Navigate to="/" replace />`. Guards direct URL access; the primary entry is the cart drawer.
2. **Success** (`order != null`) → heading "Order placed", show order id (last 8 chars), total spent, remaining balance (`profile.balance` after refresh), "Continue shopping" button → `navigate('/')`.
3. **Empty cart** (no items, no success) → "Your cart is empty" + "Back to shop" button → `navigate('/')`.
4. **Review** (default, items present) →
   - Line items: image, name, unit price, qty controls (+/−, reusing `.qty-controls` / `.qty-btn`), line total, a Remove button (`removeItem(item)`).
   - Summary block: subtotal, current balance (`profile.balance`), balance after purchase (`profile.balance - subtotal`). If negative, render in a warning style with "Not enough points".
   - "Place order" button — disabled when cart is empty, `submitting`, `profile` not yet loaded, or `profile.balance < subtotal`.
   - "Back to shop" button → `navigate('/')`.
   - Inline error region — rendered when `error != null`.

**Profile loading.** If `profile == null` when the page mounts (SIGNED_IN fetch is async), render a "Loading…" placeholder in the summary block. Items still render from `cart` immediately. Prevents a misleading `0 pts` flash.

**Place order flow.**

1. `setSubmitting(true)`, `setError(null)`.
2. `POST /orders` via `authedFetch`.
3. On 2xx:
   - Parse response body (created order).
   - `clearCart()` — local cart state; server cart is already cleared by the order transaction.
   - `await refreshProfile()` — pulls new balance.
   - `setOrder({ id, total })` → success state renders.
4. On non-2xx:
   - Parse body; map error copy:
     - `402` → "Not enough points to complete this order."
     - `400` → "Your cart is empty." (rare race)
     - other → `body.error ?? 'Something went wrong. Please try again.'`
   - `setError(...)`, `setSubmitting(false)`. Cart intact; user can retry.
5. On network failure:
   - `setError('Could not reach the server. Please try again.')`, `setSubmitting(false)`.

## Flow Summary

1. User clicks Checkout in the cart drawer → `requestCheckout()`.
2. Signed out: open login modal with `reason='checkout'`.
3. Signed in: `navigate('/checkout')`; drawer closes.
4. `/checkout` renders the review state.
5. User adjusts qty or clicks Place order.
6. Server validates, decrements balance, creates order, clears cart atomically.
7. Frontend clears local cart, refreshes profile, renders success state.
8. Continue shopping → `/`.

## Files

### New
- `backend/routes/meRoutes.js`
- `backend/controllers/meController.js`
- `frontend/src/pages/CheckoutPage.jsx`

### Modified
- `backend/server.js` — mount `/me`.
- `frontend/package.json` + lock — add `react-router-dom`.
- `frontend/src/main.jsx` — wrap in `<BrowserRouter>`.
- `frontend/src/App.jsx` — routes; CategoryNav + CartDrawer only on `/`.
- `frontend/src/components/Header.jsx` — hide cart button on `/checkout`.
- `frontend/src/components/CartDrawer.jsx` — checkout button calls `onClose()` before `requestCheckout()` so the drawer state doesn't leak across navigation.
- `frontend/src/auth/AuthProvider.jsx` — add `profile` state, `refreshProfile`, rewrite `requestCheckout` to navigate.
- `frontend/src/hooks/useCart.js` — add `removeItem` helper.
- `docs/data-and-api.md` — document `GET /me`; note new checkout flow.
- `docs/architecture.md` — brief mention of the checkout page and `/me` profile source.
- `docs/file-map.md` — add new files.

## Commit

Single commit covering backend endpoint, frontend route, and docs:

> `feat(checkout): add /checkout review page with balance-aware place order`
>
> Adds GET /me for profile + balance, introduces react-router with a
> dedicated /checkout review page (item edits, balance, balance-after,
> place-order → success state), and moves order creation out of the
> cart drawer's requestCheckout into the page.

## Verification (manual)

- Signed-out: `/checkout` redirects to `/`; cart drawer's Checkout opens login modal.
- Signed-in, items present: drawer's Checkout navigates to `/checkout`; items, balance, balance-after render correctly.
- Qty change / remove on `/checkout` updates totals and server cart.
- Removing last item on `/checkout` → empty-cart state.
- Insufficient balance: "Place order" disabled, balance-after shows warning.
- Sufficient balance: Place order → success state with order id + remaining balance; `/` shows empty cart.
- Error paths: server 500 and offline → inline error, cart intact, can retry.
- Header cart icon hidden on `/checkout`.
