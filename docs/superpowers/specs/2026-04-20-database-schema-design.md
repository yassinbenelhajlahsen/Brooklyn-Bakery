# Database Schema Design — Brooklyn Bakery

**Date:** 2026-04-20
**Branch:** feat/login
**Status:** Approved design; implementation plan to follow

## Goal

Add a persistent data layer to Brooklyn Bakery using **Prisma** over **Postgres (Supabase)**. Supabase continues to own authentication (`auth.users`). Prisma owns the `public` schema. This spec covers the initial schema (tables, enums, constraints, triggers) and the behavioral contracts that depend on it (cart merge on login, atomic order creation, admin cancellation).

Real-money checkout, shipping/pickup, and self-service admin promotion are explicitly out of scope.

## Authorization model

Authorization is enforced at the Express route layer, not via Supabase Row Level Security (RLS).

- The backend connects to Postgres using the Supabase **service-role** credentials through Prisma, which bypasses RLS. This is intentional.
- `requireAuth` (existing middleware) verifies the Supabase JWT on the request and attaches `user_id`.
- `requireAdmin` (new middleware) runs after `requireAuth`, loads `public.users.role` for the authenticated user, and 403s if it is not `'admin'`.
- Public routes: `GET /products` and nested product reads only. Everything else requires `requireAuth`. Admin-only routes additionally require `requireAdmin`.

## Schema

### Enums

```
product_type = 'bread' | 'pastry' | 'cake' | 'cookie' | 'drink'
order_status = 'confirmed' | 'cancelled'
user_role    = 'customer' | 'admin'
```

**Note on `order_status`:** there is no `pending` state because order creation is a single atomic DB transaction with no shipping, async payment, or fulfillment step. Either the transaction commits (order is real and paid) or it rolls back (no row exists). `pending` would be a phantom state. When real payments or async fulfillment are added, new states are introduced at that time — not speculatively now.

### Tables

#### `users`

Mirrors `auth.users` and holds app-level profile data. FK with `ON DELETE CASCADE` so deleting the auth user removes the profile.

| Column         | Type          | Constraints                                         |
| -------------- | ------------- | --------------------------------------------------- |
| `id`           | `UUID`        | PK, FK → `auth.users(id)` ON DELETE CASCADE         |
| `balance`      | `INT`         | NOT NULL, DEFAULT `0`, CHECK (`balance >= 0`)       |
| `role`         | `user_role`   | NOT NULL, DEFAULT `'customer'`                      |
| `display_name` | `TEXT`        | NULL                                                |
| `created_at`   | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()`                           |
| `updated_at`   | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()`; trigger keeps it current |

**Skipped on purpose (YAGNI):** `email`, `phone` (live on `auth.users`), `avatar_url` (no upload UI), fine-grained roles beyond customer/admin.

#### `products`

| Column        | Type           | Constraints                                           |
| ------------- | -------------- | ----------------------------------------------------- |
| `id`          | `UUID`         | PK, DEFAULT `gen_random_uuid()`                       |
| `name`        | `TEXT`         | NOT NULL                                              |
| `description` | `TEXT`         | NOT NULL                                              |
| `image_url`   | `TEXT`         | NOT NULL                                              |
| `type`        | `product_type` | NOT NULL                                              |
| `price`       | `INT`          | NOT NULL, CHECK (`price >= 0`); integer balance units |
| `created_at`  | `TIMESTAMPTZ`  | NOT NULL, DEFAULT `now()`                             |
| `updated_at`  | `TIMESTAMPTZ`  | NOT NULL, DEFAULT `now()`                             |

`price` is an integer in the same units as `users.balance` — purchases debit balance directly.

#### `cart_items`

One implicit cart per user; no separate `carts` parent row. Composite primary key guarantees one row per `(user, product)`.

| Column       | Type          | Constraints                           |
| ------------ | ------------- | ------------------------------------- |
| `user_id`    | `UUID`        | FK → `users(id)` ON DELETE CASCADE    |
| `product_id` | `UUID`        | FK → `products(id)` ON DELETE CASCADE |
| `quantity`   | `INT`         | NOT NULL, CHECK (`quantity > 0`)      |
| `added_at`   | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()`             |
| PK           |               | `(user_id, product_id)`               |

If a product is deleted, it is removed from carts. Carts are per-user working state, not historical records.

#### `orders`

| Column       | Type           | Constraints                                          |
| ------------ | -------------- | ---------------------------------------------------- |
| `id`         | `UUID`         | PK, DEFAULT `gen_random_uuid()`                      |
| `user_id`    | `UUID`         | FK → `users(id)` ON DELETE RESTRICT                  |
| `total`      | `INT`          | NOT NULL, CHECK (`total >= 0`); snapshot at purchase |
| `status`     | `order_status` | NOT NULL, DEFAULT `'confirmed'`                      |
| `created_at` | `TIMESTAMPTZ`  | NOT NULL, DEFAULT `now()`                            |

`ON DELETE RESTRICT` on `user_id` prevents losing order history when a user is deleted; if a user is actually removed, orders must be handled explicitly.

#### `order_items`

| Column       | Type   | Constraints                                               |
| ------------ | ------ | --------------------------------------------------------- |
| `id`         | `UUID` | PK, DEFAULT `gen_random_uuid()`                           |
| `order_id`   | `UUID` | FK → `orders(id)` ON DELETE CASCADE                       |
| `product_id` | `UUID` | FK → `products(id)` ON DELETE RESTRICT                    |
| `quantity`   | `INT`  | NOT NULL, CHECK (`quantity > 0`)                          |
| `unit_price` | `INT`  | NOT NULL, CHECK (`unit_price >= 0`); snapshot at purchase |

`unit_price` is captured at purchase time so historical orders remain meaningful if a product's price changes or the product is later removed. `ON DELETE RESTRICT` on `product_id` prevents accidental product deletion when historical orders reference it.

### Indexes (beyond PKs and unique FKs)

- `orders (user_id, created_at DESC)` — user order history listing.
- `products (type)` — filter product listings by type.
- `order_items (order_id)` — lookup of items for a given order.

## Key behaviors

### User row auto-creation

A Postgres trigger on `auth.users` insert creates the matching `public.users` row with defaults (`balance = 0`, `role = 'customer'`). This guarantees every authenticated user has a profile row without depending on API traffic or first-request backfill.

The trigger also populates `display_name` from `NEW.raw_user_meta_data->>'display_name'` when present (nullable otherwise). The sign-up form in `LoginModal` captures the user's name and passes it as `options.data.display_name` to `supabase.auth.signUp`, so the trigger has a value to copy. This yields a single write path for name capture — no post-signup `PATCH /me` call and no race window where the profile exists but the name is unset.

The trigger is created via a raw SQL migration (Prisma does not manage the `auth` schema).

### Cart merge on login

When a logged-out user with a local cart signs in, the frontend posts the local cart to the backend:

```
POST /cart/merge
Body: [{ product_id, quantity }, ...]
```

For each incoming item, the backend upserts `cart_items` with `quantity = existing + incoming` (additive merge). A logged-out user with 2 croissants who logs in with 3 more ends up with 5, not 3 or 2. The local cart is never discarded by sign-in.

After a successful merge, the frontend clears the localStorage cart and reads from the server as the source of truth.

### Order creation

All within one DB transaction:

1. Load the user's current balance `FOR UPDATE` (row-level lock).
2. Load cart items with their current product prices.
3. Compute `total = sum(quantity * price)`.
4. If `balance < total`, roll back and return `402 Payment Required`.
5. Decrement `users.balance` by `total`.
6. Insert an `orders` row with `status = 'confirmed'` and the computed `total`.
7. Insert `order_items` rows, snapshotting `unit_price` from the products loaded in step 2.
8. Delete the user's `cart_items` rows.
9. Commit.

Rollback on any error leaves no partial order.

### Order cancellation (admin)

`PATCH /orders/:id/status` (admin-only) transitions `status` from `'confirmed'` to `'cancelled'`. In one transaction:

1. Load the order and its items; fail if already `cancelled`.
2. Increment the order's `users.balance` by `sum(quantity * unit_price)` from `order_items`.
3. Update `orders.status` to `'cancelled'`.
4. Commit.

No partial cancellation and no re-cancellation.

## Migration & tooling

- **Prisma migrations** (`prisma migrate`) manage the `public` schema DDL (tables, enums, indexes, check constraints, FKs within `public`).
- **Raw SQL migration(s)** manage:
  - The FK from `public.users.id` to `auth.users(id)` (cross-schema; Prisma cannot model the `auth` schema without multi-schema support configured).
  - The trigger on `auth.users` insert that creates `public.users`.
  - The trigger that maintains `public.users.updated_at` and `public.products.updated_at`.
- **Seed script** (`prisma/seed.js` or equivalent) seeds initial `products` rows, ported from the existing dummy data in the backend.

The existing backend dummy-data file is replaced by the seeded `products` table; `GET /products` reads from Postgres via Prisma.

## Out of scope (explicit YAGNI)

Do not add these to this spec; add them only when a real need appears:

- `categories` table (product `type` is an enum today)
- `addresses` table (no shipping or pickup)
- `payments` table (no real money)
- `balance_transactions` table (no per-click history yet)
- Avatar upload (`avatar_url` on `users`)
- Self-service admin promotion endpoints (first admin is flipped manually via SQL)
- RLS policies (route-layer middleware is the authz boundary)
- Real-money checkout / Stripe
- Delivery / pickup scheduling

## Acceptance criteria

- Prisma schema compiles and `prisma migrate dev` applies cleanly against a fresh Supabase Postgres.
- A new Supabase auth sign-up produces exactly one corresponding `public.users` row with `balance = 0`, `role = 'customer'`, and `display_name` populated from the sign-up form.
- `GET /products` returns seeded products for both anonymous and authenticated requests.
- `POST /cart/merge` correctly sums quantities for existing rows and inserts new ones.
- A successful `POST /orders` debits balance, creates the order and items, clears the cart, and rejects when balance is insufficient — all atomically.
- An admin `PATCH /orders/:id/status` → `cancelled` credits the user's balance back and flips status; non-admins get 403.
- Integer check constraints reject negative quantities, prices, totals, and balances.
