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

## Admin cancel

`backend/services/orderService.js::cancelOrderById(orderId)` — one transaction. The `adminOrdersController.cancelOrder` handler is a thin wrapper.

1. Load the order (with its items); 404 if missing, 409 if already cancelled.
2. Increment the owning user's balance by `order.total`.
3. Increment `products.stock` by each `order_item.quantity` — mirrors the decrement in `placeOrder`.
4. Flip `status` to `cancelled`.

The route is `PATCH /admin/orders/:id/cancel` and sits behind both `requireAuth` and `requireAdmin`.

## Authorization stance

- All enforcement lives in Express middleware (`requireAuth`, `requireAdmin`).
- RLS is not used and will not be relied on. The backend bypasses it by connecting as the service role. This is an intentional tradeoff documented in `docs/superpowers/specs/2026-04-20-database-schema-design.md`.

## Environments

- `backend/.env` — `PORT`, `DATABASE_URL` (pooled, for app runtime), `DIRECT_URL` (non-pooled, for `prisma migrate`), `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
- `frontend/.env` — `VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

CORS in `backend/server.js` allows `http://127.0.0.1:5173` and `http://localhost:5173` with credentials.
