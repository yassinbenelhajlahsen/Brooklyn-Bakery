# Addresses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users save shipping addresses, manage them from a new `/me` page, and pick one at checkout. Orders snapshot the chosen address so history survives address edits or deletes. Admin drawer displays the snapshot.

**Architecture:** New `addresses` table owned per user. Six `shipping_*` snapshot columns added to `orders`. A pure validation/normalization helper in `backend/lib/address.js` is TDD'd with `node:test`. REST CRUD under `/api/me/addresses`. Checkout passes `addressId` to `POST /orders`; `orderService.placeOrder` loads the address inside the transaction, verifies ownership, and copies its fields onto the order row. Frontend grows a `MePage` route with an addresses section, and the existing `CheckoutPage` grows an address selector. Admin `OrderDetailDrawer` renders the snapshot.

**Tech Stack:** Node 20 ESM, Express, Prisma, Postgres (Supabase), React 18, Vite, Tailwind, `node:test`.

**Spec:** `docs/superpowers/specs/2026-04-24-addresses-design.md`

---

## File Structure

**Backend — create:**
- `backend/lib/address.js` — pure normalize/validate helper (`normalizeAddressInput`, `snapshotAddress`)
- `backend/controllers/addressesController.js` — list/create/update/delete for `/me/addresses`
- `backend/routes/addressesRoutes.js` — router for `/me/addresses`
- `backend/tests/address.test.js` — unit tests for `backend/lib/address.js`
- `backend/prisma/migrations/20260424120000_add_addresses_and_order_shipping/migration.sql`

**Backend — modify:**
- `backend/prisma/schema.prisma` — add `Address` model, `User.addresses` relation, six `shipping*` columns on `Order`
- `backend/services/orderService.js` — accept `addressId`, load + snapshot inside transaction
- `backend/controllers/orderController.js` — pass `addressId` from request body into `placeOrder`
- `backend/routes/meRoutes.js` — mount addresses sub-router

**Frontend — create:**
- `frontend/src/services/addressesService.js` — `fetchAddresses`, `createAddress`, `updateAddress`, `deleteAddress`
- `frontend/src/hooks/useAddresses.js` — load + mutate state hook
- `frontend/src/components/AddressForm.jsx` — form used for both create and edit
- `frontend/src/components/AddressSelector.jsx` — radio list with inline edit/delete used on checkout

**Frontend — modify:**
- `frontend/src/services/orderService.js` — `placeOrder` takes `addressId`, sends JSON body
- `frontend/src/hooks/usePlaceOrder.js` — accept `addressId`
- `frontend/src/pages/CheckoutPage.jsx` — render `AddressSelector`, require selection
- `frontend/src/components/admin/OrderDetailDrawer.jsx` — render shipping address section

A dedicated `/me` profile page is intentionally deferred. Address management lives only on the checkout page in this iteration. `AddressCard` is not needed — `AddressSelector` renders each row itself with radio + edit/delete controls so the selection state stays co-located with the row affordances.

---

## Task 1: Pure address helper + tests (TDD)

**Files:**
- Create: `backend/lib/address.js`
- Test: `backend/tests/address.test.js`

The helper exports `normalizeAddressInput(input, { partial })` which trims strings, rejects empty required fields, and returns `{ ok: true, value }` or `{ ok: false, field, message }`. Partial mode (for PATCH) allows any subset of fields but still rejects empty strings on provided fields. A second export `snapshotAddress(address)` maps an Address row to the `{ shippingLine1, shippingLine2, shippingCity, shippingState, shippingPostalCode, shippingCountry }` shape the order row expects.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/address.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAddressInput, snapshotAddress } from '../lib/address.js';

test('normalizeAddressInput: accepts all six fields, trims whitespace, returns normalized value', () => {
    const result = normalizeAddressInput({
        line1: '  123 Main St  ',
        line2: ' Apt 4 ',
        city: ' Brooklyn ',
        state: 'NY ',
        postalCode: ' 11201',
        country: 'USA',
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, {
        line1: '123 Main St',
        line2: 'Apt 4',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
});

test('normalizeAddressInput: line2 missing is fine and becomes null', () => {
    const result = normalizeAddressInput({
        line1: '123 Main St',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.line2, null);
});

test('normalizeAddressInput: empty line2 string becomes null', () => {
    const result = normalizeAddressInput({
        line1: '123 Main St',
        line2: '   ',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.line2, null);
});

test('normalizeAddressInput: missing required field fails with field name', () => {
    const result = normalizeAddressInput({
        line1: '123 Main St',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
    });
    assert.equal(result.ok, false);
    assert.equal(result.field, 'country');
});

test('normalizeAddressInput: empty required field fails with field name', () => {
    const result = normalizeAddressInput({
        line1: '   ',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
    assert.equal(result.ok, false);
    assert.equal(result.field, 'line1');
});

test('normalizeAddressInput: non-string required field fails', () => {
    const result = normalizeAddressInput({
        line1: 123,
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
    assert.equal(result.ok, false);
    assert.equal(result.field, 'line1');
});

test('normalizeAddressInput: partial mode allows subset, still trims and rejects empty', () => {
    const okPartial = normalizeAddressInput({ city: ' Queens ' }, { partial: true });
    assert.equal(okPartial.ok, true);
    assert.deepEqual(okPartial.value, { city: 'Queens' });

    const empty = normalizeAddressInput({ city: '  ' }, { partial: true });
    assert.equal(empty.ok, false);
    assert.equal(empty.field, 'city');
});

test('normalizeAddressInput: partial mode with empty line2 sets line2 to null', () => {
    const result = normalizeAddressInput({ line2: '   ' }, { partial: true });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { line2: null });
});

test('normalizeAddressInput: unknown fields are ignored', () => {
    const result = normalizeAddressInput({
        line1: '123 Main St',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
        evilField: 'boom',
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.evilField, undefined);
});

test('snapshotAddress: maps address row to order shipping_* fields', () => {
    const snap = snapshotAddress({
        id: 'ignored',
        userId: 'ignored',
        line1: '123 Main St',
        line2: 'Apt 4',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
    assert.deepEqual(snap, {
        shippingLine1: '123 Main St',
        shippingLine2: 'Apt 4',
        shippingCity: 'Brooklyn',
        shippingState: 'NY',
        shippingPostalCode: '11201',
        shippingCountry: 'USA',
    });
});

test('snapshotAddress: preserves null line2', () => {
    const snap = snapshotAddress({
        line1: '123 Main St',
        line2: null,
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
    assert.equal(snap.shippingLine2, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && node --test tests/address.test.js`
Expected: FAIL — module `../lib/address.js` not found.

- [ ] **Step 3: Implement the helper**

Create `backend/lib/address.js`:

```javascript
const REQUIRED_FIELDS = ['line1', 'city', 'state', 'postalCode', 'country'];
const ALL_FIELDS = ['line1', 'line2', 'city', 'state', 'postalCode', 'country'];

function trimOrNull(v) {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
}

export function normalizeAddressInput(input, { partial = false } = {}) {
    if (input == null || typeof input !== 'object') {
        return { ok: false, field: 'body', message: 'Body must be an object' };
    }

    const value = {};

    for (const field of ALL_FIELDS) {
        if (!(field in input)) {
            if (!partial && REQUIRED_FIELDS.includes(field)) {
                return { ok: false, field, message: `${field} is required` };
            }
            if (!partial && field === 'line2') {
                value.line2 = null;
            }
            continue;
        }

        const raw = input[field];

        if (field === 'line2') {
            value.line2 = trimOrNull(raw);
            continue;
        }

        if (typeof raw !== 'string') {
            return { ok: false, field, message: `${field} must be a string` };
        }
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
            return { ok: false, field, message: `${field} must not be empty` };
        }
        value[field] = trimmed;
    }

    return { ok: true, value };
}

export function snapshotAddress(address) {
    return {
        shippingLine1: address.line1,
        shippingLine2: address.line2 ?? null,
        shippingCity: address.city,
        shippingState: address.state,
        shippingPostalCode: address.postalCode,
        shippingCountry: address.country,
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && node --test tests/address.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/lib/address.js backend/tests/address.test.js
git commit -m "feat(addresses): add normalizeAddressInput and snapshotAddress helpers"
```

---

## Task 2: Prisma schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260424120000_add_addresses_and_order_shipping/migration.sql`

- [ ] **Step 1: Edit `backend/prisma/schema.prisma`**

Add to `User`:

```
addresses   Address[]
```

Add six columns to `Order` (after `decisionReason`):

```
shippingLine1      String? @map("shipping_line1")
shippingLine2      String? @map("shipping_line2")
shippingCity       String? @map("shipping_city")
shippingState      String? @map("shipping_state")
shippingPostalCode String? @map("shipping_postal_code")
shippingCountry    String? @map("shipping_country")
```

Add new model at the bottom of the file:

```
model Address {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  line1      String
  line2      String?
  city       String
  state      String
  postalCode String   @map("postal_code")
  country    String
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt  DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("addresses")
}
```

- [ ] **Step 2: Create migration SQL manually**

Create `backend/prisma/migrations/20260424120000_add_addresses_and_order_shipping/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "orders"
    ADD COLUMN "shipping_line1" TEXT,
    ADD COLUMN "shipping_line2" TEXT,
    ADD COLUMN "shipping_city" TEXT,
    ADD COLUMN "shipping_state" TEXT,
    ADD COLUMN "shipping_postal_code" TEXT,
    ADD COLUMN "shipping_country" TEXT;
```

- [ ] **Step 3: Apply migration and regenerate client**

Run: `cd backend && npm run db:migrate:deploy && npm run db:generate`
Expected: migration applied, Prisma client regenerated. If `npm run db:migrate:deploy` complains about a pending migration, use `npm run db:migrate` (dev). Confirm both `addresses` table and `orders.shipping_*` columns exist via `npm run db:studio` or `psql`.

- [ ] **Step 4: Sanity-check existing tests still compile**

Run: `cd backend && npm test`
Expected: the existing tests still PASS (we have not changed runtime behavior yet; the new Prisma client should import cleanly).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260424120000_add_addresses_and_order_shipping
git commit -m "feat(addresses): add addresses table and order shipping snapshot columns"
```

---

## Task 3: Addresses controller + routes

**Files:**
- Create: `backend/controllers/addressesController.js`
- Create: `backend/routes/addressesRoutes.js`
- Modify: `backend/routes/meRoutes.js`

- [ ] **Step 1: Write the controller**

Create `backend/controllers/addressesController.js`:

```javascript
import { prisma } from '../lib/prisma.js';
import { httpError, sendHttpError } from '../lib/httpError.js';
import { normalizeAddressInput } from '../lib/address.js';

const ADDRESS_SELECT = {
    id: true,
    line1: true,
    line2: true,
    city: true,
    state: true,
    postalCode: true,
    country: true,
    createdAt: true,
};

export async function listAddresses(req, res) {
    try {
        const addresses = await prisma.address.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            select: ADDRESS_SELECT,
        });
        res.json({ addresses });
    } catch (err) {
        console.error('listAddresses failed:', err);
        res.status(500).json({ error: 'Failed to load addresses' });
    }
}

export async function createAddress(req, res) {
    try {
        const parsed = normalizeAddressInput(req.body);
        if (!parsed.ok) {
            return sendHttpError(res, httpError(400, `Invalid ${parsed.field}`));
        }
        const address = await prisma.address.create({
            data: { userId: req.user.id, ...parsed.value },
            select: ADDRESS_SELECT,
        });
        res.status(201).json({ address });
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('createAddress failed:', err);
        res.status(500).json({ error: 'Failed to create address' });
    }
}

export async function updateAddress(req, res) {
    try {
        const parsed = normalizeAddressInput(req.body, { partial: true });
        if (!parsed.ok) {
            return sendHttpError(res, httpError(400, `Invalid ${parsed.field}`));
        }
        const existing = await prisma.address.findUnique({
            where: { id: req.params.id },
            select: { userId: true },
        });
        if (!existing) return sendHttpError(res, httpError(404, 'Address not found'));
        if (existing.userId !== req.user.id) {
            return sendHttpError(res, httpError(403, 'Forbidden'));
        }
        const address = await prisma.address.update({
            where: { id: req.params.id },
            data: parsed.value,
            select: ADDRESS_SELECT,
        });
        res.json({ address });
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('updateAddress failed:', err);
        res.status(500).json({ error: 'Failed to update address' });
    }
}

export async function deleteAddress(req, res) {
    try {
        const existing = await prisma.address.findUnique({
            where: { id: req.params.id },
            select: { userId: true },
        });
        if (!existing) return sendHttpError(res, httpError(404, 'Address not found'));
        if (existing.userId !== req.user.id) {
            return sendHttpError(res, httpError(403, 'Forbidden'));
        }
        await prisma.address.delete({ where: { id: req.params.id } });
        res.status(204).end();
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('deleteAddress failed:', err);
        res.status(500).json({ error: 'Failed to delete address' });
    }
}
```

- [ ] **Step 2: Write the router**

Create `backend/routes/addressesRoutes.js`:

```javascript
import express from 'express';
import {
    listAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
} from '../controllers/addressesController.js';

const router = express.Router();

router.get('/', listAddresses);
router.post('/', createAddress);
router.patch('/:id', updateAddress);
router.delete('/:id', deleteAddress);

export default router;
```

- [ ] **Step 3: Mount under `/me`**

Edit `backend/routes/meRoutes.js`:

```javascript
import express from 'express';
import { getMe, flushClicks } from '../controllers/meController.js';
import addressesRoutes from './addressesRoutes.js';

const router = express.Router();

router.get('/', getMe);
router.post('/clicks', flushClicks);
router.use('/addresses', addressesRoutes);

export default router;
```

- [ ] **Step 4: Smoke-test the endpoints**

Run: `cd backend && npm run dev` in one shell. In another shell, obtain an auth token by logging in through the frontend, then curl:

```bash
# list (empty initially)
curl -s -H "Authorization: Bearer <TOKEN>" http://127.0.0.1:3000/me/addresses

# create
curl -s -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"line1":"123 Main St","city":"Brooklyn","state":"NY","postalCode":"11201","country":"USA"}' \
  http://127.0.0.1:3000/me/addresses

# missing field → 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"line1":"x"}' http://127.0.0.1:3000/me/addresses
```

Expected: list returns `{ "addresses": [] }`, create returns 201 with address, missing field returns `400`. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/addressesController.js backend/routes/addressesRoutes.js backend/routes/meRoutes.js
git commit -m "feat(addresses): add /me/addresses CRUD endpoints"
```

---

## Task 4: Order creation snapshots the address

**Files:**
- Modify: `backend/services/orderService.js`
- Modify: `backend/controllers/orderController.js`

- [ ] **Step 1: Update `placeOrder` to accept and snapshot addressId**

Edit `backend/services/orderService.js`. Change the signature and insert address loading inside the transaction. Replace the `placeOrder` function body:

```javascript
import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { computeCartTotal } from '../lib/cart.js';
import { httpError } from '../lib/httpError.js';
import { snapshotAddress } from '../lib/address.js';
import { sendConfirmationEmail } from './mailerService.js';
import { supabaseAdmin } from '../lib/supabase.js';

export async function placeOrder(userId, { addressId } = {}) {
    if (!addressId || typeof addressId !== 'string') {
        throw httpError(400, 'addressId is required');
    }

    const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);

    const userProfile = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
    });

    const order = await prisma.$transaction(async (tx) => {
        const address = await tx.address.findUnique({
            where: { id: addressId },
            select: {
                userId: true,
                line1: true,
                line2: true,
                city: true,
                state: true,
                postalCode: true,
                country: true,
            },
        });
        if (!address) throw httpError(404, 'Address not found');
        if (address.userId !== userId) throw httpError(403, 'Forbidden');
        const shipping = snapshotAddress(address);

        const cartItems = await tx.cartItem.findMany({
            where: { userId },
            include: { product: { select: { name: true, id: true, price: true } } },
        });
        if (cartItems.length === 0) {
            throw httpError(400, 'Cart is empty');
        }

        const prices = Object.fromEntries(
            cartItems.map((ci) => [ci.product.id, ci.product.price]),
        );
        const items = cartItems.map((ci) => ({
            productId: ci.product.id,
            quantity: ci.quantity,
        }));
        const total = computeCartTotal(items, prices);

        const rows = await tx.$queryRaw`
            SELECT balance FROM users WHERE id = ${userId}::uuid FOR UPDATE
        `;
        if (rows.length === 0) {
            throw httpError(500, 'Profile missing');
        }
        const balance = rows[0].balance;
        if (balance < total) {
            throw httpError(402, 'Insufficient balance');
        }

        await tx.user.update({
            where: { id: userId },
            data: { balance: { decrement: total } },
        });

        for (const ci of cartItems) {
            const { count } = await tx.product.updateMany({
                where: { id: ci.product.id, stock: { gte: ci.quantity } },
                data: { stock: { decrement: ci.quantity } },
            });
            if (count === 0) {
                throw httpError(409, `Insufficient stock for ${ci.product.name}`);
            }
        }

        const order = await tx.order.create({
            data: {
                userId,
                total,
                status: OrderStatus.confirmed,
                ...shipping,
                items: {
                    create: cartItems.map((ci) => ({
                        productId: ci.product.id,
                        quantity: ci.quantity,
                        unitPrice: ci.product.price,
                    })),
                },
            },
            include: { items: true },
        });

        await tx.cartItem.deleteMany({ where: { userId } });

        return { createdOrder: order, cartItems };
    });

    if (authUser?.email && userProfile) {
        try {
            await sendConfirmationEmail({
                to: authUser.email,
                customerName: userProfile.displayName || 'Customer',
                orderDetails: {
                    orderId: order.createdOrder.id,
                    items: order.cartItems.map((item) => ({
                        name: item.product.name,
                        qty: item.quantity,
                        price: item.product.price,
                    })),
                    total: order.createdOrder.total,
                },
            });
        } catch (emailErr) {
            console.error('Email failed to send, but order was created:', emailErr.message);
        }
    }

    return order.createdOrder;
}
```

- [ ] **Step 2: Update controller to forward addressId**

Edit `backend/controllers/orderController.js`, replacing only the `createOrder` function:

```javascript
export async function createOrder(req, res) {
    try {
        const { addressId } = req.body ?? {};
        const order = await placeOrder(req.user.id, { addressId });
        res.status(201).json(order);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('createOrder failed:', err);
        res.status(500).json({ error: 'Order creation failed' });
    }
}
```

- [ ] **Step 3: Smoke test ordering end-to-end**

Run: `cd backend && npm run dev`. In the frontend (Task 7+ not yet done), manually call the endpoint via curl. Expected: POST with a valid `addressId` for the current user returns 201 and persists `shipping_*` on the new order row (verify in Studio); missing `addressId` returns 400; another user's addressId returns 403.

- [ ] **Step 4: Run existing tests**

Run: `cd backend && npm test`
Expected: all existing tests PASS. (The only test file that touches order behavior is `orderStateMachine.test.js`, which exercises transitions post-creation and should be unaffected.)

- [ ] **Step 5: Commit**

```bash
git add backend/services/orderService.js backend/controllers/orderController.js
git commit -m "feat(orders): snapshot shipping address on order creation"
```

---

## Task 5: Frontend addresses service + hook

**Files:**
- Create: `frontend/src/services/addressesService.js`
- Create: `frontend/src/hooks/useAddresses.js`

- [ ] **Step 1: Write the service**

Create `frontend/src/services/addressesService.js`:

```javascript
export async function fetchAddresses(authedFetch) {
  const res = await authedFetch('/me/addresses');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not load addresses');
  }
  const { addresses } = await res.json();
  return addresses;
}

export async function createAddress(authedFetch, input) {
  const res = await authedFetch('/me/addresses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not save address');
  }
  const { address } = await res.json();
  return address;
}

export async function updateAddress(authedFetch, id, input) {
  const res = await authedFetch(`/me/addresses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not update address');
  }
  const { address } = await res.json();
  return address;
}

export async function deleteAddress(authedFetch, id) {
  const res = await authedFetch(`/me/addresses/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not delete address');
  }
}
```

- [ ] **Step 2: Write the hook**

Create `frontend/src/hooks/useAddresses.js`:

```javascript
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import {
  fetchAddresses,
  createAddress as createAddressApi,
  updateAddress as updateAddressApi,
  deleteAddress as deleteAddressApi,
} from '../services/addressesService.js';

export function useAddresses() {
  const { authedFetch, user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchAddresses(authedFetch);
      setAddresses(list);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authedFetch, user]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (input) => {
    const created = await createAddressApi(authedFetch, input);
    setAddresses((prev) => [created, ...prev]);
    return created;
  }, [authedFetch]);

  const update = useCallback(async (id, input) => {
    const updated = await updateAddressApi(authedFetch, id, input);
    setAddresses((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, [authedFetch]);

  const remove = useCallback(async (id) => {
    await deleteAddressApi(authedFetch, id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  }, [authedFetch]);

  return { addresses, loading, error, refresh, create, update, remove };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/addressesService.js frontend/src/hooks/useAddresses.js
git commit -m "feat(addresses): add frontend service and useAddresses hook"
```

---

## Task 6: AddressForm component

**Files:**
- Create: `frontend/src/components/AddressForm.jsx`

- [ ] **Step 1: Write `AddressForm`**

Create `frontend/src/components/AddressForm.jsx`:

```jsx
import { useState } from 'react';

const INPUT_CLS =
  'w-full border border-line rounded-md px-3 py-2 text-sm bg-surface text-ink focus:outline-none focus:border-accent disabled:opacity-50';
const LABEL_CLS = 'text-[11px] uppercase tracking-wider text-muted mb-1 block';

const EMPTY = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

export default function AddressForm({ initial, submitLabel = 'Save', onSubmit, onCancel }) {
  const [values, setValues] = useState({ ...EMPTY, ...(initial ?? {}) });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function setField(field, v) {
    setValues((prev) => ({ ...prev, [field]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        line1: values.line1.trim(),
        line2: values.line2.trim() || null,
        city: values.city.trim(),
        state: values.state.trim(),
        postalCode: values.postalCode.trim(),
        country: values.country.trim(),
      };
      for (const required of ['line1', 'city', 'state', 'postalCode', 'country']) {
        if (!payload[required]) {
          setError(`${required} is required`);
          setSubmitting(false);
          return;
        }
      }
      await onSubmit(payload);
    } catch (err) {
      setError(err.message ?? 'Could not save address');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 bg-cream/40 border border-line rounded-xl p-4">
      <div className="col-span-2">
        <label className={LABEL_CLS}>Address line 1</label>
        <input className={INPUT_CLS} value={values.line1} onChange={(e) => setField('line1', e.target.value)} disabled={submitting} />
      </div>
      <div className="col-span-2">
        <label className={LABEL_CLS}>Address line 2 (optional)</label>
        <input className={INPUT_CLS} value={values.line2} onChange={(e) => setField('line2', e.target.value)} disabled={submitting} />
      </div>
      <div>
        <label className={LABEL_CLS}>City</label>
        <input className={INPUT_CLS} value={values.city} onChange={(e) => setField('city', e.target.value)} disabled={submitting} />
      </div>
      <div>
        <label className={LABEL_CLS}>State / region</label>
        <input className={INPUT_CLS} value={values.state} onChange={(e) => setField('state', e.target.value)} disabled={submitting} />
      </div>
      <div>
        <label className={LABEL_CLS}>Postal code</label>
        <input className={INPUT_CLS} value={values.postalCode} onChange={(e) => setField('postalCode', e.target.value)} disabled={submitting} />
      </div>
      <div>
        <label className={LABEL_CLS}>Country</label>
        <input className={INPUT_CLS} value={values.country} onChange={(e) => setField('country', e.target.value)} disabled={submitting} />
      </div>
      {error && <p className="col-span-2 text-danger text-sm">{error}</p>}
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        {onCancel && (
          <button type="button" disabled={submitting} onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-line text-ink hover:bg-cream disabled:opacity-50 transition-colors">
            Cancel
          </button>
        )}
        <button type="submit" disabled={submitting} className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 font-medium transition-colors">
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AddressForm.jsx
git commit -m "feat(addresses): add AddressForm component"
```

---

## Task 7: Address selector on checkout

**Files:**
- Create: `frontend/src/components/AddressSelector.jsx`
- Modify: `frontend/src/services/orderService.js`
- Modify: `frontend/src/hooks/usePlaceOrder.js`
- Modify: `frontend/src/pages/CheckoutPage.jsx`

The selector renders the list, owns selection, and also exposes inline edit/delete on each row plus an inline add-new form. There is no separate profile page — this component is the entire UX for address management in this iteration.

- [ ] **Step 1: Write `AddressSelector`**

Create `frontend/src/components/AddressSelector.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useAddresses } from '../hooks/useAddresses.js';
import AddressForm from './AddressForm.jsx';

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

export default function AddressSelector({ selectedId, onSelect }) {
  const { addresses, loading, error, create, update, remove } = useAddresses();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [rowError, setRowError] = useState(null);
  const [rowBusy, setRowBusy] = useState(false);

  useEffect(() => {
    if (!selectedId && addresses.length > 0) {
      onSelect(addresses[0].id);
    }
    if (selectedId && !addresses.some((a) => a.id === selectedId)) {
      onSelect(addresses[0]?.id ?? null);
    }
  }, [addresses, selectedId, onSelect]);

  if (loading) {
    return <p className="text-muted text-sm">Loading addresses…</p>;
  }

  if (error) {
    return <p className="text-danger text-sm">{error}</p>;
  }

  if (addresses.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted text-sm">Add a shipping address to continue.</p>
        <AddressForm
          submitLabel="Add address"
          onSubmit={async (payload) => {
            const created = await create(payload);
            onSelect(created.id);
          }}
        />
      </div>
    );
  }

  async function handleDelete(id) {
    setRowBusy(true);
    setRowError(null);
    try {
      await remove(id);
      setConfirmingDeleteId(null);
    } catch (err) {
      setRowError(err.message ?? 'Could not delete address');
    } finally {
      setRowBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <ul className="flex flex-col gap-2 list-none p-0 m-0">
        {addresses.map((a) => {
          if (editingId === a.id) {
            return (
              <li key={a.id}>
                <AddressForm
                  initial={a}
                  submitLabel="Save changes"
                  onSubmit={async (payload) => {
                    await update(a.id, payload);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            );
          }
          const isSelected = selectedId === a.id;
          const isConfirming = confirmingDeleteId === a.id;
          return (
            <li key={a.id}>
              <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${isSelected ? 'border-accent bg-cream/60' : 'border-line bg-surface'}`}>
                <label className="flex items-start gap-3 flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="address"
                    value={a.id}
                    checked={isSelected}
                    onChange={() => onSelect(a.id)}
                    className="mt-1 accent-accent"
                  />
                  <div className="text-sm text-ink leading-relaxed">
                    <div className="font-medium">{a.line1}{a.line2 ? `, ${a.line2}` : ''}</div>
                    <div className="text-muted text-xs">{a.city}, {a.state} {a.postalCode} · {a.country}</div>
                  </div>
                </label>
                <div className="flex items-center gap-1 shrink-0">
                  {isConfirming ? (
                    <>
                      <button type="button" disabled={rowBusy} onClick={() => handleDelete(a.id)} className="text-xs px-2 py-1 rounded-md bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50">
                        {rowBusy ? '…' : 'Confirm'}
                      </button>
                      <button type="button" disabled={rowBusy} onClick={() => { setConfirmingDeleteId(null); setRowError(null); }} className="text-xs px-2 py-1 rounded-md text-muted hover:text-ink">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setEditingId(a.id)} aria-label="Edit address" className="w-7 h-7 grid place-items-center rounded-md text-muted hover:text-accent hover:bg-cream transition-colors">
                        <PencilIcon />
                      </button>
                      <button type="button" onClick={() => { setConfirmingDeleteId(a.id); setRowError(null); }} aria-label="Delete address" className="w-7 h-7 grid place-items-center rounded-md text-muted hover:text-danger hover:bg-danger/5 transition-colors">
                        <TrashIcon />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {rowError && <p className="text-danger text-xs">{rowError}</p>}
      <div className="flex justify-end pt-1">
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="text-xs px-2.5 py-1 rounded-md border border-line text-ink hover:bg-cream"
          >
            Add new
          </button>
        )}
      </div>
      {showAddForm && (
        <div className="pt-2">
          <AddressForm
            submitLabel="Add address"
            onSubmit={async (payload) => {
              const created = await create(payload);
              onSelect(created.id);
              setShowAddForm(false);
            }}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Extend `placeOrder` client to send `addressId`**

Edit `frontend/src/services/orderService.js`. Replace only the `placeOrder` function:

```javascript
export async function placeOrder(authedFetch, { addressId }) {
  const res = await authedFetch('/orders', {
    method: 'POST',
    body: JSON.stringify({ addressId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      res.status === 402
        ? 'Not enough points to complete this order.'
        : res.status === 400
          ? (body.error ?? 'Your cart is empty.')
          : res.status === 403
            ? 'That address is not available. Pick another.'
            : (body.error ?? 'Something went wrong. Please try again.');
    throw new PlaceOrderError(res.status, message);
  }
  return res.json();
}
```

- [ ] **Step 3: Thread addressId through `usePlaceOrder`**

Edit `frontend/src/hooks/usePlaceOrder.js`. Replace the body:

```javascript
import { useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { placeOrder as placeOrderService } from '../services/orderService.js';

export function usePlaceOrder({ onSuccess } = {}) {
  const { authedFetch, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const placeOrder = async ({ addressId }) => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await placeOrderService(authedFetch, { addressId });
      await refreshProfile();
      if (onSuccess) onSuccess(created);
    } catch (err) {
      console.error('placeOrder failed:', err);
      setError(err?.message ?? 'Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return { placeOrder, submitting, error };
}
```

- [ ] **Step 4: Render the selector on `CheckoutPage`**

Edit `frontend/src/pages/CheckoutPage.jsx`. Add an import at the top:

```jsx
import AddressSelector from "../components/AddressSelector.jsx";
```

Add state inside the component, near `const [order, setOrder] = useState(null);`:

```jsx
const [addressId, setAddressId] = useState(null);
```

Change the `onClick` of the Place order button:

```jsx
onClick={() => placeOrder({ addressId })}
```

Extend the `disabled` condition to also require `!addressId`:

```jsx
disabled={
  entries.length === 0 ||
  submitting ||
  profileLoading ||
  insufficient ||
  !addressId
}
```

Add a new section immediately above the existing `<dl>` inside the `<aside>` summary block:

```jsx
<div>
  <div className="font-sans text-[11px] tracking-[0.22em] uppercase text-muted mb-2">Ship to</div>
  <AddressSelector selectedId={addressId} onSelect={setAddressId} />
</div>
<div className="h-px bg-line my-1" />
```

- [ ] **Step 5: Manual verification**

Run `npm run dev`. As a logged-in user with zero addresses, navigate to checkout: the inline "Add an address" form appears, Place order is disabled. Save an address; it pre-selects, Place order enables. Add a second address; the selection stays on the first. Edit an address inline; values persist. Delete an address via the inline confirm; if the deleted one was selected, selection falls back to the first remaining. Place an order; confirmation screen shows, order persists. In Studio, verify the new order row has the six `shipping_*` fields populated. As a second user, confirm their addresses are not visible in the selector.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AddressSelector.jsx frontend/src/services/orderService.js frontend/src/hooks/usePlaceOrder.js frontend/src/pages/CheckoutPage.jsx
git commit -m "feat(checkout): require and snapshot a shipping address at order time"
```

---

## Task 8: Admin OrderDetailDrawer shows shipping address

**Files:**
- Modify: `frontend/src/components/admin/OrderDetailDrawer.jsx`

- [ ] **Step 1: Add the shipping section**

Edit `frontend/src/components/admin/OrderDetailDrawer.jsx`. Inside the scrollable body (the `<div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">` block), add a new section after the Items `<ul>` and before the `requestReason` block:

```jsx
<div>
  <SectionLabel>Shipping address</SectionLabel>
  {order.shippingLine1 ? (
    <div className="bg-cream/50 border border-line rounded-lg px-3 py-2.5 text-sm text-ink leading-relaxed">
      <div>{order.shippingLine1}</div>
      {order.shippingLine2 && <div>{order.shippingLine2}</div>}
      <div>{order.shippingCity}, {order.shippingState} {order.shippingPostalCode}</div>
      <div>{order.shippingCountry}</div>
    </div>
  ) : (
    <p className="text-muted text-sm">No address on file</p>
  )}
</div>
```

- [ ] **Step 2: Confirm admin order responses already include the fields**

Check `backend/controllers/adminOrdersController.js` — if it uses a `select` clause, ensure the six `shipping*` fields are included. If it returns the full row (no `select`), no changes needed. Add them to the `select` if one exists.

Run: `grep -n "select\|shipping" backend/controllers/adminOrdersController.js`
Expected: either no `select` (nothing to change) or a `select` where you add the six fields.

- [ ] **Step 3: Manual verification**

Run the app. As an admin, open Orders → click an existing (pre-feature) order: "No address on file" shows. Click a newly placed order: the six fields render. Layout looks consistent with surrounding sections.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/OrderDetailDrawer.jsx backend/controllers/adminOrdersController.js
git commit -m "feat(admin): show shipping address in order detail drawer"
```

---

## Task 9: Documentation + verification sweep

**Files:**
- Modify: `docs/data-and-api.md` (if present)

- [ ] **Step 1: Update API and schema docs**

Run: `ls docs/`
If `docs/data-and-api.md` exists, add an "Addresses" subsection documenting the four endpoints and the new `addresses` table. Append the six `shipping_*` columns to the orders section. Match the existing format.

- [ ] **Step 2: Full verify pass**

Run all three concurrently (or sequentially):
- `cd backend && npm test` → all PASS
- `cd frontend && npm run lint` → clean
- `cd frontend && npm run build` → succeeds

- [ ] **Step 3: End-to-end manual smoke**

Log in as a new user → add items to cart → checkout. Confirm zero-address flow: inline form shows, Place order disabled. Add an address → selected, button enabled. Add a second, edit it, delete it — selection handled correctly. Place order → confirmation screen. Log in as admin → Orders → open the new order → shipping address visible. Verify `orders.shipping_*` in Studio for that row.

- [ ] **Step 4: Commit docs if any**

```bash
git add docs
git commit -m "docs(addresses): document addresses endpoints and order snapshot columns"
```

(Skip the commit if nothing changed.)

---

## Notes for the implementer

- **ESM imports must include `.js` extensions** in backend files. Frontend uses Vite and does not require extensions.
- **Prisma client singleton:** always `import { prisma } from '../lib/prisma.js'` — never construct `new PrismaClient()`.
- **Integers only** for prices/balances; nothing about addresses touches those paths.
- **Auth:** `requireAuth` is applied at the `/me` mount in `server.js`; the addresses controllers assume `req.user.id` is present.
- **Order of checks matters** in controllers: parse body first, then find row, then ownership, then mutate. 404 for missing row, 403 for wrong owner.
- **Existing tests pattern:** pure-helper `node:test` only. Resist adding an integration harness in this change.
