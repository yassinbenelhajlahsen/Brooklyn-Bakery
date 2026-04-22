# Architecture

## Components

```
┌──────────────────────┐      ┌──────────────────────┐      ┌─────────────────────────┐
│  Browser             │      │  Express API         │      │  Supabase Postgres      │
│  React + Vite        │─────▶│  backend/server.js   │─────▶│  (Prisma over DATABASE_ │
│  @supabase/supabase- │      │  + Prisma            │      │   URL with pgbouncer)   │
│  js (publishable key)│      │  + admin Supabase    │      │                         │
└──────────┬───────────┘      └──────────┬───────────┘      └─────────────────────────┘
           │                              │
           └──────── Supabase Auth ───────┘
                 (JWT in Authorization: Bearer)
```

- Frontend talks to Supabase directly for **auth only** (sign in / sign up / session refresh), using the publishable key. The SDK stores the session in `localStorage` and refreshes tokens automatically.
- All app data calls go to the Express API with `Authorization: Bearer <access_token>`.
- The backend verifies tokens with Supabase's admin client and talks to Postgres via Prisma. It connects as the Supabase service role, which intentionally bypasses Row Level Security.

## Auth

- `frontend/src/auth/AuthProvider.jsx` owns `session` / `user` / `profile`, subscribes to `supabase.auth.onAuthStateChange`, and exposes `signIn`, `signUp`, `signOut`, `openLogin`, `requestCheckout`, `refreshProfile`, and `authedFetch`. Cart and order API calls live in `frontend/src/services/*` (see "Data-access layer" below).
- `frontend/src/auth/useAuth.js` is a separate hook file — required because `AuthProvider.jsx` exports both the context and component, and `react-refresh/only-export-components` would otherwise complain.
- `backend/middleware/requireAuth.js` reads `Authorization: Bearer <token>`, calls `supabase.auth.getUser(token)`, and attaches `req.user = { id, email }`. No token / bad token → 401. Supabase unreachable → 503.
- `backend/middleware/requireAdmin.js` runs **after** `requireAuth`, loads `users.role` via Prisma, and 403s if the user is not an admin.

**Key-header rules.** Publishable and secret keys are not JWTs — the Supabase SDK sends them in the `apikey` header automatically. The `Authorization: Bearer …` header always carries the **user's** access token, never a publishable or secret key. `SUPABASE_SECRET_KEY` is backend-only.

## Data-access layer

API calls are pure async functions under `frontend/src/services/` that take `authedFetch` as their first argument:

- `services/cartService.js` — `mergeAndHydrateCart`, `fetchServerCart`, `syncCartItem`, `clearServerCart`
- `services/profileService.js` — `fetchProfile` (used by `AuthProvider.refreshProfile`)
- `services/orderService.js` — `placeOrder` (throws `PlaceOrderError` with `status` + message on non-2xx)

Components never import services directly. Hooks (`useCart`, `usePlaceOrder`, `AuthProvider`) read `authedFetch` from `useAuth()` and pass it into services at call time. This keeps token-refresh behavior centralized in `AuthProvider` while letting services stay testable and free of React context.

Pure transforms and formatters live in `frontend/src/lib/` (`cart.js` — `computeCartSubtotal`, `computeCartItemCount`, `toHydratedCart`; `categories.js`).

## Cart lifecycle

Cart state lives in `frontend/src/hooks/useCart.js`.

1. **Logged out.** `useCart` lazy-initializes from `localStorage.cart`, writes on every change (`try`/`catch` for private-mode browsers). No network traffic.
2. **Login / user switch.** `useCart` watches `user?.id` and compares against `localStorage.cartOwner`:
   - Owner changed (or first sign-in) → `POST /cart/merge` with the local cart. The server additively merges `[existing + incoming]` per product, replaces the DB cart in one transaction, and returns the hydrated list. The frontend then stamps `cartOwner = user.id`.
   - Same owner → `GET /cart` and hydrate from the server.
3. **Signed-in mutations.** `increment` / `decrement` fire `PUT /cart/items/:productId` with the new absolute quantity. `quantity === 0` triggers a delete (204). `clearCart` calls `DELETE /cart`.
4. **Sign-out.** Local cart is left in `localStorage`; `cartOwner` is cleared so the next sign-in re-merges.

Source-of-truth rule: server once signed in, `localStorage` otherwise.

## Order creation

`backend/services/orderService.js::placeOrder(userId)` — everything inside a single `prisma.$transaction`. The `orderController.createOrder` handler is a thin wrapper that calls this service and maps errors via `sendHttpError`.

1. Load the user's cart items with current product prices.
2. Row-lock the user's balance with a raw `SELECT balance FROM users WHERE id = … FOR UPDATE`. This serializes concurrent orders for the same user across replicas.
3. Compute `total` with `computeCartTotal` (pure function in `backend/lib/cart.js`).
4. If `balance < total`, throw `httpError(402, 'Insufficient balance')`.
5. Decrement `users.balance` by `total`.
6. For each cart item, atomically decrement `products.stock` with a conditional `updateMany` (`WHERE id = ? AND stock >= qty`). If zero rows are affected, throw `httpError(409, 'Insufficient stock for <name>')` — the outer transaction rolls back, so the balance decrement is reverted. No explicit `FOR UPDATE` is needed; the `UPDATE` itself takes the row lock.
7. Insert the `orders` row and nested `order_items` (snapshotting `unit_price` from the products loaded in step 1).
8. Delete the user's `cart_items`.

Errors thrown as `httpError(status, msg)` are translated by `sendHttpError`; unexpected errors return 500. Success returns 201 with the order and its items.

## Checkout flow

The cart drawer's Checkout button calls `AuthProvider.requestCheckout`, which either opens the login modal (signed-out) or navigates to `/checkout`. `CheckoutPage` (`frontend/src/pages/CheckoutPage.jsx`) renders the review state: line items with qty controls, subtotal, current balance, and balance-after-purchase. The "Place order" button is disabled when the cart is empty, submitting, profile is still loading, or the balance is insufficient. Order submission goes through the `usePlaceOrder` hook, which calls `orderService.placeOrder`, refreshes the profile on success, and invokes an `onSuccess` callback so the page can clear the local cart and swap to the success state. Errors render inline (no `alert`).

The current balance is sourced from `GET /me`, which returns the authenticated user's profile. `AuthProvider` fetches it whenever the session's access token changes (initial load, sign-in, token refresh) and exposes `profile` + `refreshProfile()` on the context.

## Cookie clicker / click-credit flow

Clicks on the `CookieClicker` component earn 1 point each into the user's `users.balance` — the same balance spent at checkout. Writes are batched; a DB call never happens per click.

Frontend state lives in `frontend/src/hooks/useCookieClicker.js`.

1. **Client throttle.** `handleClick` keeps a rolling 1-second window of click timestamps in a ref. If the window already holds ≥ 10 entries, the click is dropped silently (no pending increment, no floating `+1` animation). This is a UX cap only — the server is the real enforcer.
2. **Pending accumulator.** Accepted clicks increment `pendingRef`. On the first click of a window, `windowStartRef = performance.now()`.
3. **Authenticated flush.** `doFlush` snapshots `{ delta: pendingRef, elapsedMs: now - windowStartRef }`, resets the refs **before** the network call (so in-flight clicks accumulate into a fresh window), and `POST /me/clicks` via `authedFetch`. On 2xx it calls `refreshProfile()` so `profile.balance` is re-synced app-wide. On failure it drops the pending delta — the next trigger retries with whatever's newly accumulated. `flushingRef` guards against concurrent flushes.
4. **Flush triggers** (all gated on `isAuthenticated`):
   - 5s `setInterval`
   - Inline when `pendingRef >= 50` (threshold)
   - `visibilitychange → hidden` and `pagehide`, both with `fetch keepalive: true`
   - Logout transition — uses the **previous** token via a raw `fetch` (also `keepalive`), since `authedFetch` would throw once the session is null
5. **Guest accumulation.** While logged out, `pendingRef` and the first-click wall-clock time are mirrored to `localStorage.bb:guestClicks` debounced ~500ms (try/catch wraps localStorage access for Safari private mode). The component renders a subtle "Log in to save your points" hint.
6. **Guest → authenticated migration.** On the auth transition `false → true`, the hook POSTs the saved `{ pending, firstClickAt }` to `/me/clicks` with `elapsedMs = Date.now() - firstClickAt`. On success, `bb:guestClicks` is removed. A second mount-time effect retries the migration on subsequent page loads if a prior attempt failed.

Server-side, `backend/services/clickService.js::creditClicks` mirrors the `placeOrder` idiom:

1. Reject invalid input (non-integer / out-of-range `delta` or `elapsedMs`) with `httpError(400)`.
2. `prisma.$transaction` → `SELECT balance, last_click_flush_at FROM users WHERE id = $uid FOR UPDATE`.
3. Call the pure helper `backend/lib/clickCredit.js::computeCredit` with `{ delta, elapsedMs, lastClickFlushAt, now }`. That function returns `{ credited }` after capping:
   - `effectiveElapsed = min(clientElapsed, now - lastClickFlushAt)` if `lastClickFlushAt != null`
   - `effectiveElapsed = min(clientElapsed, MAX_FIRST_WINDOW_MS)` when `lastClickFlushAt == null` (first flush / new account)
   - `maxAllowed = floor(effectiveElapsed / 1000) * RATE_PER_SEC + BURST_BONUS` (10/sec + burst of 20)
   - `credited = min(delta, maxAllowed)`
4. Apply `balance += credited` and `last_click_flush_at = now()` in the same transaction.
5. Return `{ balance, credited }`.

**Why the `FOR UPDATE` lock matters.** It serializes concurrent flushes from the same user (e.g. two browser tabs) so the second flush's `now - last_click_flush_at` reflects the first flush's write — otherwise both flushes would see the same `lastClickFlushAt` and each credit the full burst bonus.

**Silent cap, not rejection.** When a caller exceeds the rate, the server credits what's allowed and returns it in `credited` — no 429, no error. Cheaters don't get a signal to probe the boundary; honest users with lag or tab switches don't get punished.

**Why trust neither client nor server elapsed alone.** Server-side `now - lastClickFlushAt` is authoritative but can't cover the very first flush (no prior timestamp). Client-side `elapsedMs` is trusted up to a 1h cap on the first flush (guest migration), then bounded by `min(client, server)` thereafter. This lets guest sessions that spanned a long idle time migrate their points without trusting a malicious client that claims `elapsedMs: 99999999`.

## Order lifecycle & state machine

Orders move through a bounded set of statuses (`confirmed | processing | shipped | delivered | cancel_requested | cancelled | return_requested | returned`). All status changes — from both user and admin endpoints — route through a single module: [`backend/services/orderStateMachine.js`](../backend/services/orderStateMachine.js). Design rationale: [`superpowers/specs/2026-04-22-admin-page-design.md`](superpowers/specs/2026-04-22-admin-page-design.md).

The module exports three things:

- `transitions` — the full transition table, keyed by current status. Each entry declares the target status, the allowed actor (`user` or `admin`), and side-effect flags (`refundPoints`, `restoreStock`, `setDeliveredAt`, `requiresReason`, `requiresWindow`).
- `resolveTransition(currentStatus, action, actor)` — pure lookup that throws `httpError(409)` for invalid transitions, `httpError(403)` for actor mismatches.
- `checkReturnWindow(deliveredAt, now)` — pure predicate that returns `true` when `now - deliveredAt ≤ 48h` and `deliveredAt` is non-null.
- `transition({ orderId, action, actor, reason })` — the I/O wrapper; this is what controllers call.

`transition` wraps everything in a single `prisma.$transaction`:

1. Row-lock the order (`SELECT … FOR UPDATE`) so concurrent admin clicks and user actions on the same order serialize.
2. Resolve the transition against the locked status (not the value the client saw).
3. If `requiresReason`, demand a non-empty `reason` argument (400 otherwise). If `requiresWindow`, check `checkReturnWindow(order.deliveredAt)` (409 on expired).
4. Apply side effects inside the same tx: refund the user's balance (with a separate `SELECT balance … FOR UPDATE` lock on the user row when refunding), increment `products.stock` per item if `restoreStock`, stamp `deliveredAt = now()` if `setDeliveredAt`.
5. Write `requestReason` or `decisionReason` based on the actor (`user` → `requestReason`, `admin` → `decisionReason`).
6. Update the status and return the updated order with items + user joined in.

`shipped` is a one-way street with a single outgoing transition (`setDelivered`) — once shipped, neither user nor admin can cancel. Lost-package handling rolls into the return flow after delivery.

Returns refund points but deliberately **do not** restore stock (perishable goods).

### User-driven transitions

User-facing endpoints are semantic, not raw action names — the frontend never names a state-machine action:

- `POST /orders/:id/cancel` — `confirmed → cancelled` (direct, refund + stock) or `processing → cancel_requested`. The controller (`orderController.userCancel`) pre-reads the current status only to pick which action name to pass to `transition`; the authoritative check re-runs inside the tx under the row lock.
- `POST /orders/:id/return` — `delivered → return_requested` within 48h.

Both controllers verify `order.userId === req.user.id` up front (403 otherwise).

### Admin-driven transitions

The admin-side API is a single RPC-style dispatch endpoint: `POST /admin/orders/:id/transition` with body `{ action, reason? }`. The controller (`adminOrdersController.transitionOrder`) validates `action` against a whitelist of admin-allowed actions and hands off to `transition({ actor: 'admin' })`. Nine admin actions are wired: `setProcessing`, `setShipped`, `setDelivered`, `approveCancel`, `denyCancel`, `approveReturn`, `denyReturn`, `forceCancel`, `forceReturn`. Four of them (the destructive/denial ones) require a reason.

Denials revert: `denyCancel` sends `cancel_requested` back to `processing`; `denyReturn` sends `return_requested` back to `delivered`. The customer UI hides the "Request cancellation" / "Request return" buttons once `decisionReason` is populated on a non-terminal order, so users can't spam repeat requests after a denial.

## Admin panel (frontend)

Single route: `/admin`, gated by `AdminRoute` (reads `profile.role` from `useAuth()`; redirects non-admins to `/`, renders a loading state while the profile is still being fetched). The real enforcement is the backend's `requireAdmin` middleware; the guard is just UX.

`AdminPage` is a shell with three internal tabs (component-local `useState`, not URL-synced) and a single sliding accent underline that translates between tabs (`translateX(activeIdx * 100%)`) — mirrors `BuyEarnTabs`. Tabs:

- **Orders** (`components/admin/OrdersTab.jsx`) — filterable table via `StatusFilter`. Row click opens `OrderDetailDrawer`, a right-side slide-in panel with customer / date / total / items / reasons. The drawer's action footer renders buttons by status (from `ACTIONS_BY_STATUS`); actions needing a reason expand an inline textarea inside the footer (no modal). ESC closes the drawer.
- **Products** (`components/admin/ProductsTab.jsx`) — product table with "Include archived" toggle. "New product" and row-level "Edit" both open `ProductEditModal`. Archive / Unarchive fire inline. Server error surfaces inline in the modal; validation is client-side first.
- **Users** (`components/admin/UsersTab.jsx`) — user table. Row click opens `UserDetailDrawer`, which shows identity + role toggle (disabled when the target is the acting admin) + balance delta form + that user's orders with `StatusBadge`. The drawer fetches its own detail via `useAdminUsers.getOne(id)` on mount.

Drawer UX conventions (shared by `OrderDetailDrawer` and `UserDetailDrawer`):

- Slide in from right on mount (`requestAnimationFrame` to flip `translate-x-full` → `translate-x-0` with a 250ms ease-out), slide out on close before unmount.
- ESC key closes. Backdrop click closes. Height is `h-dvh` to fill the visible viewport on mobile Safari.
- Parent conditionally renders the drawer (`{selected && <Drawer … />}`) so opening a new row always gets a fresh mount — state doesn't leak between openings.

### Admin data layer

Services live under `frontend/src/services/admin/` (one file per domain: `adminOrdersService.js`, `adminProductsService.js`, `adminUsersService.js`) and hooks under `frontend/src/hooks/admin/` (one hook per domain). This is a mild departure from the otherwise-flat `services/` and `hooks/` directories — admin adds enough files that nesting reads better.

Performance note: hooks don't refetch the full list after a mutation. The backend endpoints return the updated entity, and the hooks splice it into local state (`setOrders((prev) => prev.map(o => o.id === id ? updated : o))`). When an active filter would exclude the updated item (status filter on orders, `includeArchived=false` on a newly-archived product), the item is dropped from the list instead. Initial loads and explicit "Refresh" clicks still hit the list endpoint.

## Non-order admin guards

These don't use the state machine (there's no graph), but they share its transactional discipline.

- **Role change** (`PATCH /admin/users/:id/role`): inside a single `prisma.$transaction`, apply the update, then `SELECT count(*) FROM users WHERE role = 'admin'`. If zero, throw → rolls back. The acting-admin self-demotion check is a cheap guard at the controller level (`req.user.id === req.params.id`).
- **Balance delta** (`POST /admin/users/:id/balance`): row-lock the target user (`SELECT balance … FOR UPDATE`), compute `next = current + delta`, throw 409 if `next < 0`, otherwise write.
- **Product archive / unarchive**: just set / clear `archived_at`. Public `GET /products` filters `archived_at IS NULL`; the admin product list controls visibility via `?includeArchived`.

## Authorization stance

- All enforcement lives in Express middleware (`requireAuth`, `requireAdmin`).
- RLS is not used and will not be relied on. The backend bypasses it by connecting as the service role. This is an intentional tradeoff documented in `docs/superpowers/specs/2026-04-20-database-schema-design.md`.

## Environments

- `backend/.env` — `PORT`, `DATABASE_URL` (pooled, for app runtime), `DIRECT_URL` (non-pooled, for `prisma migrate`), `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
- `frontend/.env` — `VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

CORS in `backend/server.js` allows `http://127.0.0.1:5173` and `http://localhost:5173` with credentials.
