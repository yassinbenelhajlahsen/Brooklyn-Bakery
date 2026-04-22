# Admin Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin page at `/admin` with Orders/Products/Users tabs; introduce an order-lifecycle state machine (processing → shipped → delivered + cancel/return flows with a 48h return window); add a customer `/orders` page wired to user-initiated cancel and return.

**Architecture:** One centralized state machine (`orderStateMachine.js`) owns all order status transitions with a table-driven design and a single `transition()` helper that handles row-locking, refunds, and stock restoration inside a Prisma `$transaction`. Controllers stay thin: user-facing endpoints call `transition` with `actor: 'user'`, admin endpoints with `actor: 'admin'`. Frontend is a single `/admin` route with internal tabs (no sub-routes), modular files split under `/admin` subdirectories for components, hooks, and services. Admin UI components are built via the `bencium-impact-designer` skill; shared/customer components match existing Tailwind style.

**Tech Stack:** Prisma 5 + Postgres (Supabase) on the backend; React/Vite + Tailwind + react-router-dom on the frontend; Express 5 + ESM; `node:test` for backend tests (pure functions only — no test DB setup in this project).

**Spec reference:** `docs/superpowers/specs/2026-04-22-admin-page-design.md`

---

## File Structure

### Backend — new files

| Path | Responsibility |
|---|---|
| `backend/services/orderStateMachine.js` | Transition table, `resolveTransition()` pure lookup, `checkReturnWindow()` predicate, `transition()` I/O wrapper |
| `backend/controllers/adminProductsController.js` | Admin product list/create/update/archive/unarchive |
| `backend/controllers/adminUsersController.js` | Admin user list/detail/role-change/balance-delta |
| `backend/routes/adminProductsRoutes.js` | Sub-router for admin products |
| `backend/routes/adminUsersRoutes.js` | Sub-router for admin users |
| `backend/tests/orderStateMachine.test.js` | Unit tests for `resolveTransition` + `checkReturnWindow` |

### Backend — modified files

| Path | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add enum values, `Order.deliveredAt/requestReason/decisionReason`, `Product.archivedAt` |
| `backend/services/orderService.js` | Remove `cancelOrderById` (replaced by state machine); keep `placeOrder` untouched |
| `backend/controllers/orderController.js` | Add `userCancel`, `userReturn` handlers |
| `backend/controllers/adminOrdersController.js` | Replace `cancelOrder` with transition dispatcher; extend `listAllOrders` with status filter; add `getOrder` detail |
| `backend/controllers/productsController.js` | Filter `archivedAt IS NULL` on public list |
| `backend/routes/orderRoutes.js` | Add `POST /:id/cancel`, `POST /:id/return` |
| `backend/routes/adminRoutes.js` | Mount `/orders`, `/products`, `/users` sub-routers; remove the old PATCH cancel route |

### Frontend — new files

| Path | Responsibility |
|---|---|
| `frontend/src/pages/AdminPage.jsx` | Shell with internal tab switch |
| `frontend/src/pages/MyOrdersPage.jsx` | Customer-facing orders page at `/orders` |
| `frontend/src/components/StatusBadge.jsx` | Colored pill per `OrderStatus` (shared) |
| `frontend/src/components/ReasonPromptModal.jsx` | Shared modal for text-reason prompts |
| `frontend/src/components/icons/PackageIcon.jsx` | Extracted from ProfileMenu |
| `frontend/src/components/icons/UserIcon.jsx` | Extracted from ProfileMenu |
| `frontend/src/components/admin/AdminRoute.jsx` | Role gate |
| `frontend/src/components/admin/OrdersTab.jsx` | Admin orders list + filter |
| `frontend/src/components/admin/OrderDetailDrawer.jsx` | Side drawer with conditional action buttons |
| `frontend/src/components/admin/StatusFilter.jsx` | Dropdown for `OrdersTab` |
| `frontend/src/components/admin/ProductsTab.jsx` | Product list + create |
| `frontend/src/components/admin/ProductEditModal.jsx` | Create/edit form |
| `frontend/src/components/admin/UsersTab.jsx` | User list |
| `frontend/src/components/admin/UserDetailDrawer.jsx` | Role toggle + balance delta + user's orders |
| `frontend/src/hooks/useMyOrders.js` | Fetch + cancel + return for the current user |
| `frontend/src/hooks/admin/useAdminOrders.js` | List/filter + transition |
| `frontend/src/hooks/admin/useAdminProducts.js` | List + CRUD + archive/unarchive |
| `frontend/src/hooks/admin/useAdminUsers.js` | List + detail + role change + balance delta |
| `frontend/src/services/admin/adminOrdersService.js` | Fetch wrappers for admin orders |
| `frontend/src/services/admin/adminProductsService.js` | Fetch wrappers for admin products |
| `frontend/src/services/admin/adminUsersService.js` | Fetch wrappers for admin users |

### Frontend — modified files

| Path | Change |
|---|---|
| `frontend/src/App.jsx` | Add `/admin` and `/orders` routes |
| `frontend/src/components/ProfileMenu.jsx` | Import icons from `/components/icons/`; wire "Order History" to `/orders`; add "Admin" item for admins |
| `frontend/src/services/orderService.js` | Add `listMyOrders`, `userCancelOrder`, `userReturnOrder` |

---

# Phase 1 — Data model & migration

### Task 1: Extend the Prisma schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Edit the `OrderStatus` enum**

Replace the current enum block with:

```prisma
enum OrderStatus {
  confirmed
  processing
  shipped
  delivered
  cancel_requested
  cancelled
  return_requested
  returned

  @@map("order_status")
}
```

- [ ] **Step 2: Edit the `Order` model — add 3 fields**

Add these inside the `Order` model, after the existing `createdAt` line:

```prisma
  deliveredAt    DateTime? @map("delivered_at") @db.Timestamptz(6)
  requestReason  String?   @map("request_reason")
  decisionReason String?   @map("decision_reason")
```

- [ ] **Step 3: Edit the `Product` model — add 1 field**

Add inside the `Product` model after `updatedAt`:

```prisma
  archivedAt DateTime? @map("archived_at") @db.Timestamptz(6)
```

- [ ] **Step 4: Generate and apply migration**

Run (from `backend/`):

```bash
npm run db:migrate -- --name admin_order_lifecycle_and_product_archive
```

Expected: Prisma creates a new migration directory under `backend/prisma/migrations/`, applies it, and regenerates the client. Migration contains `ALTER TYPE order_status ADD VALUE`, `ALTER TABLE orders ADD COLUMN …`, `ALTER TABLE products ADD COLUMN …`.

- [ ] **Step 5: Verify Prisma client regenerated**

Run:

```bash
node -e "import('@prisma/client').then(m => console.log(Object.values(m.OrderStatus)))"
```

Expected output (array order may vary): `[ 'confirmed', 'processing', 'shipped', 'delivered', 'cancel_requested', 'cancelled', 'return_requested', 'returned' ]`

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(db): extend OrderStatus enum and add order/product lifecycle fields"
```

---

# Phase 2 — Order state machine (backend core)

### Task 2: Write the state-machine unit tests

**Files:**
- Create: `backend/tests/orderStateMachine.test.js`

- [ ] **Step 1: Write the failing test file**

Create `backend/tests/orderStateMachine.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTransition, checkReturnWindow } from '../services/orderStateMachine.js';

test('resolveTransition: valid user cancel from confirmed', () => {
  const entry = resolveTransition('confirmed', 'cancel', 'user');
  assert.equal(entry.to, 'cancelled');
  assert.equal(entry.refundPoints, true);
  assert.equal(entry.restoreStock, true);
});

test('resolveTransition: valid admin setShipped from processing', () => {
  const entry = resolveTransition('processing', 'setShipped', 'admin');
  assert.equal(entry.to, 'shipped');
  assert.equal(entry.refundPoints, false);
});

test('resolveTransition: forceCancel from shipped is NOT allowed (removed path)', () => {
  assert.throws(
    () => resolveTransition('shipped', 'forceCancel', 'admin'),
    (err) => err.http === 409,
  );
});

test('resolveTransition: wrong actor is 403', () => {
  assert.throws(
    () => resolveTransition('confirmed', 'setProcessing', 'user'),
    (err) => err.http === 403,
  );
});

test('resolveTransition: terminal status (cancelled) has no outgoing transitions', () => {
  assert.throws(
    () => resolveTransition('cancelled', 'setProcessing', 'admin'),
    (err) => err.http === 409,
  );
});

test('resolveTransition: unknown action is 409', () => {
  assert.throws(
    () => resolveTransition('confirmed', 'doesNotExist', 'admin'),
    (err) => err.http === 409,
  );
});

test('resolveTransition: denyCancel from cancel_requested returns to processing and requires reason', () => {
  const entry = resolveTransition('cancel_requested', 'denyCancel', 'admin');
  assert.equal(entry.to, 'processing');
  assert.equal(entry.requiresReason, true);
});

test('resolveTransition: approveReturn refunds but does NOT restore stock', () => {
  const entry = resolveTransition('return_requested', 'approveReturn', 'admin');
  assert.equal(entry.to, 'returned');
  assert.equal(entry.refundPoints, true);
  assert.equal(entry.restoreStock, false);
});

test('checkReturnWindow: within 48h returns true', () => {
  const now = new Date('2026-04-22T12:00:00Z');
  const deliveredAt = new Date('2026-04-21T12:00:00Z'); // 24h earlier
  assert.equal(checkReturnWindow(deliveredAt, now), true);
});

test('checkReturnWindow: beyond 48h returns false', () => {
  const now = new Date('2026-04-25T12:00:00Z');
  const deliveredAt = new Date('2026-04-22T00:00:00Z'); // 84h earlier
  assert.equal(checkReturnWindow(deliveredAt, now), false);
});

test('checkReturnWindow: exactly 48h returns true (inclusive)', () => {
  const now = new Date('2026-04-22T12:00:00Z');
  const deliveredAt = new Date('2026-04-20T12:00:00Z');
  assert.equal(checkReturnWindow(deliveredAt, now), true);
});

test('checkReturnWindow: null deliveredAt returns false', () => {
  const now = new Date('2026-04-22T12:00:00Z');
  assert.equal(checkReturnWindow(null, now), false);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run from `backend/`:

```bash
npm test -- --test-name-pattern='resolveTransition|checkReturnWindow'
```

Expected: FAIL with `Cannot find module '../services/orderStateMachine.js'` or similar.

---

### Task 3: Implement the state-machine module

**Files:**
- Create: `backend/services/orderStateMachine.js`

- [ ] **Step 1: Write the implementation**

Create `backend/services/orderStateMachine.js`:

```js
import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';

const RETURN_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Keyed by current status. Each inner key is an action name.
 * Fields:
 *   to            - target status
 *   actor         - 'user' | 'admin'
 *   refundPoints  - refund order.total to user.balance
 *   restoreStock  - increment product.stock for each order item
 *   setDeliveredAt- stamp order.deliveredAt = now()
 *   requiresReason- a text reason must be provided by the actor
 *   requiresWindow- enforce the 48h post-delivered window
 */
export const transitions = {
  confirmed: {
    cancel:        { to: 'cancelled',  actor: 'user',  refundPoints: true,  restoreStock: true,  requiresReason: false },
    setProcessing: { to: 'processing', actor: 'admin', refundPoints: false, restoreStock: false, requiresReason: false },
    forceCancel:   { to: 'cancelled',  actor: 'admin', refundPoints: true,  restoreStock: true,  requiresReason: true  },
  },
  processing: {
    requestCancel: { to: 'cancel_requested', actor: 'user',  refundPoints: false, restoreStock: false, requiresReason: false },
    setShipped:    { to: 'shipped',          actor: 'admin', refundPoints: false, restoreStock: false, requiresReason: false },
    forceCancel:   { to: 'cancelled',        actor: 'admin', refundPoints: true,  restoreStock: true,  requiresReason: true  },
  },
  cancel_requested: {
    approveCancel: { to: 'cancelled',  actor: 'admin', refundPoints: true,  restoreStock: true,  requiresReason: false },
    denyCancel:    { to: 'processing', actor: 'admin', refundPoints: false, restoreStock: false, requiresReason: true  },
  },
  shipped: {
    setDelivered:  { to: 'delivered', actor: 'admin', refundPoints: false, restoreStock: false, setDeliveredAt: true, requiresReason: false },
  },
  delivered: {
    requestReturn: { to: 'return_requested', actor: 'user',  refundPoints: false, restoreStock: false, requiresReason: false, requiresWindow: true },
    forceReturn:   { to: 'returned',         actor: 'admin', refundPoints: true,  restoreStock: false, requiresReason: true  },
  },
  return_requested: {
    approveReturn: { to: 'returned',  actor: 'admin', refundPoints: true,  restoreStock: false, requiresReason: false },
    denyReturn:    { to: 'delivered', actor: 'admin', refundPoints: false, restoreStock: false, requiresReason: true  },
  },
  cancelled: {},
  returned: {},
};

export function resolveTransition(currentStatus, action, actor) {
  const fromEntries = transitions[currentStatus];
  if (!fromEntries) {
    throw httpError(409, `Invalid transition: unknown status "${currentStatus}"`);
  }
  const entry = fromEntries[action];
  if (!entry) {
    throw httpError(409, `Invalid transition: ${currentStatus} -> ${action}`);
  }
  if (entry.actor !== actor) {
    throw httpError(403, 'Forbidden');
  }
  return entry;
}

export function checkReturnWindow(deliveredAt, now = new Date()) {
  if (!deliveredAt) return false;
  const delivered = deliveredAt instanceof Date ? deliveredAt : new Date(deliveredAt);
  return (now.getTime() - delivered.getTime()) <= RETURN_WINDOW_MS;
}

export async function transition({ orderId, action, actor, reason }) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`
      SELECT id,
             user_id      AS "userId",
             status,
             total,
             delivered_at AS "deliveredAt"
      FROM orders
      WHERE id = ${orderId}::uuid
      FOR UPDATE
    `;
    if (locked.length === 0) throw httpError(404, 'Order not found');
    const order = locked[0];

    const entry = resolveTransition(order.status, action, actor);

    if (entry.requiresReason && !reason?.trim()) {
      throw httpError(400, 'Reason required');
    }
    if (entry.requiresWindow && !checkReturnWindow(order.deliveredAt)) {
      throw httpError(409, 'Return window has expired');
    }

    if (entry.refundPoints) {
      await tx.$queryRaw`SELECT balance FROM users WHERE id = ${order.userId}::uuid FOR UPDATE`;
      await tx.user.update({
        where: { id: order.userId },
        data: { balance: { increment: order.total } },
      });
    }

    if (entry.restoreStock) {
      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    const data = { status: entry.to };
    if (entry.setDeliveredAt) data.deliveredAt = new Date();
    if (reason?.trim()) {
      if (actor === 'user') data.requestReason = reason.trim();
      else data.decisionReason = reason.trim();
    }

    return tx.order.update({
      where: { id: orderId },
      data,
      include: {
        items: { include: { product: { select: { name: true, imageUrl: true } } } },
        user:  { select: { id: true, displayName: true } },
      },
    });
  });
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run from `backend/`:

```bash
npm test -- --test-name-pattern='resolveTransition|checkReturnWindow'
```

Expected: all 12 tests PASS.

- [ ] **Step 3: Remove `cancelOrderById` from `orderService.js`**

Open `backend/services/orderService.js` and delete the entire `export async function cancelOrderById(orderId)` function (and its imports of `OrderStatus` if unused afterwards). `placeOrder` stays untouched.

- [ ] **Step 4: Run full backend test suite**

Run:

```bash
npm test
```

Expected: all pre-existing tests still pass, plus the new state-machine tests. No references to `cancelOrderById` left in the codebase (search: `rg cancelOrderById backend/ --fixed-strings` → no results).

- [ ] **Step 5: Commit**

```bash
git add backend/services/orderStateMachine.js backend/tests/orderStateMachine.test.js backend/services/orderService.js
git commit -m "feat(backend): add order state machine with transition table and pure resolvers"
```

---

# Phase 3 — User-facing order endpoints

### Task 4: Add user-initiated cancel endpoint

**Files:**
- Modify: `backend/controllers/orderController.js`
- Modify: `backend/routes/orderRoutes.js`

- [ ] **Step 1: Add `userCancel` handler to `orderController.js`**

Add these imports at the top (merge with existing Prisma/httpError imports):

```js
import { transition } from '../services/orderStateMachine.js';
```

Then append this handler after `listMyOrders`:

```js
export async function userCancel(req, res) {
    try {
        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
            select: { userId: true, status: true },
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        const action = order.status === 'confirmed' ? 'cancel' : 'requestCancel';
        const updated = await transition({
            orderId: req.params.id,
            action,
            actor: 'user',
            reason: req.body?.reason,
        });
        res.json(updated);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('userCancel failed:', err);
        res.status(500).json({ error: 'Cancel failed' });
    }
}
```

Note: the pre-read is only used to pick the action name for the semantic endpoint. The authoritative status check still happens inside `transition()` under the row lock.

- [ ] **Step 2: Wire the route**

Edit `backend/routes/orderRoutes.js` — add the import and route. Check existing contents first; then append inside the existing router definition:

```js
import { userCancel } from '../controllers/orderController.js';
// ... existing imports

router.post('/:id/cancel', userCancel);
```

- [ ] **Step 3: Manual verification**

Start the dev server (`npm run dev` in `backend/`), then:

1. Using an existing `confirmed` order for an authenticated user, `POST /orders/:id/cancel` with empty body → expect 200 and `status: "cancelled"`, points refunded, stock restored.
2. Move another order to `processing` via DB (or wait for Task 6 to do it via the admin endpoint). `POST /orders/:id/cancel` → expect `status: "cancel_requested"`, no refund.
3. Another user's order ID → expect 403.
4. Non-existent order → expect 404.

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/orderController.js backend/routes/orderRoutes.js
git commit -m "feat(orders): add user-initiated cancel endpoint routing to state machine"
```

---

### Task 5: Add user-initiated return endpoint

**Files:**
- Modify: `backend/controllers/orderController.js`
- Modify: `backend/routes/orderRoutes.js`

- [ ] **Step 1: Add `userReturn` handler**

Append after `userCancel` in `orderController.js`:

```js
export async function userReturn(req, res) {
    try {
        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
            select: { userId: true },
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        const updated = await transition({
            orderId: req.params.id,
            action: 'requestReturn',
            actor: 'user',
            reason: req.body?.reason,
        });
        res.json(updated);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('userReturn failed:', err);
        res.status(500).json({ error: 'Return request failed' });
    }
}
```

- [ ] **Step 2: Wire the route**

In `backend/routes/orderRoutes.js`:

```js
import { userCancel, userReturn } from '../controllers/orderController.js';

router.post('/:id/return', userReturn);
```

- [ ] **Step 3: Manual verification**

With a `delivered` order whose `deliveredAt` is within 48h: `POST /orders/:id/return` with `{ "reason": "wrong item" }` → expect 200 and `status: "return_requested"`, `requestReason` populated. Then set `deliveredAt` to 3 days ago (via DB) and retry → expect 409 "Return window has expired".

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/orderController.js backend/routes/orderRoutes.js
git commit -m "feat(orders): add user-initiated return-request endpoint"
```

---

# Phase 4 — Admin orders endpoints

### Task 6: Replace admin order controller with list-filter + detail + transition dispatch

**Files:**
- Modify: `backend/controllers/adminOrdersController.js`
- Modify: `backend/routes/adminRoutes.js`

- [ ] **Step 1: Rewrite `adminOrdersController.js`**

Replace the entire file contents with:

```js
import { prisma } from '../lib/prisma.js';
import { sendHttpError, httpError } from '../lib/httpError.js';
import { transition } from '../services/orderStateMachine.js';

const STATUS_VALUES = new Set([
    'confirmed', 'processing', 'shipped', 'delivered',
    'cancel_requested', 'cancelled', 'return_requested', 'returned',
]);

export async function listAllOrders(req, res) {
    const { status } = req.query;
    if (status && !STATUS_VALUES.has(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
    }
    const orders = await prisma.order.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
            user: { select: { id: true, displayName: true } },
            items: { include: { product: { select: { name: true, imageUrl: true } } } },
        },
    });
    res.json({ orders });
}

export async function getOrder(req, res) {
    const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
            user: { select: { id: true, displayName: true, balance: true } },
            items: { include: { product: { select: { name: true, imageUrl: true } } } },
        },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
}

const ADMIN_ACTIONS = new Set([
    'setProcessing', 'setShipped', 'setDelivered',
    'approveCancel', 'denyCancel',
    'approveReturn', 'denyReturn',
    'forceCancel', 'forceReturn',
]);

export async function transitionOrder(req, res) {
    try {
        const { action, reason } = req.body || {};
        if (!ADMIN_ACTIONS.has(action)) {
            throw httpError(400, 'Unknown admin action');
        }
        const updated = await transition({
            orderId: req.params.id,
            action,
            actor: 'admin',
            reason,
        });
        res.json(updated);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('transitionOrder failed:', err);
        res.status(500).json({ error: 'Transition failed' });
    }
}
```

- [ ] **Step 2: Update admin order routes**

Edit `backend/routes/adminRoutes.js`. Replace the existing router block with:

```js
import express from 'express';
import { listAllOrders, getOrder, transitionOrder } from '../controllers/adminOrdersController.js';

const router = express.Router();

router.get('/orders', listAllOrders);
router.get('/orders/:id', getOrder);
router.post('/orders/:id/transition', transitionOrder);

export default router;
```

Leave the product/user sub-router mounts for Tasks 8 and 9.

- [ ] **Step 3: Manual verification**

With admin creds:

1. `GET /admin/orders` → lists all orders.
2. `GET /admin/orders?status=confirmed` → only confirmed.
3. `GET /admin/orders?status=bogus` → 400.
4. `GET /admin/orders/:id` → order detail.
5. `POST /admin/orders/:id/transition` body `{ "action": "setProcessing" }` on a confirmed order → 200, status moves to `processing`.
6. Same endpoint on an already-`processing` order → 409 "Invalid transition".
7. `{ "action": "denyCancel" }` without `reason` on a `cancel_requested` order → 400 "Reason required".

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/adminOrdersController.js backend/routes/adminRoutes.js
git commit -m "feat(admin): replace admin order controller with filter+detail+transition dispatch"
```

---

# Phase 5 — Admin products endpoints

### Task 7: Add soft-delete filter to public product list

**Files:**
- Modify: `backend/controllers/productsController.js`

- [ ] **Step 1: Read the current controller**

Run `cat backend/controllers/productsController.js`. Identify the `findMany` call for the public product list.

- [ ] **Step 2: Add the `archivedAt: null` filter**

In the public list handler, set the `where` clause:

```js
where: { archivedAt: null, /* ...existing filters like type if present... */ }
```

If the handler has no existing `where`, add `where: { archivedAt: null }`. Preserve any existing type/search filters by merging.

- [ ] **Step 3: Manual verification**

Mark a product archived via Prisma Studio (`npm run db:studio`): set `archived_at` to any timestamp. Then `GET /products` → archived product is absent.

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/productsController.js
git commit -m "feat(products): hide archived products from public list"
```

---

### Task 8: Admin products controller + routes

**Files:**
- Create: `backend/controllers/adminProductsController.js`
- Create: `backend/routes/adminProductsRoutes.js`
- Modify: `backend/routes/adminRoutes.js`

- [ ] **Step 1: Create `adminProductsController.js`**

```js
import { prisma } from '../lib/prisma.js';
import { sendHttpError, httpError } from '../lib/httpError.js';

const PRODUCT_TYPES = new Set(['bread', 'pastry', 'cake', 'cookie', 'drink']);

function validateProductPayload(body, { partial = false } = {}) {
    const errors = [];
    const fields = ['name', 'description', 'imageUrl', 'type', 'price', 'stock'];
    for (const f of fields) {
        if (!partial && body[f] === undefined) errors.push(`Missing ${f}`);
    }
    if (body.type !== undefined && !PRODUCT_TYPES.has(body.type)) errors.push('Invalid type');
    if (body.price !== undefined && (!Number.isInteger(body.price) || body.price < 0)) errors.push('Invalid price');
    if (body.stock !== undefined && (!Number.isInteger(body.stock) || body.stock < 0)) errors.push('Invalid stock');
    if (errors.length) throw httpError(400, errors.join('; '));
}

export async function listProducts(req, res) {
    const includeArchived = req.query.includeArchived === 'true';
    const products = await prisma.product.findMany({
        where: includeArchived ? undefined : { archivedAt: null },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ products });
}

export async function createProduct(req, res) {
    try {
        validateProductPayload(req.body);
        const product = await prisma.product.create({ data: req.body });
        res.status(201).json(product);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('createProduct failed:', err);
        res.status(500).json({ error: 'Create failed' });
    }
}

export async function updateProduct(req, res) {
    try {
        validateProductPayload(req.body, { partial: true });
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(product);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
        if (err.http) return sendHttpError(res, err);
        console.error('updateProduct failed:', err);
        res.status(500).json({ error: 'Update failed' });
    }
}

export async function archiveProduct(req, res) {
    try {
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: { archivedAt: new Date() },
        });
        res.json(product);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
        console.error('archiveProduct failed:', err);
        res.status(500).json({ error: 'Archive failed' });
    }
}

export async function unarchiveProduct(req, res) {
    try {
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: { archivedAt: null },
        });
        res.json(product);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
        console.error('unarchiveProduct failed:', err);
        res.status(500).json({ error: 'Unarchive failed' });
    }
}
```

- [ ] **Step 2: Create `adminProductsRoutes.js`**

```js
import express from 'express';
import {
    listProducts, createProduct, updateProduct, archiveProduct, unarchiveProduct,
} from '../controllers/adminProductsController.js';

const router = express.Router();

router.get('/', listProducts);
router.post('/', createProduct);
router.patch('/:id', updateProduct);
router.post('/:id/archive', archiveProduct);
router.post('/:id/unarchive', unarchiveProduct);

export default router;
```

- [ ] **Step 3: Mount the sub-router**

Edit `backend/routes/adminRoutes.js`:

```js
import adminProductsRoutes from './adminProductsRoutes.js';
// ...
router.use('/products', adminProductsRoutes);
```

- [ ] **Step 4: Manual verification**

With admin creds:

1. `GET /admin/products` → returns non-archived products.
2. `GET /admin/products?includeArchived=true` → includes archived.
3. `POST /admin/products` with valid body → 201.
4. `PATCH /admin/products/:id` with `{ "price": 999 }` → 200.
5. `POST /admin/products/:id/archive` → 200, subsequent `GET /products` no longer returns it.
6. `POST /admin/products/:id/unarchive` → 200, visible in `GET /products` again.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/adminProductsController.js backend/routes/adminProductsRoutes.js backend/routes/adminRoutes.js
git commit -m "feat(admin): add product CRUD with soft-delete (archive/unarchive)"
```

---

# Phase 6 — Admin users endpoints

### Task 9: Admin users controller + routes

**Files:**
- Create: `backend/controllers/adminUsersController.js`
- Create: `backend/routes/adminUsersRoutes.js`
- Modify: `backend/routes/adminRoutes.js`

- [ ] **Step 1: Create `adminUsersController.js`**

```js
import { prisma } from '../lib/prisma.js';
import { sendHttpError, httpError } from '../lib/httpError.js';

export async function listUsers(_req, res) {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            displayName: true,
            role: true,
            balance: true,
            createdAt: true,
            _count: { select: { orders: true } },
        },
    });
    const shaped = users.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        role: u.role,
        balance: u.balance,
        createdAt: u.createdAt,
        orderCount: u._count.orders,
    }));
    res.json({ users: shaped });
}

export async function getUser(req, res) {
    const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: {
            orders: {
                orderBy: { createdAt: 'desc' },
                include: {
                    items: { include: { product: { select: { name: true, imageUrl: true } } } },
                },
            },
        },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
}

export async function updateRole(req, res) {
    try {
        const { role } = req.body || {};
        if (role !== 'customer' && role !== 'admin') {
            throw httpError(400, 'Invalid role');
        }
        if (req.user.id === req.params.id) {
            throw httpError(409, 'Admins cannot change their own role');
        }

        const updated = await prisma.$transaction(async (tx) => {
            const target = await tx.user.findUnique({
                where: { id: req.params.id },
                select: { role: true },
            });
            if (!target) throw httpError(404, 'User not found');

            const after = await tx.user.update({
                where: { id: req.params.id },
                data: { role },
                select: { id: true, displayName: true, role: true, balance: true },
            });

            const adminCount = await tx.user.count({ where: { role: 'admin' } });
            if (adminCount < 1) throw httpError(409, 'Cannot remove the last admin');

            return after;
        });

        res.json(updated);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('updateRole failed:', err);
        res.status(500).json({ error: 'Role update failed' });
    }
}

export async function adjustBalance(req, res) {
    try {
        const { delta } = req.body || {};
        if (!Number.isInteger(delta) || delta === 0) {
            throw httpError(400, 'delta must be a non-zero integer');
        }

        const updated = await prisma.$transaction(async (tx) => {
            const rows = await tx.$queryRaw`
                SELECT balance FROM users WHERE id = ${req.params.id}::uuid FOR UPDATE
            `;
            if (rows.length === 0) throw httpError(404, 'User not found');
            const current = rows[0].balance;
            const next = current + delta;
            if (next < 0) throw httpError(409, 'Balance cannot go below 0');

            return tx.user.update({
                where: { id: req.params.id },
                data: { balance: next },
                select: { id: true, displayName: true, role: true, balance: true },
            });
        });

        res.json(updated);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('adjustBalance failed:', err);
        res.status(500).json({ error: 'Balance adjustment failed' });
    }
}
```

- [ ] **Step 2: Create `adminUsersRoutes.js`**

```js
import express from 'express';
import {
    listUsers, getUser, updateRole, adjustBalance,
} from '../controllers/adminUsersController.js';

const router = express.Router();

router.get('/', listUsers);
router.get('/:id', getUser);
router.patch('/:id/role', updateRole);
router.post('/:id/balance', adjustBalance);

export default router;
```

- [ ] **Step 3: Mount the sub-router**

Edit `backend/routes/adminRoutes.js`:

```js
import adminUsersRoutes from './adminUsersRoutes.js';
// ...
router.use('/users', adminUsersRoutes);
```

- [ ] **Step 4: Manual verification**

With admin creds:

1. `GET /admin/users` → returns array with `orderCount` per user.
2. `GET /admin/users/:id` → detail + all orders.
3. `PATCH /admin/users/:id/role` with `{ "role": "admin" }` on a customer → 200.
4. Same on self → 409 "Admins cannot change their own role".
5. When only one admin exists, demoting them → 409 "Cannot remove the last admin".
6. `POST /admin/users/:id/balance` with `{ "delta": 50 }` → 200, balance += 50.
7. Same with `{ "delta": -9999999 }` → 409 "Balance cannot go below 0".

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/adminUsersController.js backend/routes/adminUsersRoutes.js backend/routes/adminRoutes.js
git commit -m "feat(admin): add user list/detail + role change + balance delta with guards"
```

---

# Phase 7 — Frontend foundation (shared + customer)

### Task 10: Extract PackageIcon and UserIcon into a shared icons folder

**Files:**
- Create: `frontend/src/components/icons/PackageIcon.jsx`
- Create: `frontend/src/components/icons/UserIcon.jsx`
- Modify: `frontend/src/components/ProfileMenu.jsx`

- [ ] **Step 1: Create `PackageIcon.jsx`**

Copy the existing inline `PackageIcon` definition from `ProfileMenu.jsx` into a standalone file:

```jsx
export default function PackageIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
      <path d="m3 7.5 9 4.5 9-4.5" />
      <path d="M12 12v9" />
      <path d="m7.5 5.25 9 4.5" />
    </svg>
  );
}
```

- [ ] **Step 2: Create `UserIcon.jsx`**

```jsx
export default function UserIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
```

- [ ] **Step 3: Update `ProfileMenu.jsx`**

At the top, add these imports (next to the existing ones):

```js
import PackageIcon from './icons/PackageIcon.jsx';
import UserIcon from './icons/UserIcon.jsx';
```

Then **remove** the inline `function UserIcon(...)` and `function PackageIcon(...)` definitions from the bottom of the file. Keep `LogoutIcon`, `StarIcon`, and `MenuItem` inline — they remain untouched.

- [ ] **Step 4: Smoke test in the browser**

Run `npm run dev` in `frontend/`. Open `http://127.0.0.1:5173`, confirm the login button icon and the menu's "Order History" icon render identically to before.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/icons/ frontend/src/components/ProfileMenu.jsx
git commit -m "refactor(icons): extract PackageIcon and UserIcon into shared /components/icons"
```

---

### Task 11: Build the shared StatusBadge component

**Files:**
- Create: `frontend/src/components/StatusBadge.jsx`

- [ ] **Step 1: Write the component**

```jsx
const STATUS_STYLES = {
  confirmed:        { label: 'Confirmed',          cls: 'bg-green-100 text-green-800' },
  processing:       { label: 'Processing',         cls: 'bg-blue-100 text-blue-800' },
  shipped:          { label: 'Shipped',            cls: 'bg-indigo-100 text-indigo-800' },
  delivered:        { label: 'Delivered',          cls: 'bg-emerald-100 text-emerald-800' },
  cancel_requested: { label: 'Cancel requested',   cls: 'bg-amber-100 text-amber-800' },
  cancelled:        { label: 'Cancelled',          cls: 'bg-gray-200 text-gray-700' },
  return_requested: { label: 'Return requested',   cls: 'bg-orange-100 text-orange-800' },
  returned:         { label: 'Returned',           cls: 'bg-rose-100 text-rose-800' },
};

export default function StatusBadge({ status }) {
  const cfg = STATUS_STYLES[status] ?? { label: status, cls: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/StatusBadge.jsx
git commit -m "feat(ui): add shared StatusBadge component for order statuses"
```

---

### Task 12: Build the shared ReasonPromptModal

**Files:**
- Create: `frontend/src/components/ReasonPromptModal.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useEffect, useState } from 'react';

export default function ReasonPromptModal({
  open,
  title = 'Provide a reason',
  placeholder = 'Optional reason…',
  required = false,
  submitLabel = 'Submit',
  onSubmit,
  onClose,
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setValue('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (required && !trimmed) {
      setError('A reason is required.');
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        className="bg-surface rounded-xl shadow-card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="text-lg font-display mb-3">{title}</h2>
        <textarea
          className="w-full border border-line rounded-md p-2 text-sm min-h-[96px] focus:outline-none focus:border-accent"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {error && <div className="text-danger text-sm mt-1">{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-line hover:bg-cream">
            Cancel
          </button>
          <button type="submit" className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-accent-dark">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ReasonPromptModal.jsx
git commit -m "feat(ui): add shared ReasonPromptModal for cancel/return reason prompts"
```

---

### Task 13: Extend `orderService.js` with list/cancel/return

**Files:**
- Modify: `frontend/src/services/orderService.js`

- [ ] **Step 1: Append functions to `orderService.js`**

Open `frontend/src/services/orderService.js` and append:

```js
export async function listMyOrders(authedFetch) {
  const res = await authedFetch('/orders');
  if (!res.ok) throw new Error('Failed to load orders');
  const body = await res.json();
  return body.orders ?? [];
}

export async function userCancelOrder(authedFetch, orderId, reason) {
  const res = await authedFetch(`/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Cancel failed');
  }
  return res.json();
}

export async function userReturnOrder(authedFetch, orderId, reason) {
  const res = await authedFetch(`/orders/${orderId}/return`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Return request failed');
  }
  return res.json();
}
```

Keep the existing `PlaceOrderError` and `placeOrder` unchanged.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/orderService.js
git commit -m "feat(orders-service): add listMyOrders, userCancelOrder, userReturnOrder"
```

---

### Task 14: Build the `useMyOrders` hook

**Files:**
- Create: `frontend/src/hooks/useMyOrders.js`

- [ ] **Step 1: Write the hook**

```js
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import {
  listMyOrders,
  userCancelOrder,
  userReturnOrder,
} from '../services/orderService.js';

export function useMyOrders() {
  const { authedFetch, refreshProfile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMyOrders(authedFetch);
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { refresh(); }, [refresh]);

  const cancel = useCallback(async (orderId, reason) => {
    await userCancelOrder(authedFetch, orderId, reason);
    await refresh();
    await refreshProfile?.();
  }, [authedFetch, refresh, refreshProfile]);

  const requestReturn = useCallback(async (orderId, reason) => {
    await userReturnOrder(authedFetch, orderId, reason);
    await refresh();
  }, [authedFetch, refresh]);

  return { orders, loading, error, refresh, cancel, requestReturn };
}
```

- [ ] **Step 2: Verify `useAuth` exposes `authedFetch` and `refreshProfile`**

Run:

```bash
grep -n "authedFetch\|refreshProfile" frontend/src/auth/*.js
```

Expected: both identifiers appear. If `refreshProfile` does not exist on `useAuth`, read `AuthProvider.jsx` and either add a small `refreshProfile()` exposing a re-fetch of `/me`, or fall back to leaving it out — adjust the hook call accordingly (`?.()` is already defensive). Document the actual name used in the commit message.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useMyOrders.js
git commit -m "feat(hooks): add useMyOrders for list/cancel/return flows"
```

---

### Task 15: Build `MyOrdersPage` and wire the route

**Files:**
- Create: `frontend/src/pages/MyOrdersPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/ProfileMenu.jsx`

- [ ] **Step 1: Write `MyOrdersPage.jsx`**

```jsx
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { useMyOrders } from '../hooks/useMyOrders.js';
import StatusBadge from '../components/StatusBadge.jsx';
import ReasonPromptModal from '../components/ReasonPromptModal.jsx';

const RETURN_WINDOW_MS = 48 * 60 * 60 * 1000;

function formatPoints(n) {
  return `${n.toLocaleString()} pts`;
}

function canReturn(order) {
  if (order.status !== 'delivered' || !order.deliveredAt) return false;
  return Date.now() - new Date(order.deliveredAt).getTime() <= RETURN_WINDOW_MS;
}

export default function MyOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const { orders, loading, error, cancel, requestReturn } = useMyOrders();
  const [modal, setModal] = useState(null); // { kind: 'cancel'|'return', orderId }

  if (authLoading) return <div className="p-8">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;

  const handleCancel = async (orderId, orderStatus) => {
    if (orderStatus === 'confirmed') {
      await cancel(orderId, '');
    } else {
      setModal({ kind: 'cancel', orderId });
    }
  };

  return (
    <>
      <h1 className="text-2xl font-display mb-4">My orders</h1>
      {loading && <div>Loading orders…</div>}
      {error && <div className="text-danger">{error}</div>}
      {!loading && orders.length === 0 && (
        <div className="text-muted">
          No orders yet. <Link to="/" className="text-accent underline">Shop now</Link>.
        </div>
      )}
      <ul className="space-y-4">
        {orders.map((o) => (
          <li key={o.id} className="border border-line rounded-lg p-4 bg-surface">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusBadge status={o.status} />
                <span className="text-sm text-muted">
                  {new Date(o.createdAt).toLocaleString()}
                </span>
              </div>
              <span className="text-sm font-medium">{formatPoints(o.total)}</span>
            </div>
            <ul className="mt-3 text-sm text-ink space-y-1">
              {o.items.map((it) => (
                <li key={it.id}>
                  {it.quantity}× {it.product?.name ?? 'Item'}
                </li>
              ))}
            </ul>
            {o.requestReason && (
              <div className="text-xs text-muted mt-2">
                Your reason: {o.requestReason}
              </div>
            )}
            {o.decisionReason && (
              <div className="text-xs text-muted mt-1">
                Admin note: {o.decisionReason}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              {(o.status === 'confirmed' || o.status === 'processing') && (
                <button
                  className="text-sm px-3 py-1 rounded border border-line hover:bg-cream"
                  onClick={() => handleCancel(o.id, o.status)}
                >
                  {o.status === 'confirmed' ? 'Cancel order' : 'Request cancellation'}
                </button>
              )}
              {o.status === 'delivered' && (
                <button
                  disabled={!canReturn(o)}
                  title={!canReturn(o) ? 'Return period expired' : undefined}
                  className="text-sm px-3 py-1 rounded border border-line hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setModal({ kind: 'return', orderId: o.id })}
                >
                  Request return
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <ReasonPromptModal
        open={!!modal}
        title={modal?.kind === 'cancel' ? 'Request cancellation' : 'Request return'}
        placeholder="Tell us why (optional)"
        submitLabel="Send request"
        onClose={() => setModal(null)}
        onSubmit={async (reason) => {
          const { kind, orderId } = modal;
          setModal(null);
          if (kind === 'cancel') await cancel(orderId, reason);
          else await requestReturn(orderId, reason);
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Add the route in `App.jsx`**

Add the import near the other page imports:

```jsx
import MyOrdersPage from './pages/MyOrdersPage.jsx';
```

Inside `<Routes>`, next to the other `main`-wrapped routes:

```jsx
<Route path="/orders" element={<main className={MAIN_CLS}><MyOrdersPage /></main>} />
```

- [ ] **Step 3: Wire the ProfileMenu "Order History" item**

In `frontend/src/components/ProfileMenu.jsx`, change the "Order History" `MenuItem` usage so clicking it navigates to `/orders`. Import `useNavigate` from `react-router-dom` at the top:

```jsx
import { useNavigate } from 'react-router-dom';
```

Inside the component, grab the navigator:

```jsx
const navigate = useNavigate();
```

Then update the `MenuItem`:

```jsx
<MenuItem
  icon={<PackageIcon className="w-[18px] h-[18px]" />}
  label="Order History"
  onClick={() => {
    setOpen(false);
    navigate('/orders');
  }}
/>
```

- [ ] **Step 4: Smoke test**

With `npm run dev` running: sign in as a customer, click the avatar → "Order History" → should navigate to `/orders`. Page renders, orders list appears, cancel button on a `confirmed` order calls the backend and refreshes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/MyOrdersPage.jsx frontend/src/App.jsx frontend/src/components/ProfileMenu.jsx
git commit -m "feat(orders-ui): add /orders customer page with cancel and return actions"
```

---

# Phase 8 — Admin frontend

### Task 16: Build `AdminRoute` gate

**Files:**
- Create: `frontend/src/components/admin/AdminRoute.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';

export default function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="p-8">Loading…</div>;
  if (!user || profile?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
```

- [ ] **Step 2: Verify `profile.role` is actually exposed**

Run:

```bash
grep -n "role" frontend/src/auth/*.js frontend/src/services/profileService.js
```

Expected: the `/me` response body contains `role`, and `profile` inside `AuthProvider` includes it. If `role` is absent from the profile, extend `profileService.fetchProfile` to include it, and return it from `AuthProvider`. Document this in the commit.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/AdminRoute.jsx
git commit -m "feat(admin-ui): add AdminRoute role gate"
```

---

### Task 17: Build the admin service layer

**Files:**
- Create: `frontend/src/services/admin/adminOrdersService.js`
- Create: `frontend/src/services/admin/adminProductsService.js`
- Create: `frontend/src/services/admin/adminUsersService.js`

- [ ] **Step 1: Write `adminOrdersService.js`**

```js
export async function listOrders(authedFetch, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await authedFetch(`/admin/orders${qs}`);
  if (!res.ok) throw new Error('Failed to load orders');
  const body = await res.json();
  return body.orders ?? [];
}

export async function getOrder(authedFetch, id) {
  const res = await authedFetch(`/admin/orders/${id}`);
  if (!res.ok) throw new Error('Failed to load order');
  return res.json();
}

export async function transitionOrder(authedFetch, id, action, reason) {
  const res = await authedFetch(`/admin/orders/${id}/transition`, {
    method: 'POST',
    body: JSON.stringify({ action, reason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Transition failed');
  }
  return res.json();
}
```

- [ ] **Step 2: Write `adminProductsService.js`**

```js
export async function listProducts(authedFetch, { includeArchived = false } = {}) {
  const qs = includeArchived ? '?includeArchived=true' : '';
  const res = await authedFetch(`/admin/products${qs}`);
  if (!res.ok) throw new Error('Failed to load products');
  const body = await res.json();
  return body.products ?? [];
}

export async function createProduct(authedFetch, data) {
  const res = await authedFetch('/admin/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Create failed');
  }
  return res.json();
}

export async function updateProduct(authedFetch, id, data) {
  const res = await authedFetch(`/admin/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Update failed');
  }
  return res.json();
}

export async function archiveProduct(authedFetch, id) {
  const res = await authedFetch(`/admin/products/${id}/archive`, { method: 'POST' });
  if (!res.ok) throw new Error('Archive failed');
  return res.json();
}

export async function unarchiveProduct(authedFetch, id) {
  const res = await authedFetch(`/admin/products/${id}/unarchive`, { method: 'POST' });
  if (!res.ok) throw new Error('Unarchive failed');
  return res.json();
}
```

- [ ] **Step 3: Write `adminUsersService.js`**

```js
export async function listUsers(authedFetch) {
  const res = await authedFetch('/admin/users');
  if (!res.ok) throw new Error('Failed to load users');
  const body = await res.json();
  return body.users ?? [];
}

export async function getUser(authedFetch, id) {
  const res = await authedFetch(`/admin/users/${id}`);
  if (!res.ok) throw new Error('Failed to load user');
  return res.json();
}

export async function updateRole(authedFetch, id, role) {
  const res = await authedFetch(`/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Role update failed');
  }
  return res.json();
}

export async function adjustBalance(authedFetch, id, delta) {
  const res = await authedFetch(`/admin/users/${id}/balance`, {
    method: 'POST',
    body: JSON.stringify({ delta }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Balance adjustment failed');
  }
  return res.json();
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/admin/
git commit -m "feat(admin-ui): add service layer for admin orders/products/users"
```

---

### Task 18: Build the admin hooks

**Files:**
- Create: `frontend/src/hooks/admin/useAdminOrders.js`
- Create: `frontend/src/hooks/admin/useAdminProducts.js`
- Create: `frontend/src/hooks/admin/useAdminUsers.js`

- [ ] **Step 1: Write `useAdminOrders.js`**

```js
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import * as api from '../../services/admin/adminOrdersService.js';

export function useAdminOrders() {
  const { authedFetch } = useAuth();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listOrders(authedFetch, status ? { status } : {});
      setOrders(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [authedFetch, status]);

  useEffect(() => { refresh(); }, [refresh]);

  const transition = useCallback(async (id, action, reason) => {
    await api.transitionOrder(authedFetch, id, action, reason);
    await refresh();
  }, [authedFetch, refresh]);

  return { orders, status, setStatus, loading, error, refresh, transition };
}
```

- [ ] **Step 2: Write `useAdminProducts.js`**

```js
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import * as api from '../../services/admin/adminProductsService.js';

export function useAdminProducts() {
  const { authedFetch } = useAuth();
  const [products, setProducts] = useState([]);
  const [includeArchived, setIncludeArchived] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listProducts(authedFetch, { includeArchived });
      setProducts(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [authedFetch, includeArchived]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (data) => { await api.createProduct(authedFetch, data); await refresh(); }, [authedFetch, refresh]);
  const update = useCallback(async (id, data) => { await api.updateProduct(authedFetch, id, data); await refresh(); }, [authedFetch, refresh]);
  const archive = useCallback(async (id) => { await api.archiveProduct(authedFetch, id); await refresh(); }, [authedFetch, refresh]);
  const unarchive = useCallback(async (id) => { await api.unarchiveProduct(authedFetch, id); await refresh(); }, [authedFetch, refresh]);

  return { products, includeArchived, setIncludeArchived, loading, error, refresh, create, update, archive, unarchive };
}
```

- [ ] **Step 3: Write `useAdminUsers.js`**

```js
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import * as api from '../../services/admin/adminUsersService.js';

export function useAdminUsers() {
  const { authedFetch } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setUsers(await api.listUsers(authedFetch)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [authedFetch]);

  useEffect(() => { refresh(); }, [refresh]);

  const getOne = useCallback((id) => api.getUser(authedFetch, id), [authedFetch]);
  const setRole = useCallback(async (id, role) => { await api.updateRole(authedFetch, id, role); await refresh(); }, [authedFetch, refresh]);
  const adjustBalance = useCallback(async (id, delta) => { await api.adjustBalance(authedFetch, id, delta); await refresh(); }, [authedFetch, refresh]);

  return { users, loading, error, refresh, getOne, setRole, adjustBalance };
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/admin/
git commit -m "feat(admin-ui): add useAdminOrders/Products/Users hooks"
```

---

### Task 19: Build the `AdminPage` shell with tabs

**Files:**
- Create: `frontend/src/pages/AdminPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/ProfileMenu.jsx`

- [ ] **Step 1: Invoke the bencium-impact-designer skill for the shell**

Use the `bencium-impact-designer` skill to generate `frontend/src/pages/AdminPage.jsx`. Pass it these requirements:

> Build an admin dashboard shell page for a Brooklyn-bakery e-commerce demo. Style: dense, Vercel-dashboard-like, clean, Tailwind. The page has a header section with the title "Admin", a sub-header row with three tab buttons ("Orders", "Products", "Users"), and a main content area that renders the active tab's component. Tab state lives in `useState`. When a tab is active it has a bottom underline in the accent color and a darker text color; inactive tabs are muted. The Orders tab uses an imported `PackageIcon` (from `../components/icons/PackageIcon.jsx`) next to its label, and the Users tab uses `UserIcon` (from `../components/icons/UserIcon.jsx`). The Products tab picks its own inline icon (small cube outline SVG). Import the three tab components from `../components/admin/OrdersTab.jsx`, `ProductsTab.jsx`, `UsersTab.jsx` (they will be built separately). Expose the default export as `AdminPage`.

Review the skill's output; confirm it imports the three tab components and uses `useState` for the active-tab index (not URL-synced).

- [ ] **Step 2: Add the `/admin` route in `App.jsx`**

```jsx
import AdminPage from './pages/AdminPage.jsx';
import AdminRoute from './components/admin/AdminRoute.jsx';

// inside <Routes>:
<Route
  path="/admin"
  element={
    <AdminRoute>
      <main className={MAIN_CLS}>
        <AdminPage />
      </main>
    </AdminRoute>
  }
/>
```

- [ ] **Step 3: Add an "Admin" item to `ProfileMenu.jsx` for admins**

In `ProfileMenu.jsx`, just above the "Order History" `MenuItem`, insert (conditional on admin role):

```jsx
{profile?.role === 'admin' && (
  <MenuItem
    icon={<UserIcon className="w-[18px] h-[18px]" />}
    label="Admin"
    onClick={() => {
      setOpen(false);
      navigate('/admin');
    }}
  />
)}
```

- [ ] **Step 4: Smoke test**

Sign in as admin → avatar shows → menu includes "Admin" → navigates to `/admin` → shell renders with three tab buttons (tabs themselves still empty pending Tasks 20–22). Signed in as non-admin → no "Admin" item; manually visiting `/admin` → redirected to `/`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AdminPage.jsx frontend/src/App.jsx frontend/src/components/ProfileMenu.jsx
git commit -m "feat(admin-ui): add /admin route with tabbed shell and profile menu entry"
```

---

### Task 20: Build `StatusFilter` + `OrdersTab` + `OrderDetailDrawer`

**Files:**
- Create: `frontend/src/components/admin/StatusFilter.jsx`
- Create: `frontend/src/components/admin/OrdersTab.jsx`
- Create: `frontend/src/components/admin/OrderDetailDrawer.jsx`

- [ ] **Step 1: Write `StatusFilter.jsx` directly (no designer skill — trivial)**

```jsx
const STATUSES = [
  { value: '',                 label: 'All statuses' },
  { value: 'confirmed',        label: 'Confirmed' },
  { value: 'processing',       label: 'Processing' },
  { value: 'shipped',          label: 'Shipped' },
  { value: 'delivered',        label: 'Delivered' },
  { value: 'cancel_requested', label: 'Cancel requested' },
  { value: 'cancelled',        label: 'Cancelled' },
  { value: 'return_requested', label: 'Return requested' },
  { value: 'returned',         label: 'Returned' },
];

export default function StatusFilter({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-line rounded-md px-2 py-1 text-sm bg-surface"
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Invoke the bencium-impact-designer skill for `OrdersTab.jsx`**

Pass these requirements:

> Build the admin Orders tab for a Brooklyn-bakery admin dashboard. Style: Vercel-dashboard-dense, Tailwind, existing palette (`bg-surface`, `border-line`, `text-ink`, `text-muted`, `bg-cream`, `bg-accent`, `text-accent`). Layout: a top toolbar on the left has the `StatusFilter` component (already built at `./StatusFilter.jsx`) that filters the order list; on the right a "Refresh" button. Below the toolbar, a dense responsive table with columns: "Order" (short 8-char id), "Customer" (displayName), "Items" (count), "Total" (points), "Status" (`StatusBadge` from `../StatusBadge.jsx`), "Date" (relative). Clicking a row opens `OrderDetailDrawer` (also in this folder — build separately) with the selected order. Use the `useAdminOrders` hook from `../../hooks/admin/useAdminOrders.js` for data, filtering, and mutations. Error state renders an inline danger banner. Empty state renders "No orders found." Loading renders skeleton rows. Export default.

Review the generated component: the import paths are correct, it uses the hook (not direct fetch), rows are clickable, the drawer opens on click.

- [ ] **Step 3: Invoke the bencium-impact-designer skill for `OrderDetailDrawer.jsx`**

Pass these requirements:

> Build a right-side slide-in drawer at `frontend/src/components/admin/OrderDetailDrawer.jsx`. Props: `{ order, onClose, onTransition }` where `onTransition(action, reason)` awaits a backend call. When `order` is null, render null. Otherwise render a fixed-position drawer (right side, `w-[480px]`, full height, `bg-surface`, border-left, shadow) with a header showing the short order id and `StatusBadge` from `../StatusBadge.jsx`, a body with: customer displayName, items list (`quantity × name`), total in points, `deliveredAt` if set (formatted), `requestReason` and `decisionReason` if present, and a section "Actions" that renders buttons based on the current status using this allowed-action table:
>
> - confirmed: `setProcessing`, `forceCancel`
> - processing: `setShipped`, `forceCancel`
> - cancel_requested: `approveCancel`, `denyCancel`
> - shipped: `setDelivered`
> - delivered: `forceReturn`
> - return_requested: `approveReturn`, `denyReturn`
> - cancelled, returned: "No actions available" (disabled).
>
> Actions that require a reason (`denyCancel`, `denyReturn`, `forceCancel`, `forceReturn`) open the shared `ReasonPromptModal` from `../ReasonPromptModal.jsx` with `required=true` before firing. Non-reason actions call `onTransition(action, '')` directly. Disable buttons while a transition is in-flight. Click on the dark backdrop closes the drawer.

Review the output: all 9 admin actions wired, reason modal only opens for the 4 denial/force actions, buttons disable correctly.

- [ ] **Step 4: Smoke test**

Sign in as admin, navigate to `/admin`, Orders tab:
1. Filter by status → list updates.
2. Click an order row → drawer opens.
3. Click "Set processing" on a `confirmed` order → drawer closes or updates, list refreshes, badge now reads "Processing".
4. Try "Deny cancel" on a `cancel_requested` order → reason modal opens; submitting with empty text shows the "required" error; submitting with text → order returns to `processing` and `decisionReason` is shown on a refresh.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/StatusFilter.jsx frontend/src/components/admin/OrdersTab.jsx frontend/src/components/admin/OrderDetailDrawer.jsx
git commit -m "feat(admin-ui): Orders tab with status filter, detail drawer, and full transition actions"
```

---

### Task 21: Build `ProductsTab` + `ProductEditModal`

**Files:**
- Create: `frontend/src/components/admin/ProductsTab.jsx`
- Create: `frontend/src/components/admin/ProductEditModal.jsx`

- [ ] **Step 1: Invoke the bencium-impact-designer skill for `ProductsTab.jsx`**

Pass these requirements:

> Build the admin Products tab at `frontend/src/components/admin/ProductsTab.jsx`. Style matches the existing dense dashboard aesthetic (Tailwind, existing palette). Toolbar: "Include archived" checkbox (bound to the hook's `includeArchived` state) on the left; "New product" button (accent color) on the right. Below, a responsive table with columns: thumbnail (24px square from `imageUrl`), Name, Type (colored pill by type: bread/pastry/cake/cookie/drink), Price (points), Stock, Status (either "Active" or an "Archived" muted pill if `archivedAt` is set), Actions (Edit, Archive/Unarchive). "Edit" opens `ProductEditModal` from `./ProductEditModal.jsx` with `{ mode: 'edit', product }`. "New product" opens the same modal with `{ mode: 'create' }`. Archive/Unarchive button label flips based on the product's `archivedAt`; a confirm dialog before archiving is not required. Uses the `useAdminProducts` hook. Error banner + empty state + loading skeleton. Export default.

Review the output: all CRUD paths wired through the hook, toggling "Include archived" re-fetches.

- [ ] **Step 2: Invoke the bencium-impact-designer skill for `ProductEditModal.jsx`**

Pass these requirements:

> Build a modal at `frontend/src/components/admin/ProductEditModal.jsx`. Props: `{ mode, product, onClose, onCreate, onUpdate }`. `mode` is `'create'` or `'edit'`. In edit mode the form is prefilled from `product`. Fields: Name (text, required), Description (textarea, required), Image URL (text, required, URL-looking), Type (select: bread/pastry/cake/cookie/drink), Price (integer, min 0, in points), Stock (integer, min 0). Submit: in create mode calls `onCreate(data)`; in edit mode calls `onUpdate(product.id, data)`. Show inline field errors on validation failure. Cancel button + X in corner close the modal. Match the existing `ReasonPromptModal` visual idiom (fixed backdrop, centered card, `bg-surface`, `rounded-xl`, `shadow-card`).

- [ ] **Step 3: Smoke test**

Admin → Products tab:
1. "New product" → modal → create → product appears in list.
2. Edit price on existing → saves → list updates.
3. Archive → product appears as "Archived" (with `includeArchived` on) or disappears (off).
4. Unarchive → toggles back.
5. Open the public shop at `/`: archived products should not appear.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/ProductsTab.jsx frontend/src/components/admin/ProductEditModal.jsx
git commit -m "feat(admin-ui): Products tab with CRUD and soft-delete via modal"
```

---

### Task 22: Build `UsersTab` + `UserDetailDrawer`

**Files:**
- Create: `frontend/src/components/admin/UsersTab.jsx`
- Create: `frontend/src/components/admin/UserDetailDrawer.jsx`

- [ ] **Step 1: Invoke the bencium-impact-designer skill for `UsersTab.jsx`**

Pass these requirements:

> Build the admin Users tab at `frontend/src/components/admin/UsersTab.jsx`. Style matches dense dashboard. Columns: Display name (fallback "—"), Role (colored pill: admin=accent-filled, customer=neutral), Balance (points), Orders (count), Joined (relative date). Row click opens `UserDetailDrawer` (in same folder) for the user. Uses the `useAdminUsers` hook. Error banner + loading skeleton + empty state. Export default.

- [ ] **Step 2: Invoke the bencium-impact-designer skill for `UserDetailDrawer.jsx`**

Pass these requirements:

> Build a right-side drawer at `frontend/src/components/admin/UserDetailDrawer.jsx`. Props: `{ userId, currentUserId, onClose, onRoleChange, onAdjustBalance }`. When `userId` is null, render null. Otherwise fetch the full user with `useEffect` using the `getOne(userId)` function from `useAdminUsers` (pass `getOne` down as a prop, call it `fetchUser`, prop shape: `{ userId, currentUserId, fetchUser, onClose, onRoleChange, onAdjustBalance }`). Show: display name, role (as editable pill — when `userId === currentUserId`, toggle is disabled with tooltip "Cannot change your own role"), balance with a delta form (integer input + Submit button; client-side blocks would-be-negative balance with inline error), and an embedded list of that user's orders (each row with `StatusBadge` from `../StatusBadge.jsx`, date, total). On successful role change or balance adjust, refetch the user detail and call the relevant `on*` callback so the outer list refreshes. Use the existing shadow + border styling from `OrderDetailDrawer`.

- [ ] **Step 3: Wire `UsersTab` to pass `currentUserId`**

In `UsersTab.jsx`, import `useAuth` and pass `currentUserId={user?.id}` to `UserDetailDrawer`. Pass `fetchUser={getOne}` from the hook. Wire `onRoleChange` and `onAdjustBalance` to the hook's `setRole` / `adjustBalance`.

If the generated `UsersTab` doesn't already include this, edit it to do so.

- [ ] **Step 4: Smoke test**

Admin → Users tab:
1. Row click → drawer opens with the user's orders.
2. Change another user's role → drawer and list update; role pill changes.
3. Try to change own role → toggle disabled.
4. Add `+100` to another user's balance → saves, drawer + list update.
5. Try `-9999999` → inline error, no network call.
6. When only one admin exists, demoting self is already blocked; demoting that admin as the single admin → server returns 409 (assuming you log in as someone else); error banner surfaces.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/UsersTab.jsx frontend/src/components/admin/UserDetailDrawer.jsx
git commit -m "feat(admin-ui): Users tab with role-change and balance-delta via drawer"
```

---

# Phase 9 — Verification & wrap

### Task 23: End-to-end verification

**Files:** none

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && npm test
```

Expected: all tests pass (existing + new state-machine tests).

- [ ] **Step 2: Run frontend lint**

```bash
cd frontend && npm run lint
```

Expected: no errors. Fix any lint issues introduced; do NOT disable rules.

- [ ] **Step 3: Manual end-to-end walk-through**

With `npm run dev` running (from repo root):

1. Sign in as customer.
2. Place an order for a product with stock.
3. Go to `/orders`, see `Confirmed`.
4. Cancel (direct) → refund, stock restored, badge `Cancelled`.
5. Place another order. Sign in as admin in another window; move it through `setProcessing → setShipped → setDelivered`. Confirm customer-side `Delivered` badge shows.
6. Customer requests return within 48h → badge `Return requested`. Admin approves → `Returned`, points refunded, stock NOT restored.
7. Place another order; as admin, `forceCancel` from `processing` with a reason → cancelled, refund + stock.
8. As admin, try to demote self → UI disables; try to change role of another user → works.
9. Archive a product → vanishes from public shop; appears in admin products with "Archived" pill when `includeArchived=true`.
10. Adjust a user's balance by negative delta below 0 → client error before network call.
11. Sign out; visit `/admin` and `/orders` → both redirect.

Fix any regressions before moving on.

- [ ] **Step 4: Commit (only if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found in end-to-end verification"
```

---

### Task 24: Commit the spec + plan docs

**Files:**
- Add: `docs/superpowers/specs/2026-04-22-admin-page-design.md`
- Add: `docs/superpowers/plans/2026-04-22-admin-page.md`

- [ ] **Step 1: Bundle spec and plan in one commit**

Per user convention (spec + plan get committed together — see `MEMORY.md`):

```bash
git add docs/superpowers/specs/2026-04-22-admin-page-design.md docs/superpowers/plans/2026-04-22-admin-page.md
git commit -m "docs(admin): add admin-page design spec and implementation plan"
```

- [ ] **Step 2: Open a PR**

```bash
git push -u origin feat/admin
gh pr create --title "feat: admin dashboard with order lifecycle + product/user management" --body "$(cat <<'EOF'
## Summary
- Adds `/admin` dashboard (Orders / Products / Users tabs) behind a role gate
- Introduces a full order lifecycle (processing → shipped → delivered + cancel/return flows) via a centralized state machine
- Adds `/orders` customer page for self-cancel and return-request within a 48h window
- Soft-delete for products (`archivedAt`)
- Admin user role change (with self-demotion + last-admin guards) and balance delta

## Test plan
- [ ] backend tests pass (`cd backend && npm test`)
- [ ] frontend lints clean (`cd frontend && npm run lint`)
- [ ] manual walk-through per plan Task 23

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes on the `bencium-impact-designer` skill usage

Tasks 19, 20, 21, and 22 each explicitly invoke the `bencium-impact-designer` skill for the visual admin components. The skill produces component code based on the requirements prompt — treat its output as a first draft. After each invocation:

1. Read the generated file end-to-end.
2. Verify imports and prop wiring match the plan's expectations.
3. Fix anything that diverges: wrong import paths, missing hook usage, or inconsistent styling.
4. Then smoke test in the browser per the task's verification step.

Do **not** call the skill for shared components (`StatusBadge`, `ReasonPromptModal`, `AdminRoute`, `StatusFilter`) or for customer-facing additions (`MyOrdersPage`) — those are written directly against existing style conventions.
