# Admin Pagination + Skeleton Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side pagination to all three admin tabs (Orders, Products, Users) — page size 10 with a "Load more" button — and stabilize column widths so headers don't shift between skeleton and loaded states. Move the Products "popularity" sort from client-side to server-side.

**Architecture:** Backend list endpoints accept `take`/`skip` and return `{ items, total, hasMore }`. A shared `parsePagination` helper validates pagination params. Frontend hooks track an in-memory page (items array) plus `total`/`hasMore`/`loadingMore`, with a `loadMore()` action that appends. A new `LoadMoreFooter` component renders "Showing X of Y" and the button. Tables use `table-layout: fixed` with explicit `<colgroup>` widths so column boundaries are content-independent.

**Tech Stack:** Node 20 ESM, Express 5, Prisma, Postgres. React 18, Vite, Tailwind. Backend tests via `node:test` against pure helper modules; frontend has no automated tests (manual verification).

**Reference spec:** `docs/superpowers/specs/2026-05-04-admin-pagination-design.md`

**Branch:** Already on `feat/admin-pagination`. The spec and this plan are committed together before Task 1 starts (a single doc commit), so each task below begins from a clean tree.

**Conventions for the worker:**
- Backend is ESM. Relative imports include `.js`.
- Prisma client comes from `backend/lib/prisma.js` (singleton). Do not instantiate `new PrismaClient()` anywhere.
- Run `cd backend && node --test tests/<file>` to run a single test file. (`npm test` runs all.)
- Run `cd frontend && npm run lint` after frontend changes.
- Commit messages use Conventional Commits prefixes (`feat:`, `fix:`, `refactor:`, `test:`).
- Never use `git commit --no-verify`.
- All admin endpoints already require auth + admin via Express middleware; do not re-check.

---

### Task 1: `parsePagination` helper + unit tests

**Files:**
- Create: `backend/lib/pagination.js`
- Create: `backend/tests/pagination.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/pagination.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePagination } from '../lib/pagination.js';

test('parsePagination: defaults to take=10, skip=0 when params absent', () => {
    assert.deepEqual(parsePagination({}), { take: 10, skip: 0 });
});

test('parsePagination: parses valid string-encoded integers', () => {
    assert.deepEqual(parsePagination({ take: '5', skip: '20' }), { take: 5, skip: 20 });
});

test('parsePagination: clamps take above 50 silently', () => {
    assert.deepEqual(parsePagination({ take: '999' }), { take: 50, skip: 0 });
});

test('parsePagination: rejects take=0', () => {
    assert.throws(() => parsePagination({ take: '0' }), /invalid take/i);
});

test('parsePagination: rejects negative take', () => {
    assert.throws(() => parsePagination({ take: '-1' }), /invalid take/i);
});

test('parsePagination: rejects non-integer take', () => {
    assert.throws(() => parsePagination({ take: '1.5' }), /invalid take/i);
    assert.throws(() => parsePagination({ take: 'abc' }), /invalid take/i);
});

test('parsePagination: rejects negative skip', () => {
    assert.throws(() => parsePagination({ skip: '-1' }), /invalid skip/i);
});

test('parsePagination: rejects non-integer skip', () => {
    assert.throws(() => parsePagination({ skip: '1.5' }), /invalid skip/i);
    assert.throws(() => parsePagination({ skip: 'xyz' }), /invalid skip/i);
});

test('parsePagination: skip=0 is allowed', () => {
    assert.deepEqual(parsePagination({ skip: '0' }), { take: 10, skip: 0 });
});

test('parsePagination: thrown errors carry status 400', () => {
    try {
        parsePagination({ take: '0' });
        assert.fail('should have thrown');
    } catch (err) {
        assert.equal(err.http, 400);
    }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && node --test tests/pagination.test.js`
Expected: FAIL — `Cannot find module '../lib/pagination.js'`.

- [ ] **Step 3: Implement the helper**

Create `backend/lib/pagination.js`:

```js
import { httpError } from './httpError.js';

const MAX_TAKE = 50;

function parseIntStrict(value, label) {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'number') {
        if (!Number.isInteger(value)) throw httpError(400, `Invalid ${label}`);
        return value;
    }
    if (typeof value !== 'string') throw httpError(400, `Invalid ${label}`);
    if (!/^-?\d+$/.test(value)) throw httpError(400, `Invalid ${label}`);
    return Number(value);
}

export function parsePagination(query) {
    const rawTake = parseIntStrict(query.take, 'take');
    const rawSkip = parseIntStrict(query.skip, 'skip');

    const take = rawTake === undefined ? 10 : rawTake;
    const skip = rawSkip === undefined ? 0 : rawSkip;

    if (take < 1) throw httpError(400, 'Invalid take');
    if (skip < 0) throw httpError(400, 'Invalid skip');

    return { take: Math.min(MAX_TAKE, take), skip };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && node --test tests/pagination.test.js`
Expected: PASS — all 10 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/lib/pagination.js backend/tests/pagination.test.js
git commit -m "$(cat <<'EOF'
feat(backend): add parsePagination helper with validation

Shared helper for admin list endpoints. Validates take/skip
as non-negative integers, defaults to take=10, clamps take to 50.
EOF
)"
```

---

### Task 2: Paginate `GET /admin/orders`

**Files:**
- Modify: `backend/controllers/adminOrdersController.js` — `listAllOrders` only.

- [ ] **Step 1: Update `listAllOrders` to use pagination + new envelope**

Replace the body of `listAllOrders` in `backend/controllers/adminOrdersController.js`:

```js
export async function listAllOrders(req, res) {
    try {
        const { status } = req.query;
        if (status && !STATUS_VALUES.has(status)) {
            return res.status(400).json({ error: 'Invalid status filter' });
        }
        const { take, skip } = parsePagination(req.query);
        const where = status ? { status } : undefined;

        const [items, total] = await Promise.all([
            prisma.order.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take,
                skip,
                include: {
                    user: { select: { id: true, displayName: true } },
                    items: { include: { product: { select: { name: true, imageUrl: true } } } },
                },
            }),
            prisma.order.count({ where }),
        ]);

        res.json({ items, total, hasMore: skip + items.length < total });
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('listAllOrders failed:', err);
        res.status(500).json({ error: 'Failed to load orders' });
    }
}
```

Add the import at the top of the file (after existing imports):

```js
import { parsePagination } from '../lib/pagination.js';
```

- [ ] **Step 2: Run all backend tests to verify nothing breaks**

Run: `cd backend && npm test`
Expected: PASS (existing tests don't hit this endpoint; nothing should regress).

- [ ] **Step 3: Sanity-check manually with curl**

Start backend: `cd backend && npm run dev` (in another terminal).
Then with an admin auth token in `$TOKEN`:

```bash
curl -s -H "Authorization: Bearer $TOKEN" 'http://127.0.0.1:3000/admin/orders?take=2' | jq '. | {len: (.items|length), total, hasMore}'
```

Expected: `{ "len": 2, "total": <N>, "hasMore": true|false }` (or `len: 0` and `hasMore: false` if there are no orders).

If you don't have a quick way to get a token, skip and rely on the manual verification at the end of the frontend tasks.

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/adminOrdersController.js
git commit -m "$(cat <<'EOF'
feat(admin): paginate GET /admin/orders

Adds take/skip params, returns { items, total, hasMore }.
Renames the response key from `orders` to `items` for consistency
with the upcoming products and users endpoints.
EOF
)"
```

---

### Task 3: Paginate `GET /admin/products` + server-side sort

**Files:**
- Modify: `backend/controllers/adminProductsController.js` — `listProducts` and `withAdminRatings`.

- [ ] **Step 1: Update `withAdminRatings` to scope the aggregate to the page**

In `backend/controllers/adminProductsController.js`, replace `withAdminRatings`:

```js
async function withAdminRatings(products) {
    if (products.length === 0) return [];
    const productIds = products.map(p => p.id);
    const aggs = await prisma.review.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _avg: { rating: true },
    });
    const avgMap = Object.fromEntries(aggs.map(a => [a.productId, a._avg.rating]));
    return products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        type: p.type,
        price: p.price,
        stock: p.stock,
        archivedAt: p.archivedAt,
        createdAt: p.createdAt,
        avgRating: avgMap[p.id] ?? null,
        reviewCount: p._count.reviews,
    }));
}
```

- [ ] **Step 2: Update `listProducts` to support pagination + sort + envelope**

Replace `listProducts` in the same file:

```js
const PRODUCT_SORTS = {
    newest:     [{ createdAt: 'desc' }],
    popularity: [{ reviews: { _count: 'desc' } }, { createdAt: 'desc' }],
};

export async function listProducts(req, res) {
    try {
        const includeArchived = req.query.includeArchived === 'true';
        const sortKey = req.query.sort ?? 'newest';
        if (!PRODUCT_SORTS[sortKey]) {
            throw httpError(400, 'Invalid sort');
        }
        const { take, skip } = parsePagination(req.query);
        const where = includeArchived ? undefined : { archivedAt: null };

        const [rawItems, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy: PRODUCT_SORTS[sortKey],
                take,
                skip,
                select: ADMIN_PRODUCT_SELECT,
            }),
            prisma.product.count({ where }),
        ]);

        const items = await withAdminRatings(rawItems);
        res.json({ items, total, hasMore: skip + items.length < total });
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('listProducts failed:', err);
        res.status(500).json({ error: 'Failed to load products' });
    }
}
```

Add the import at the top of the file (after existing imports):

```js
import { parsePagination } from '../lib/pagination.js';
```

- [ ] **Step 3: Run backend tests**

Run: `cd backend && npm test`
Expected: PASS — no regressions.

- [ ] **Step 4: Sanity-check manually with curl (optional)**

```bash
curl -s -H "Authorization: Bearer $TOKEN" 'http://127.0.0.1:3000/admin/products?take=3&sort=popularity' | jq '. | {len: (.items|length), total, hasMore, first_review_count: .items[0].reviewCount}'
```

Expected: items ordered by descending review count.

```bash
curl -s -H "Authorization: Bearer $TOKEN" 'http://127.0.0.1:3000/admin/products?sort=bogus' | jq
```

Expected: `{ "error": "Invalid sort" }` with status 400.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/adminProductsController.js
git commit -m "$(cat <<'EOF'
feat(admin): paginate GET /admin/products + server-side sort

Adds take/skip + sort=newest|popularity. Popularity now means
'most-reviewed' (Prisma orderBy on reviews._count) — a 5★ item
with 1 review no longer outranks a 4.7★ item with 80 reviews.
withAdminRatings now scopes the avg-rating groupBy to the
visible page instead of the whole table.
EOF
)"
```

---

### Task 4: Paginate `GET /admin/users`

**Files:**
- Modify: `backend/controllers/adminUsersController.js` — `listUsers` only.

- [ ] **Step 1: Update `listUsers`**

Replace `listUsers` in `backend/controllers/adminUsersController.js`:

```js
export async function listUsers(req, res) {
    try {
        const { take, skip } = parsePagination(req.query);
        const [rawItems, total] = await Promise.all([
            prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                take,
                skip,
                select: {
                    id: true,
                    displayName: true,
                    role: true,
                    balance: true,
                    createdAt: true,
                    _count: { select: { orders: true } },
                },
            }),
            prisma.user.count(),
        ]);
        const items = rawItems.map((u) => ({
            id: u.id,
            displayName: u.displayName,
            role: u.role,
            balance: u.balance,
            createdAt: u.createdAt,
            orderCount: u._count.orders,
        }));
        res.json({ items, total, hasMore: skip + items.length < total });
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('listUsers failed:', err);
        res.status(500).json({ error: 'Failed to load users' });
    }
}
```

Add the import at the top:

```js
import { parsePagination } from '../lib/pagination.js';
```

- [ ] **Step 2: Run backend tests**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/controllers/adminUsersController.js
git commit -m "$(cat <<'EOF'
feat(admin): paginate GET /admin/users

Adds take/skip, returns { items, total, hasMore }.
EOF
)"
```

---

### Task 5: Update frontend services to new envelope + params

**Files:**
- Modify: `frontend/src/services/admin/adminOrdersService.js` — `listOrders`.
- Modify: `frontend/src/services/admin/adminProductsService.js` — `listProducts`.
- Modify: `frontend/src/services/admin/adminUsersService.js` — `listUsers`.

- [ ] **Step 1: Update `listOrders`**

Replace `listOrders` in `frontend/src/services/admin/adminOrdersService.js`:

```js
export async function listOrders(authedFetch, { status, take = 10, skip = 0 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('take', String(take));
  params.set('skip', String(skip));
  const res = await authedFetch(`/admin/orders?${params}`);
  if (!res.ok) throw new Error('Failed to load orders');
  const body = await res.json();
  return {
    items: body.items ?? [],
    total: body.total ?? 0,
    hasMore: body.hasMore ?? false,
  };
}
```

- [ ] **Step 2: Update `listProducts`**

Replace `listProducts` in `frontend/src/services/admin/adminProductsService.js`:

```js
export async function listProducts(authedFetch, { includeArchived = false, sort = 'newest', take = 10, skip = 0 } = {}) {
  const params = new URLSearchParams();
  if (includeArchived) params.set('includeArchived', 'true');
  params.set('sort', sort);
  params.set('take', String(take));
  params.set('skip', String(skip));
  const res = await authedFetch(`/admin/products?${params}`);
  if (!res.ok) throw new Error('Failed to load products');
  const body = await res.json();
  return {
    items: body.items ?? [],
    total: body.total ?? 0,
    hasMore: body.hasMore ?? false,
  };
}
```

- [ ] **Step 3: Update `listUsers`**

Replace `listUsers` in `frontend/src/services/admin/adminUsersService.js`:

```js
export async function listUsers(authedFetch, { take = 10, skip = 0 } = {}) {
  const params = new URLSearchParams({ take: String(take), skip: String(skip) });
  const res = await authedFetch(`/admin/users?${params}`);
  if (!res.ok) throw new Error('Failed to load users');
  const body = await res.json();
  return {
    items: body.items ?? [],
    total: body.total ?? 0,
    hasMore: body.hasMore ?? false,
  };
}
```

- [ ] **Step 4: Run frontend lint**

Run: `cd frontend && npm run lint`
Expected: PASS (no lint errors introduced).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/admin/
git commit -m "$(cat <<'EOF'
feat(admin): update frontend services for paginated envelope

listOrders/listProducts/listUsers now accept take/skip and return
{ items, total, hasMore }. listProducts also accepts sort.
Hooks/components in subsequent commits.
EOF
)"
```

---

### Task 6: Rewrite `useAdminUsers` for pagination

**Files:**
- Modify: `frontend/src/hooks/admin/useAdminUsers.js`.

This is the simplest of the three hooks (no filters beyond pagination), so we tackle it first to establish the pattern.

- [ ] **Step 1: Rewrite the hook**

Replace the entire contents of `frontend/src/hooks/admin/useAdminUsers.js`:

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import * as api from '../../services/admin/adminUsersService.js';

const PAGE_SIZE = 10;

export function useAdminUsers() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listUsers(authedFetch, { take: PAGE_SIZE, skip: 0 });
      if (requestIdRef.current !== reqId) return;
      setItems(data.items);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      if (requestIdRef.current !== reqId) return;
      setError(err.message);
    } finally {
      if (requestIdRef.current === reqId) setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const reqId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const data = await api.listUsers(authedFetch, { take: PAGE_SIZE, skip: items.length });
      if (requestIdRef.current !== reqId) return;
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      if (requestIdRef.current !== reqId) return;
      setError(err.message);
    } finally {
      if (requestIdRef.current === reqId) setLoadingMore(false);
    }
  }, [authedFetch, hasMore, loadingMore, items.length]);

  const getOne = useCallback((id) => api.getUser(authedFetch, id), [authedFetch]);

  const setRole = useCallback(async (id, role) => {
    const updated = await api.updateRole(authedFetch, id, role);
    setItems((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
    return updated;
  }, [authedFetch]);

  const adjustBalance = useCallback(async (id, delta) => {
    const updated = await api.adjustBalance(authedFetch, id, delta);
    setItems((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
    return updated;
  }, [authedFetch]);

  return {
    items, total, hasMore,
    loading, loadingMore, error,
    refresh, loadMore,
    getOne, setRole, adjustBalance,
  };
}
```

- [ ] **Step 2: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/admin/useAdminUsers.js
git commit -m "$(cat <<'EOF'
feat(admin): paginate useAdminUsers

Returns items/total/hasMore plus loadMore/loadingMore.
Stale-response guard via requestIdRef prevents in-flight
loadMore from overwriting a fresh refresh.
EOF
)"
```

---

### Task 7: Rewrite `useAdminOrders` for pagination

**Files:**
- Modify: `frontend/src/hooks/admin/useAdminOrders.js`.

- [ ] **Step 1: Rewrite the hook**

Replace the entire contents of `frontend/src/hooks/admin/useAdminOrders.js`:

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import * as api from '../../services/admin/adminOrdersService.js';

const PAGE_SIZE = 10;

export function useAdminOrders() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const args = { take: PAGE_SIZE, skip: 0, ...(status ? { status } : {}) };
      const data = await api.listOrders(authedFetch, args);
      if (requestIdRef.current !== reqId) return;
      setItems(data.items);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      if (requestIdRef.current !== reqId) return;
      setError(err.message);
    } finally {
      if (requestIdRef.current === reqId) setLoading(false);
    }
  }, [authedFetch, status]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const reqId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const args = { take: PAGE_SIZE, skip: items.length, ...(status ? { status } : {}) };
      const data = await api.listOrders(authedFetch, args);
      if (requestIdRef.current !== reqId) return;
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      if (requestIdRef.current !== reqId) return;
      setError(err.message);
    } finally {
      if (requestIdRef.current === reqId) setLoadingMore(false);
    }
  }, [authedFetch, hasMore, loadingMore, items.length, status]);

  const transition = useCallback(async (id, action, reason) => {
    const updated = await api.transitionOrder(authedFetch, id, action, reason);
    setItems((prev) => {
      const next = prev.map((o) => (o.id === id ? { ...o, ...updated } : o));
      if (status && updated.status !== status) {
        setTotal((t) => Math.max(0, t - 1));
        return next.filter((o) => o.id !== id);
      }
      return next;
    });
    return updated;
  }, [authedFetch, status]);

  return {
    items, total, hasMore, status,
    loading, loadingMore, error,
    refresh, loadMore, setStatus, transition,
  };
}
```

- [ ] **Step 2: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/admin/useAdminOrders.js
git commit -m "$(cat <<'EOF'
feat(admin): paginate useAdminOrders

Adds loadMore + envelope state. transition() decrements total
when the new status no longer matches the active filter so the
'Showing N of M' footer stays accurate.
EOF
)"
```

---

### Task 8: Rewrite `useAdminProducts` for pagination + server-side sort

**Files:**
- Modify: `frontend/src/hooks/admin/useAdminProducts.js`.

- [ ] **Step 1: Rewrite the hook**

Replace the entire contents of `frontend/src/hooks/admin/useAdminProducts.js`:

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import * as api from '../../services/admin/adminProductsService.js';

const PAGE_SIZE = 10;

export function useAdminProducts() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(true);
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listProducts(authedFetch, {
        includeArchived, sort, take: PAGE_SIZE, skip: 0,
      });
      if (requestIdRef.current !== reqId) return;
      setItems(data.items);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      if (requestIdRef.current !== reqId) return;
      setError(err.message);
    } finally {
      if (requestIdRef.current === reqId) setLoading(false);
    }
  }, [authedFetch, includeArchived, sort]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const reqId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const data = await api.listProducts(authedFetch, {
        includeArchived, sort, take: PAGE_SIZE, skip: items.length,
      });
      if (requestIdRef.current !== reqId) return;
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      if (requestIdRef.current !== reqId) return;
      setError(err.message);
    } finally {
      if (requestIdRef.current === reqId) setLoadingMore(false);
    }
  }, [authedFetch, hasMore, loadingMore, items.length, includeArchived, sort]);

  const create = useCallback(async (data) => {
    const created = await api.createProduct(authedFetch, data);
    setItems((prev) => [{ ...created, avgRating: null, reviewCount: 0 }, ...prev]);
    setTotal((t) => t + 1);
    return created;
  }, [authedFetch]);

  const update = useCallback(async (id, data) => {
    const updated = await api.updateProduct(authedFetch, id, data);
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    return updated;
  }, [authedFetch]);

  const archive = useCallback(async (id) => {
    const updated = await api.archiveProduct(authedFetch, id);
    setItems((prev) => {
      if (!includeArchived) {
        setTotal((t) => Math.max(0, t - 1));
        return prev.filter((p) => p.id !== id);
      }
      return prev.map((p) => (p.id === id ? { ...p, ...updated } : p));
    });
    return updated;
  }, [authedFetch, includeArchived]);

  const unarchive = useCallback(async (id) => {
    const updated = await api.unarchiveProduct(authedFetch, id);
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    return updated;
  }, [authedFetch]);

  return {
    items, total, hasMore,
    includeArchived, setIncludeArchived,
    sort, setSort,
    loading, loadingMore, error,
    refresh, loadMore,
    create, update, archive, unarchive,
  };
}
```

- [ ] **Step 2: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/admin/useAdminProducts.js
git commit -m "$(cat <<'EOF'
feat(admin): paginate useAdminProducts + server-side sort

Drops client-side sortProducts in favor of a server-driven
sort=newest|popularity. create increments total; archive when
!includeArchived removes from items and decrements total.
EOF
)"
```

---

### Task 9: `LoadMoreFooter` component

**Files:**
- Create: `frontend/src/components/admin/LoadMoreFooter.jsx`.

- [ ] **Step 1: Create the component**

Create `frontend/src/components/admin/LoadMoreFooter.jsx`:

```jsx
export default function LoadMoreFooter({ shown, total, hasMore, loading, loadingMore, onLoadMore }) {
  if (loading) return null;
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-sm text-muted">
        Showing {shown} of {total}
      </span>
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="px-3 py-1.5 text-sm rounded-md border border-line text-ink hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/LoadMoreFooter.jsx
git commit -m "$(cat <<'EOF'
feat(admin): add LoadMoreFooter component

Renders 'Showing X of Y' + Load more button. Hidden during
the initial skeleton load and when total is 0.
EOF
)"
```

---

### Task 10: `OrdersTab` — fixed table layout, footer, items rename

**Files:**
- Modify: `frontend/src/components/admin/OrdersTab.jsx`.

- [ ] **Step 1: Update the file**

Replace the entire contents of `frontend/src/components/admin/OrdersTab.jsx`:

```jsx
import { useState } from 'react';
import { useAdminOrders } from '../../hooks/admin/useAdminOrders.js';
import StatusBadge from '../StatusBadge.jsx';
import StatusFilter from './StatusFilter.jsx';
import OrderDetailDrawer from './OrderDetailDrawer.jsx';
import LoadMoreFooter from './LoadMoreFooter.jsx';

const COLUMNS = ['Order', 'Customer', 'Items', 'Total', 'Status', 'Date'];

function SkeletonRow() {
  return (
    <tr className="border-b border-line animate-pulse">
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-20" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-32" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-8" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-cream rounded-full w-24" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-28" /></td>
    </tr>
  );
}

export default function OrdersTab() {
  const {
    items, total, hasMore, status,
    loading, loadingMore, error,
    refresh, loadMore, setStatus, transition,
  } = useAdminOrders();
  const [selected, setSelected] = useState(null);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <StatusFilter value={status} onChange={setStatus} />
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 border border-line rounded-md px-3 py-1.5 text-sm text-ink hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
              clipRule="evenodd"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border border-line bg-danger/10 text-danger rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '8rem'  }} />
            <col />
            <col style={{ width: '4rem'  }} />
            <col style={{ width: '6rem'  }} />
            <col style={{ width: '9rem'  }} />
            <col style={{ width: '12rem' }} />
          </colgroup>
          <thead>
            <tr className="bg-cream/60 border-b border-line">
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left text-[11px] uppercase tracking-widest text-muted font-medium"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No orders found.
                </td>
              </tr>
            ) : (
              items.map((order, idx) => (
                <tr
                  key={order.id}
                  onClick={() => setSelected(order)}
                  className={`border-b border-line last:border-b-0 cursor-pointer hover:bg-accent/5 transition-colors duration-100 ${
                    idx % 2 === 1 ? 'bg-cream/30' : 'bg-surface'
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-muted truncate">
                    #{order.id.slice(-8)}
                  </td>
                  <td className="px-4 py-3 text-ink truncate">
                    {order.user?.displayName || '—'}
                  </td>
                  <td className="px-4 py-3 text-ink">{order.items.length}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{order.total} pts</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-muted truncate">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LoadMoreFooter
        shown={items.length}
        total={total}
        hasMore={hasMore}
        loading={loading}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
      />

      {selected && (
        <OrderDetailDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onTransition={async (action, reason) => {
            const updated = await transition(selected.id, action, reason);
            setSelected(updated);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev` from repo root. Navigate to `/admin`, log in as admin, view Orders tab.

Verify:
- Skeleton rows render on initial load.
- Once data loads, column header positions do *not* shift left.
- "Showing N of M" appears below the table.
- "Load more" appears when M > N; clicking appends 10 more rows.
- Changing the status filter resets to page 1.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/OrdersTab.jsx
git commit -m "$(cat <<'EOF'
feat(admin): paginate OrdersTab with stable column widths

Renames orders -> items, adds LoadMoreFooter, switches table
to table-fixed with explicit colgroup widths so headers no
longer shift between skeleton and loaded states.
EOF
)"
```

---

### Task 11: `ProductsTab` — fixed table, server-side sort wiring, footer

**Files:**
- Modify: `frontend/src/components/admin/ProductsTab.jsx`.

- [ ] **Step 1: Update the file**

Replace the entire contents of `frontend/src/components/admin/ProductsTab.jsx`:

```jsx
import { useState } from 'react';
import { useAdminProducts } from '../../hooks/admin/useAdminProducts.js';
import ProductEditModal from './ProductEditModal.jsx';
import ProductReviewsDrawer from './ProductReviewsDrawer.jsx';
import LoadMoreFooter from './LoadMoreFooter.jsx';

const COLUMNS = ['', 'Name', 'Type', 'Price', 'Stock', 'Rating', 'Status', 'Actions'];

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest' },
  { value: 'popularity', label: 'Popularity (most reviews)' },
];

function StarDisplay({ avgRating, reviewCount }) {
  if (!reviewCount) return <span className="text-muted text-xs">—</span>;
  return (
    <span className="text-sm text-ink">
      ★ {Number(avgRating).toFixed(1)} ({reviewCount})
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-line animate-pulse">
      <td className="px-4 py-3"><div className="w-6 h-6 bg-cream rounded-md" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-36" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-10" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-cream rounded-full w-16" /></td>
      <td className="px-4 py-3"><div className="h-8 bg-cream rounded w-36" /></td>
    </tr>
  );
}

export default function ProductsTab() {
  const {
    items, total, hasMore,
    includeArchived, setIncludeArchived,
    sort, setSort,
    loading, loadingMore, error,
    loadMore,
    create, update, archive, unarchive,
  } = useAdminProducts();

  const [editing, setEditing] = useState(null);
  const [mutating, setMutating] = useState(null);
  const [reviewProduct, setReviewProduct] = useState(null);

  async function handleArchiveToggle(product) {
    if (mutating) return;
    setMutating(product.id);
    try {
      if (product.archivedAt) {
        await unarchive(product.id);
      } else {
        await archive(product.id);
      }
    } finally {
      setMutating(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded border-line accent-accent"
          />
          Include archived
        </label>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[14px] text-ink outline-none transition-shadow focus:shadow-card"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <button
            onClick={() => setEditing({ mode: 'create' })}
            className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark transition-colors font-medium"
          >
            + New product
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border border-line bg-danger/10 text-danger rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '3.5rem' }} />
            <col />
            <col style={{ width: '6rem'  }} />
            <col style={{ width: '5rem'  }} />
            <col style={{ width: '5rem'  }} />
            <col style={{ width: '7rem'  }} />
            <col style={{ width: '6rem'  }} />
            <col style={{ width: '15rem' }} />
          </colgroup>
          <thead>
            <tr className="bg-cream/60 border-b border-line">
              {COLUMNS.map((col, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 text-left text-[11px] uppercase tracking-widest text-muted font-medium"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  No products.
                </td>
              </tr>
            ) : (
              items.map((product, idx) => (
                <tr
                  key={product.id}
                  className={`border-b border-line last:border-b-0 transition-colors duration-100 ${
                    idx % 2 === 1 ? 'bg-cream/30' : 'bg-surface'
                  } ${product.archivedAt ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-6 h-6 rounded-md object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-md bg-line" />
                    )}
                  </td>

                  <td className="px-4 py-3 font-medium text-ink truncate">{product.name}</td>

                  <td className="px-4 py-3 text-muted capitalize">{product.type}</td>

                  <td className="px-4 py-3 text-ink font-mono">{product.price} pts</td>

                  <td className="px-4 py-3 text-ink font-mono">{product.stock}</td>

                  <td className="px-4 py-3">
                    <StarDisplay avgRating={product.avgRating} reviewCount={product.reviewCount} />
                  </td>

                  <td className="px-4 py-3">
                    {product.archivedAt ? (
                      <span className="text-muted text-xs uppercase tracking-widest">
                        Archived
                      </span>
                    ) : (
                      <span className="text-accent text-xs uppercase tracking-widest font-medium">
                        Active
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReviewProduct(product)}
                        className="px-3 py-1 text-xs rounded border border-line hover:bg-cream text-ink transition-colors"
                      >
                        Reviews
                      </button>
                      <button
                        onClick={() => setEditing({ mode: 'edit', product })}
                        className="px-3 py-1 text-xs rounded border border-line hover:bg-cream text-ink transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleArchiveToggle(product)}
                        disabled={mutating === product.id}
                        className={`px-3 py-1 text-xs rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          product.archivedAt
                            ? 'border-accent/40 text-accent hover:bg-accent/5'
                            : 'border-line text-muted hover:bg-cream'
                        }`}
                      >
                        {mutating === product.id
                          ? '…'
                          : product.archivedAt
                          ? 'Unarchive'
                          : 'Archive'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LoadMoreFooter
        shown={items.length}
        total={total}
        hasMore={hasMore}
        loading={loading}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
      />

      {editing && (
        <ProductEditModal
          mode={editing.mode}
          product={editing.product}
          onClose={() => setEditing(null)}
          onCreate={create}
          onUpdate={update}
        />
      )}

      {reviewProduct && (
        <ProductReviewsDrawer
          product={reviewProduct}
          onClose={() => setReviewProduct(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual smoke check**

Navigate to `/admin` → Products tab.

Verify:
- Initial load shows 10 products with skeletons; columns don't shift on load.
- "Sort by" dropdown shows "Newest" / "Popularity (most reviews)".
- Switching to Popularity reorders by review count desc; pagination resets to page 1.
- Toggling "Include archived" resets to page 1, total updates.
- "+ New product" creates and prepends; total increments.
- Archive (with `Include archived` off) removes from view, total decrements.
- "Load more" appends 10 more.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/ProductsTab.jsx
git commit -m "$(cat <<'EOF'
feat(admin): paginate ProductsTab with server-side sort

Replaces client-side sortProducts with hook-driven sort param.
Renames Default -> Newest and Popularity label clarifies the
new 'most reviews' meaning. Adds table-fixed + colgroup +
LoadMoreFooter.
EOF
)"
```

---

### Task 12: `UsersTab` — fixed table, footer, items rename

**Files:**
- Modify: `frontend/src/components/admin/UsersTab.jsx`.

- [ ] **Step 1: Update the file**

Replace the entire contents of `frontend/src/components/admin/UsersTab.jsx`:

```jsx
import { useState } from 'react';
import { useAdminUsers } from '../../hooks/admin/useAdminUsers.js';
import { useAuth } from '../../auth/useAuth.js';
import UserDetailDrawer from './UserDetailDrawer.jsx';
import LoadMoreFooter from './LoadMoreFooter.jsx';

const COLUMNS = ['Display name', 'Role', 'Balance', 'Orders', 'Joined'];

function SkeletonRow() {
  return (
    <tr className="border-b border-line animate-pulse">
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-32" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-cream rounded-full w-20" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-8" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-24" /></td>
    </tr>
  );
}

export default function UsersTab() {
  const { user } = useAuth();
  const {
    items, total, hasMore,
    loading, loadingMore, error,
    loadMore, getOne, setRole, adjustBalance,
  } = useAdminUsers();
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="border border-line bg-danger/10 text-danger rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col />
            <col style={{ width: '7rem' }} />
            <col style={{ width: '6rem' }} />
            <col style={{ width: '5rem' }} />
            <col style={{ width: '9rem' }} />
          </colgroup>
          <thead>
            <tr className="bg-cream/60 border-b border-line">
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left text-[11px] uppercase tracking-widest text-muted font-medium"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  No users found.
                </td>
              </tr>
            ) : (
              items.map((u, idx) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedId(u.id)}
                  className={`border-b border-line last:border-b-0 cursor-pointer hover:bg-accent/5 transition-colors duration-100 ${
                    idx % 2 === 1 ? 'bg-cream/30' : 'bg-surface'
                  }`}
                >
                  <td className="px-4 py-3 text-ink font-medium truncate">
                    {u.displayName || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cream/70 text-muted">
                        Customer
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-ink truncate">{u.balance} pts</td>
                  <td className="px-4 py-3 font-mono text-ink">{u.orderCount}</td>
                  <td className="px-4 py-3 text-muted truncate">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LoadMoreFooter
        shown={items.length}
        total={total}
        hasMore={hasMore}
        loading={loading}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
      />

      {/* Detail drawer */}
      {selectedId && (
        <UserDetailDrawer
          userId={selectedId}
          currentUserId={user?.id}
          fetchUser={getOne}
          onClose={() => setSelectedId(null)}
          onRoleChange={setRole}
          onAdjustBalance={adjustBalance}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual smoke check**

Navigate to `/admin` → Users tab.

Verify:
- 10 users render with skeletons first; columns do not shift right on load even with a long display name.
- "Showing N of M" footer; "Load more" works.
- Role/balance edits patch the row in place; total unchanged.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/UsersTab.jsx
git commit -m "$(cat <<'EOF'
feat(admin): paginate UsersTab with stable column widths

Renames users -> items, adds LoadMoreFooter, switches table to
table-fixed with explicit colgroup widths. Long display names
no longer shift the layout right on data load.
EOF
)"
```

---

### Task 13: Final integration verification

**Files:** none (manual end-to-end).

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 2: Run frontend lint**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual end-to-end with `npm run dev` (repo root)**

Walk through each tab:

**Orders tab:**
- Initial load: 10 rows + "Showing 10 of N". No column shift on load.
- Apply each status filter from the dropdown — list resets, total reflects filter.
- Open an order, transition it to a status outside the filter — row disappears, total decrements.
- "Load more" appends and updates the count.

**Products tab:**
- Initial load: 10 rows. No column shift.
- Toggle "Include archived" — list resets to 10, total reflects.
- Switch sort to "Popularity (most reviews)" — most-reviewed first; tied items in `createdAt desc` order.
- Click "+ New product", create — appears at top, total +1.
- Archive a non-archived product with "Include archived" off — disappears, total -1.
- "Load more" appends.

**Users tab:**
- Find a user with a long display name — no right shift on load.
- "Load more" appends.
- Open a user, change role — row updates in place, total unchanged.
- Open a user, adjust balance — same.

**Stale-response check (DevTools, network throttled "Slow 3G"):**
- Orders tab → click "Load more" → immediately switch the status filter.
- The late "Load more" response should not append rows to the new filter's list.

- [ ] **Step 4: Commit (only if any cleanup is needed)**

If everything passes with no further code changes, no commit is needed. Otherwise commit cleanups with a `chore:` or `fix:` prefix.

---

## Self-review against spec

| Spec section / requirement                                                         | Implemented in   |
|------------------------------------------------------------------------------------|------------------|
| `parsePagination` helper, validation, 50 cap                                       | Task 1           |
| Orders endpoint returns `{ items, total, hasMore }`                                | Task 2           |
| Products endpoint: pagination + `sort=newest|popularity` + envelope                | Task 3           |
| `withAdminRatings` scoped to current page                                          | Task 3           |
| Users endpoint: pagination + envelope                                              | Task 4           |
| Frontend services: param + envelope changes for all three                          | Task 5           |
| Hook contract: `items / total / hasMore / loadingMore / loadMore / pageSize`       | Tasks 6, 7, 8    |
| Filter/sort change resets to page 1                                                | Tasks 6, 7, 8    |
| Stale-response guard via `requestIdRef`                                            | Tasks 6, 7, 8    |
| Mutation interactions with `total` (create/archive/transition/role/balance)        | Tasks 7, 8       |
| `LoadMoreFooter` component (visibility rules: hide on `loading`, hide on `total=0`)| Task 9           |
| `OrdersTab` `table-fixed` + colgroup + items rename + footer                       | Task 10          |
| `ProductsTab` `table-fixed` + colgroup + server-side sort wiring + footer          | Task 11          |
| `UsersTab` `table-fixed` + colgroup + items rename + footer                        | Task 12          |
| `truncate` on text cells where overflow possible                                   | Tasks 10, 11, 12 |
| End-to-end manual verification (all tabs)                                          | Task 13          |

No spec section is uncovered. No placeholders. Type/method names are consistent across tasks (`items`, `total`, `hasMore`, `loadingMore`, `loadMore`, `sort`, `setSort`, `requestIdRef`).
