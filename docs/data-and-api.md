# Data & API reference

Condensed reference for the Prisma schema and the HTTP surface. For the *why* behind these decisions (cascade choices, the absent `pending` order state, the YAGNI list), see [`superpowers/specs/2026-04-20-database-schema-design.md`](superpowers/specs/2026-04-20-database-schema-design.md).

## Schema

Source of truth: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

### Enums

- `ProductType` — `bread | pastry | cake | cookie | drink`
- `OrderStatus` — `confirmed | cancelled` (no `pending`: order creation is one atomic transaction)
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

**`products`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `name`, `description`, `image_url` | text | all NOT NULL |
| `type` | product_type | indexed |
| `price` | int | `CHECK (price >= 0)`; integer points |
| `stock` | int | default 0; `CHECK (stock >= 0)`; decremented atomically at checkout, restored on admin cancel |
| `created_at`, `updated_at` | timestamptz | |

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

Index: `(user_id, created_at DESC)` for the "my orders" listing.

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
- **Stock accounting.** `products.stock` is decremented inside the `createOrder` transaction via a conditional `UPDATE … WHERE stock >= qty` (zero affected rows → 409, whole transaction rolls back). `cancelOrder` increments it back for each `order_item`. Keep these paired when touching either controller.
- **Profile creation.** `public.users` is created by a DB trigger on `auth.users` insert. API code must not create profile rows itself (would race the trigger).
- **Cascade choices.** Cart rows cascade on product delete (carts are working state). Orders/order items restrict on product/user delete (history must survive).
- **Authorization.** Enforced at the Express layer. RLS is deliberately not used; the backend connects as the Supabase service role.

## API

All endpoints return JSON. Error shape is always `{ "error": "<message>" }`. Auth endpoints expect `Authorization: Bearer <supabase_access_token>`.

| Method | Path | Auth | Controller | Contract |
| --- | --- | --- | --- | --- |
| GET | `/products` | public | `productsController.getProducts` | `{ items: Product[] }`, ordered by `type, name` |
| GET | `/me` | user | `meController.getMe` | `{ user: { id, email, displayName, balance, role } }` |
| GET | `/cart` | user | `cartController.getCart` | `{ items: (CartItem & { product })[] }` |
| PUT | `/cart/items/:productId` | user | `cartController.upsertCartItem` | Body `{ quantity: int >= 0 }`; `0` deletes (204). Unknown product → 404. |
| DELETE | `/cart` | user | `cartController.deleteCart` | 204 |
| POST | `/cart/merge` | user | `cartController.mergeCart` | Body `[{ productId, quantity }]`; additive merge with existing, then replace cart in one transaction. Returns hydrated `{ items }`. |
| GET | `/orders` | user | `orderController.listMyOrders` | `{ orders: (Order & { items })[] }`, newest first |
| POST | `/orders` | user | `orderController.createOrder` | Atomic. 201 with order + items. 400 empty cart. 402 insufficient balance. 409 insufficient stock (message names the product). |
| GET | `/admin/orders` | user + admin | `adminOrdersController.listAllOrders` | All orders, newest first |
| PATCH | `/admin/orders/:id/cancel` | user + admin | `adminOrdersController.cancelOrder` | Refunds balance, restores product stock, flips `status`. 404 missing, 409 already cancelled. |

Routes are mounted in [`backend/server.js`](../backend/server.js):

```js
app.use('/products', productsRoutes);
app.use('/me', requireAuth, meRoutes);
app.use('/orders', requireAuth, orderRoutes);
app.use('/cart', requireAuth, cartRoutes);
app.use('/admin', requireAuth, requireAdmin, adminRoutes);
```

`requireAuth` must come before `requireAdmin`.
