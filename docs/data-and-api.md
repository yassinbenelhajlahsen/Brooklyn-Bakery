# Data & API reference

Condensed reference for the Prisma schema and the HTTP surface. For the *why* behind the original decisions (cascade choices, the absent `pending` order state, the YAGNI list), see [`superpowers/specs/2026-04-20-database-schema-design.md`](superpowers/specs/2026-04-20-database-schema-design.md). For the order-lifecycle state machine, product soft delete, and admin-panel additions, see [`superpowers/specs/2026-04-22-admin-page-design.md`](superpowers/specs/2026-04-22-admin-page-design.md).

## Schema

Source of truth: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

### Enums

- `ProductType` — `bread | pastry | cake | cookie | drink`
- `OrderStatus` — `confirmed | processing | shipped | delivered | cancel_requested | cancelled | return_requested | returned`. Terminal states: `cancelled`, `returned`. The allowed transitions between non-terminal states live in the state-machine module (see `backend/services/orderStateMachine.js` and the architecture doc).
- `UserRole` — `customer | admin`

### Tables

**`users`** — mirrors `auth.users`, created by a trigger on signup.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `balance` | int | default 0; `CHECK (balance >= 0)` |
| `role` | user_role | default `customer` |
| `display_name` | text | populated from `raw_user_meta_data->>'display_name'` at signup |
| `created_at`, `updated_at` | timestamptz | trigger-maintained |
| `last_click_flush_at` | timestamptz NULL | last time click-credits were applied; read + written by `POST /me/clicks` inside a `FOR UPDATE` transaction to enforce the server-side rate cap |

**`products`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `name`, `description`, `image_url` | text | all NOT NULL |
| `type` | product_type | indexed |
| `price` | int | `CHECK (price >= 0)`; integer points |
| `stock` | int | default 0; `CHECK (stock >= 0)`; decremented atomically at checkout, restored by pre-shipped cancels, NOT restored by returns (perishable goods) |
| `created_at`, `updated_at` | timestamptz | |
| `archived_at` | timestamptz NULL | soft delete. Public `GET /products` filters `archived_at IS NULL`. Admin endpoints can opt-in via `?includeArchived=true`. The `OrderItem → Product` FK is still `ON DELETE RESTRICT` as defense-in-depth. |

**`cart_items`** — composite PK `(user_id, product_id)`, so one row per user/product.

| Column | Notes |
| --- | --- |
| `user_id` → `users(id)` | ON DELETE CASCADE |
| `product_id` → `products(id)` | ON DELETE CASCADE |
| `quantity` | int; `CHECK (quantity > 0)` |
| `added_at` | timestamptz |

**`orders`**

| Column | Notes |
| --- | --- |
| `id` | uuid PK |
| `user_id` → `users(id)` | ON DELETE RESTRICT (preserves history) |
| `total` | int snapshot; `CHECK (total >= 0)` |
| `status` | default `confirmed` |
| `created_at` | timestamptz |
| `delivered_at` | timestamptz NULL; stamped when admin transitions `shipped → delivered`. Source of truth for the 48h return window. |
| `request_reason` | text NULL; user-supplied reason when requesting cancel/return. |
| `decision_reason` | text NULL; admin-supplied reason when denying a request or performing a force action. |
| `shipping_line1`, `shipping_line2`, `shipping_city`, `shipping_state`, `shipping_postal_code`, `shipping_country` | text NULL; snapshot of the selected address at checkout. Nullable only because orders created before the feature have no value; the API enforces non-null on new orders. Editing or deleting the source address in `addresses` does not mutate these. |

Index: `(user_id, created_at DESC)` for the "my orders" listing.

**`addresses`**

| Column | Notes |
| --- | --- |
| `id` | uuid PK |
| `user_id` → `users(id)` | ON DELETE CASCADE |
| `line1`, `city`, `state`, `postal_code`, `country` | text NOT NULL |
| `line2` | text NULL |
| `created_at`, `updated_at` | timestamptz |

Index: `(user_id)`. Deleting an address leaves past orders' `shipping_*` columns untouched (they are pure snapshots — no FK).

**`order_items`**

| Column | Notes |
| --- | --- |
| `id` | uuid PK |
| `order_id` → `orders(id)` | ON DELETE CASCADE |
| `product_id` → `products(id)` | ON DELETE RESTRICT |
| `quantity` | int; `CHECK (quantity > 0)` |
| `unit_price` | int snapshot at purchase |

Index: `(order_id)`.

### Invariants worth preserving

- **Integer money.** `price`, `balance`, `total`, `unit_price` are all `INT`. Never `Decimal`/float.
- **Historical snapshots.** `orders.total` and `order_items.unit_price` are captured at purchase; do not recompute from `products.price` for reads.
- **Stock accounting.** `products.stock` is decremented inside the `placeOrder` transaction (in `backend/services/orderService.js`) via a conditional `UPDATE … WHERE stock >= qty` (zero affected rows → 409, whole transaction rolls back). Restoration is driven by the state machine: any transition with `restoreStock: true` in the table (pre-shipped cancels) increments `stock` back. Returns (`approveReturn`, `forceReturn`) deliberately do NOT restore stock — baked goods are perishable.
- **Profile creation.** `public.users` is created by a DB trigger on `auth.users` insert. API code must not create profile rows itself (would race the trigger).
- **Cascade choices.** Cart rows cascade on product delete (carts are working state). Orders/order items restrict on product/user delete (history must survive). Products are soft-deleted via `archived_at`.
- **Authorization.** Enforced at the Express layer. RLS is deliberately not used; the backend connects as the Supabase service role.
- **State-machine invariants.** Every order status change flows through `services/orderStateMachine.js::transition`. The transition locks the order row (`SELECT … FOR UPDATE`), validates current status + actor, optionally enforces preconditions (48h window), applies side effects (refund, stock, `delivered_at`, reasons), and updates the status — all in a single `prisma.$transaction`.

## API

All endpoints return JSON. Error shape is always `{ "error": "<message>" }`. Auth endpoints expect `Authorization: Bearer <supabase_access_token>`.

### Public / customer

| Method | Path | Auth | Controller | Contract |
| --- | --- | --- | --- | --- |
| GET | `/products` | public | `productsController.getProducts` | `{ items: Product[] }`, ordered by `type, name`. Filters `archived_at IS NULL`. |
| GET | `/me` | user | `meController.getMe` | `{ user: { id, email, displayName, balance, role } }` |
| POST | `/me/clicks` | user | `meController.flushClicks` | Body `{ delta: int > 0, elapsedMs: int > 0 }`. Credits up to `floor(effectiveElapsedMs / 1000) * 10 + 20` to `users.balance` (silently caps on excess), updates `last_click_flush_at`. Returns `{ balance, credited }`. 400 on invalid body. |
| GET | `/cart` | user | `cartController.getCart` | `{ items: (CartItem & { product })[] }` |
| PUT | `/cart/items/:productId` | user | `cartController.upsertCartItem` | Body `{ quantity: int >= 0 }`; `0` deletes (204). Unknown product → 404. |
| DELETE | `/cart` | user | `cartController.deleteCart` | 204 |
| POST | `/cart/merge` | user | `cartController.mergeCart` | Body `[{ productId, quantity }]`; additive merge with existing, then replace cart in one transaction. Returns hydrated `{ items }`. |
| GET | `/orders` | user | `orderController.listMyOrders` | `{ orders: (Order & { items })[] }`, newest first. Response now includes `deliveredAt`, `requestReason`, `decisionReason`. |
| POST | `/orders` | user | `orderController.createOrder` | Body `{ addressId: uuid }` — required. Atomic. Loads the address inside the transaction, verifies it belongs to the caller, and copies its six fields onto the new order row. 201 with order + items. 400 missing `addressId` / empty cart. 402 insufficient balance. 403 `addressId` not owned by caller. 404 `addressId` does not exist. 409 insufficient stock. |
| GET | `/me/addresses` | user | `addressesController.listAddresses` | `{ addresses: Address[] }`, newest first. |
| POST | `/me/addresses` | user | `addressesController.createAddress` | Body `{ line1, line2?, city, state, postalCode, country }`. Strings trimmed; required fields non-empty. 201 `{ address }`. 400 on invalid field. |
| PATCH | `/me/addresses/:id` | user | `addressesController.updateAddress` | Partial body of the above. 200 `{ address }`. 400 invalid field, 403 wrong owner, 404 missing. |
| DELETE | `/me/addresses/:id` | user | `addressesController.deleteAddress` | 204. 403 wrong owner, 404 missing. Past orders retain their snapshot. |
| POST | `/orders/:id/cancel` | user | `orderController.userCancel` | Body `{ reason?: string }`. From `confirmed` → `cancelled` (refund + stock). From `processing` → `cancel_requested`. 403 if not the owner. 404 missing. 409 invalid transition. |
| POST | `/orders/:id/return` | user | `orderController.userReturn` | Body `{ reason?: string }`. From `delivered` → `return_requested` if within 48h of `deliveredAt`. 403 / 404 / 409 as above; 409 also on expired window. |

### Admin

All admin routes are behind `requireAuth → requireAdmin`.

| Method | Path | Controller | Contract |
| --- | --- | --- | --- |
| GET | `/admin/orders` | `adminOrdersController.listAllOrders` | Query `?status=<OrderStatus>`. Newest first. 400 on invalid status. |
| GET | `/admin/orders/:id` | `adminOrdersController.getOrder` | Single order with items + user (including balance). 404 missing. |
| POST | `/admin/orders/:id/transition` | `adminOrdersController.transitionOrder` | Body `{ action, reason? }`. `action ∈ { setProcessing, setShipped, setDelivered, approveCancel, denyCancel, approveReturn, denyReturn, forceCancel, forceReturn }`. Delegates to `services/orderStateMachine.transition`. 400 unknown action / missing required reason, 404 missing order, 409 invalid transition / expired window. |
| GET | `/admin/products` | `adminProductsController.listProducts` | Query `?includeArchived=true` to include archived. Newest first. |
| POST | `/admin/products` | `adminProductsController.createProduct` | Body `{ name, description, imageUrl, type, price, stock }`. 201 with product. 400 on validation failure. |
| PATCH | `/admin/products/:id` | `adminProductsController.updateProduct` | Partial body of the above (same validators, optional fields). Works on archived products (editing history is fine). 404 missing. |
| POST | `/admin/products/:id/archive` | `adminProductsController.archiveProduct` | Sets `archived_at = now()`. 404 missing. |
| POST | `/admin/products/:id/unarchive` | `adminProductsController.unarchiveProduct` | Clears `archived_at`. 404 missing. |
| GET | `/admin/users` | `adminUsersController.listUsers` | `{ users: { id, displayName, role, balance, createdAt, orderCount }[] }`. Newest first. |
| GET | `/admin/users/:id` | `adminUsersController.getUser` | User with nested `orders[]` (each with its items). 404 missing. |
| PATCH | `/admin/users/:id/role` | `adminUsersController.updateRole` | Body `{ role: 'customer' \| 'admin' }`. Guards: 409 if the target is the acting admin (self-demotion), 409 if applying the change would leave zero admins (counted inside the same tx). |
| POST | `/admin/users/:id/balance` | `adminUsersController.adjustBalance` | Body `{ delta: integer }` (signed, non-zero). Row-locks the target user (`SELECT balance … FOR UPDATE`). 409 if the result would be negative. |

Routes are mounted in [`backend/server.js`](../backend/server.js):

```js
app.use('/products', productsRoutes);
app.use('/me', requireAuth, meRoutes);
app.use('/orders', requireAuth, orderRoutes);
app.use('/cart', requireAuth, cartRoutes);
app.use('/admin', requireAuth, requireAdmin, adminRoutes);
```

`requireAuth` must come before `requireAdmin`. `adminRoutes.js` in turn mounts `/orders` routes inline and `/products` + `/users` via sub-routers (`adminProductsRoutes.js`, `adminUsersRoutes.js`).
