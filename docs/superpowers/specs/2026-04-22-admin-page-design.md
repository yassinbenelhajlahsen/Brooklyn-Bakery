# Admin Page Design

**Date:** 2026-04-22
**Branch:** `feat/admin`
**Status:** Draft — awaiting user review

## Purpose

Add an admin-only page at `/admin` that lets users with the `admin` role manage orders, products, and users. Introduces a full order lifecycle (processing → shipped → delivered) with user-initiated cancel/return request flows and admin approval/denial. Also enables product CRUD (with soft delete) and user role/balance management.

## Scope

### In scope
- Expanded `OrderStatus` enum with 6 new values and the transitions between them
- User-initiated cancel and return request flows with 48-hour return window
- Admin-initiated status transitions, approvals, denials, and force-actions
- Admin page with Orders / Products / Users tabs behind role gating
- Product soft delete via `archivedAt`
- User role changes with last-admin and self-demotion guards
- User point balance adjustments (positive or negative deltas)

### Out of scope (MVP)
- Audit log for admin actions (point adjustments, role changes, state transitions)
- Pagination / search on admin list views
- Email or push notifications
- Partial (per-item) cancellations or returns
- Lost-package handling beyond "admin marks delivered, return flow takes over"

## Data model changes

### `OrderStatus` enum — expand to 8 values

```
confirmed | processing | shipped | delivered
cancel_requested | cancelled
return_requested | returned
```

Style matches existing lowercase enum convention. Terminal states: `cancelled`, `returned`.

### `Order` — add 3 fields

| Field | Type | Purpose |
|---|---|---|
| `deliveredAt` | `DateTime?` | Set when admin transitions `shipped → delivered`. Source of truth for the 48h return window. |
| `requestReason` | `String?` | User's optional reason when initiating a cancel or return. |
| `decisionReason` | `String?` | Admin's reason when denying a request or performing a force-cancel / force-return. |

Two reason columns (not one) so the user's reason isn't overwritten when an admin denies. No audit log in MVP — these columns hold the latest reason of each kind.

### `Product` — add 1 field

| Field | Type | Purpose |
|---|---|---|
| `archivedAt` | `DateTime?` | Soft delete. Archived products are hidden from the public shop but remain visible in historical orders. |

The existing `OrderItem → Product` `onDelete: Restrict` is kept as defense-in-depth.

### `User`
No schema changes. `role` and `balance` already exist.

### Migration
Single Prisma migration that adds the enum values, the three `Order` columns, and the `archivedAt` column. All new columns are nullable. No data backfill required.

## State machine

All order status changes flow through a single module: `backend/services/orderStateMachine.js`.

### Transition table

| From | Action | Actor | → To | Refund pts | Restore stock | Other |
|---|---|---|---|---|---|---|
| `confirmed` | `cancel` | user | `cancelled` | ✅ | ✅ | accepts optional `requestReason` |
| `confirmed` | `setProcessing` | admin | `processing` | — | — | |
| `confirmed` | `forceCancel` | admin | `cancelled` | ✅ | ✅ | stores `decisionReason` |
| `processing` | `requestCancel` | user | `cancel_requested` | — | — | stores `requestReason` |
| `processing` | `setShipped` | admin | `shipped` | — | — | |
| `processing` | `forceCancel` | admin | `cancelled` | ✅ | ✅ | stores `decisionReason` |
| `cancel_requested` | `approveCancel` | admin | `cancelled` | ✅ | ✅ | |
| `cancel_requested` | `denyCancel` | admin | `processing` | — | — | stores `decisionReason` |
| `shipped` | `setDelivered` | admin | `delivered` | — | — | sets `deliveredAt = now()` |
| `delivered` | `requestReturn` | user | `return_requested` | — | — | precondition: `deliveredAt IS NOT NULL` and `now() − deliveredAt ≤ 48h`; stores `requestReason` |
| `delivered` | `forceReturn` | admin | `returned` | ✅ | ❌ | stores `decisionReason` |
| `return_requested` | `approveReturn` | admin | `returned` | ✅ | ❌ | |
| `return_requested` | `denyReturn` | admin | `delivered` | — | — | stores `decisionReason` |

13 transitions total. `shipped` has only one outgoing transition (`setDelivered`) — once shipped, no cancellation path for either user or admin. `cancelled` and `returned` are terminal.

**Refund semantics:**
- **Pre-shipped cancels** (`confirmed`, `processing`, `cancel_requested`) refund points and restore stock.
- **Returns** (from `delivered`, `return_requested`) refund points but do **not** restore stock (baked goods are perishable).
- **Denials** perform no side effects other than writing `decisionReason`.

### `transition()` helper

```
services/orderStateMachine.js
  transition({ orderId, action, actor, reason })
```

Contract:

1. Open `prisma.$transaction`.
2. Row-lock the order (`SELECT status FROM orders WHERE id = $1 FOR UPDATE`).
3. Look up the entry `table[currentStatus][action]`. If absent, throw `409 Invalid transition`.
4. Verify `entry.actor === actor`. If not, throw `403 Forbidden`.
5. Run precondition (e.g., 48h window for `requestReturn`). Throw `409` on violation.
6. Apply side effects inside the same tx:
   - Refund: lock user row, `balance += order.total`
   - Restore stock: for each item, `product.stock += item.quantity`
   - Set `deliveredAt = now()` if applicable
   - Write `requestReason` or `decisionReason` if provided
7. Update `order.status` to the target and return the updated order.

Controllers are thin: they authenticate, pass the action name, return the result. All "is this allowed" logic lives in the table.

### Non-order guards (outside the state machine)

- **Role change** (`customer ↔ admin`):
  - Reject if `targetUserId === actingAdmin.id` → 409 "Admins cannot change their own role"
  - Reject if applying the change would leave zero admins → 409 "Cannot remove the last admin". Counted inside the same tx.
- **Point adjustment:** `balance += delta`, lock user row. Reject if resulting balance < 0 → 409.
- **Product archive:** `archivedAt = now()`. Public product list filters `archivedAt IS NULL`. Admin product list can include archived via `?includeArchived=true`.

## API surface

All admin routes gated by `requireAuth → requireAdmin`.

### User-facing order endpoints (new)

Semantic endpoints — the frontend never names a state-machine action.

| Method | Path | Body | Behavior |
|---|---|---|---|
| `POST` | `/api/orders/:id/cancel` | `{ reason?: string }` | From `confirmed` → `cancelled` (refund + stock). From `processing` → `cancel_requested`. 409 elsewhere. |
| `POST` | `/api/orders/:id/return` | `{ reason?: string }` | From `delivered` → `return_requested` if within 48h of `deliveredAt`. 409 otherwise. |

Both verify `order.userId === req.user.id`. Existing `GET /api/orders` (`listMyOrders`) keeps its shape; responses gain the new fields (`deliveredAt`, `requestReason`, `decisionReason`).

### Admin order endpoints

Single dispatch endpoint — long action list, one caller (the admin UI), maps 1:1 to the state-machine table.

| Method | Path | Body | Behavior |
|---|---|---|---|
| `GET` | `/api/admin/orders` | query: `?status=<enum>` | List all orders, optional status filter. Extends existing `listAllOrders`. |
| `GET` | `/api/admin/orders/:id` | — | Order detail including items + user. |
| `POST` | `/api/admin/orders/:id/transition` | `{ action, reason? }` | `action ∈ { setProcessing, setShipped, setDelivered, approveCancel, denyCancel, approveReturn, denyReturn, forceCancel, forceReturn }`. Delegates to `stateMachine.transition(...)`. |

The existing `PATCH /api/admin/orders/:id/cancel` route is replaced by `forceCancel` via the transition endpoint. Remove the old route.

### Admin product endpoints (new)

| Method | Path | Body | Behavior |
|---|---|---|---|
| `GET` | `/api/admin/products` | query: `?includeArchived=true` | List for admin. Archived hidden by default. |
| `POST` | `/api/admin/products` | `{ name, description, imageUrl, type, price, stock }` | Create. |
| `PATCH` | `/api/admin/products/:id` | partial of above | Edit. Works on archived products too (e.g., fixing a typo in an archived item's name). |
| `POST` | `/api/admin/products/:id/archive` | — | Sets `archivedAt = now()`. |
| `POST` | `/api/admin/products/:id/unarchive` | — | Clears `archivedAt`. |

**Public endpoint change:** `GET /api/products` filters `archivedAt IS NULL`. One-line addition to `productsController.js`.

### Admin user endpoints (new)

| Method | Path | Body | Behavior |
|---|---|---|---|
| `GET` | `/api/admin/users` | — | List users with `id, displayName, role, balance, orderCount`. |
| `GET` | `/api/admin/users/:id` | — | User detail + all their orders (items + status). |
| `PATCH` | `/api/admin/users/:id/role` | `{ role: 'customer' \| 'admin' }` | Guards: self-demotion, last-admin. |
| `POST` | `/api/admin/users/:id/balance` | `{ delta: number }` | Positive or negative. Reject if result < 0. |

### Errors

All endpoints use the existing `httpError(status, message)` + `sendHttpError(res, err)` helpers.

| Code | Cases |
|---|---|
| 400 | Missing required reason on admin deny/force; malformed body |
| 401 | Unauthenticated |
| 403 | User acting on another user's order; non-admin hitting admin route |
| 404 | Order / product / user not found |
| 409 | Invalid transition; expired return window; self-demotion; last-admin; negative balance |

## Backend file layout

```
backend/
  services/
    orderStateMachine.js   (new) — transition table + transition() helper
    orderService.js        — placeOrder stays; cancelOrderById removed (replaced by state machine)
  controllers/
    orderController.js     — add userCancel, userReturn handlers
    adminOrdersController.js — replace cancelOrder with transition dispatcher; extend listAllOrders with filter; add getOrder detail
    adminProductsController.js (new)
    adminUsersController.js    (new)
    productsController.js  — filter archivedAt IS NULL on public list
  routes/
    orderRoutes.js         — add POST /:id/cancel, POST /:id/return
    adminRoutes.js         — mount /orders, /products, /users sub-routers
    adminProductsRoutes.js (new)
    adminUsersRoutes.js    (new)
```

## Frontend structure

### Routing

Add one route in `App.jsx`:

```jsx
<Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
```

`AdminRoute` is a small guard component that reads `useAuth()`: while loading, shows a spinner; if not admin, redirects to `/`. This is UI gating only — the real enforcement is the backend's `requireAdmin` middleware.

### File layout

```
frontend/src/
  pages/
    AdminPage.jsx                    — shell: header, tab nav, active-tab switch

  components/
    StatusBadge.jsx                  — colored pill per OrderStatus (shared: admin + customer orders page)
    ReasonPromptModal.jsx            — shared modal for actions that need a reason (admin denies, user cancel/return requests)

  components/admin/
    AdminRoute.jsx                   — role gate
    OrdersTab.jsx                    — list + filter bar
    OrderDetailDrawer.jsx            — side drawer w/ action buttons per state
    ProductsTab.jsx                  — list + create button
    ProductEditModal.jsx             — create/edit form
    UsersTab.jsx                     — list of users
    UserDetailDrawer.jsx             — role toggle + balance delta + user's orders
    StatusFilter.jsx                 — dropdown used in OrdersTab

  hooks/admin/
    useAdminOrders.js                — list/filter + transition mutation
    useAdminProducts.js              — list + create/edit/archive/unarchive
    useAdminUsers.js                 — list + role change + balance delta

  services/admin/
    adminOrdersService.js            — listOrders, getOrder, transitionOrder
    adminProductsService.js          — list/create/update/archive/unarchive
    adminUsersService.js             — list/detail/updateRole/adjustBalance
```

Mild departure from existing flat `hooks/` and `services/` directories — admin adds enough files that nesting under `admin/` reads better. Services follow the existing `authedFetch` pattern.

### Shared icons

`ProfileMenu.jsx` currently defines `PackageIcon` and `UserIcon` inline. Extract them so the admin tab nav can reuse them:

```
frontend/src/components/icons/
  PackageIcon.jsx   — used by ProfileMenu "Order History" + admin Orders tab
  UserIcon.jsx      — used by ProfileMenu login button + admin Users tab
```

- `ProfileMenu.jsx` drops the inline definitions and imports from `components/icons/`.
- `OrdersTab` / `UsersTab` (and the tab nav in `AdminPage`) import from the same location.
- Other inline icons in `ProfileMenu` (`LogoutIcon`, `StarIcon`) stay inline — out of scope.
- `ProductsTab` picks its own icon; choice left to implementation.

### `AdminPage.jsx` shape

```jsx
const TABS = [
  { key: 'orders',   label: 'Orders',   Component: OrdersTab },
  { key: 'products', label: 'Products', Component: ProductsTab },
  { key: 'users',    label: 'Users',    Component: UsersTab },
]

export default function AdminPage() {
  const [active, setActive] = useState('orders')
  const Active = TABS.find(t => t.key === active).Component
  return (
    <main className="...">
      <header>Admin</header>
      <nav>{/* tab buttons */}</nav>
      <Active />
    </main>
  )
}
```

Tab state is component-local (`useState`), not URL-synced, to match the single-page direction. Adding `?tab=orders` later is a small patch if it's wanted.

### Tabs

**OrdersTab.** Table of all orders: short id, customer, total, `StatusBadge`, created date. Top bar has a `StatusFilter` dropdown. Click a row → `OrderDetailDrawer` opens with:
- Order summary + items
- `requestReason` / `decisionReason` if present
- Action buttons rendered conditionally by current status via an `allowedAdminActions(status)` helper that mirrors the state-machine table
- Actions that need a reason (`denyCancel`, `denyReturn`, `forceCancel`, `forceReturn`) open `ReasonPromptModal` first

**ProductsTab.** Table: image, name, type, price, stock, archived flag. Top bar has "New product" button. Row click → `ProductEditModal`. Archive / unarchive as inline row actions.

**UsersTab.** Table: displayName, role, balance, order count. Row click → `UserDetailDrawer`:
- Role toggle (disabled when the target is the acting admin; server still enforces)
- Balance delta input (`+10` / `-5`) with submit button; validation blocks submit on would-be-negative balance
- Collapsed list of the user's orders with status badges and dates

### Shared concerns

- **Balance refresh:** when a transition refunds points to a user, the admin-side user detail drawer refetches to pick up the new balance. The admin's own header balance is unaffected.
- **Error surfacing:** hooks expose `{ error }`; tabs render an inline banner on failure, matching the existing `CartDrawer` / `CheckoutPage` pattern.

### Customer-side additions

The frontend currently has no customer-facing orders view — only `placeOrder` is wired up. A new page is needed for users to see and act on their own orders.

- **New page:** `pages/MyOrdersPage.jsx` at route `/orders`, gated to authenticated users (redirect to login if not signed in).
- **Hook + service:** `hooks/useMyOrders.js` and `services/myOrdersService.js` (extends the existing `services/orderService.js` or adds alongside it — decided when writing the plan).
- **Status badges** and **reason prompt modal** reused from `components/StatusBadge.jsx` and `components/ReasonPromptModal.jsx` (shared with the admin surface).
- **Conditional action buttons** per order:
  - `confirmed` → "Cancel order" (direct — calls `POST /api/orders/:id/cancel` with no reason modal; we keep the low-friction path)
  - `processing` → "Request cancellation" (opens `ReasonPromptModal`)
  - `delivered` → "Request return" (opens `ReasonPromptModal`); disabled with tooltip "Return period expired" when `>48h` since `deliveredAt`
- **Entry point:** the existing "Order History" `MenuItem` in `ProfileMenu.jsx` becomes a `Link`/`navigate` to `/orders` (it currently just closes the menu and does nothing else). No new menu item.

## UI implementation

All new admin UI components (`AdminPage`, `OrdersTab`, `ProductsTab`, `UsersTab`, `OrderDetailDrawer`, `UserDetailDrawer`, `ProductEditModal`, `StatusFilter`, `AdminRoute`) are to be built using the **`bencium-impact-designer`** skill. This applies to the visual design and component structure of the admin surface.

Shared components (`StatusBadge`, `ReasonPromptModal`) and the customer-side additions (`MyOrdersPage`, its action buttons) should match the existing customer UI style — Tailwind, matching the visual language of `CartDrawer` / `CheckoutPage` — and do not need the skill.

## Error handling & edge cases

- **Invalid transition** (action not in table for current status): 409 "Invalid transition: <from> → <to>"
- **Return window expired:** 409 "Return window has expired"
- **Wrong user on user endpoint:** 403 "Forbidden"
- **Self-demotion:** 409 "Admins cannot change their own role"
- **Last-admin removal:** 409 "Cannot remove the last admin"
- **Negative balance:** 409 "Balance cannot go below 0"
- **Missing reason on deny/force:** 400 "Reason required"
- **Terminal state** (cancelled / returned): falls out of Invalid transition — 409.
- **Data anomaly** (status `delivered`, `deliveredAt IS NULL`): `requestReturn` precondition also requires `deliveredAt IS NOT NULL`; throw 409 defensively.
- **Stale status in request:** state machine reads `currentStatus` inside the locked tx, not from the client.

### Concurrency

- Order transitions lock the order row (`SELECT status FROM orders WHERE id = $1 FOR UPDATE`) inside the tx.
- Refunds and balance deltas lock the target user row (same pattern as `placeOrder`).
- Last-admin check: update role, then `SELECT count(*) FROM users WHERE role = 'admin'` inside the same tx; if zero, throw to roll back.

### Frontend UX edge cases

- `delivered` order past 48h: return button disabled with tooltip.
- Self-role toggle: disabled in `UserDetailDrawer` when target is the acting admin.
- 403 from any admin endpoint mid-session (admin demoted in another tab): redirect to `/`.

## Out of scope (reiterated)

- Admin audit log
- Pagination / search on admin list views
- Email or push notifications
- Partial cancel / return
