# Data Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TanStack Query cache on the frontend and HTTP `Cache-Control` headers on public read endpoints to eliminate redundant fetches on navigation and let the browser revalidate cheaply via 304.

**Architecture:** Two cooperating layers. Frontend: a `QueryClient` singleton with `useQuery` for reads and `useMutation` for writes; mutations explicitly invalidate the keys they affect. Backend: a small middleware sets `Cache-Control` on `GET /products`, `GET /products/:slug`, `GET /products/:slug/reviews`. Authenticated endpoints emit no cache header.

**Tech Stack:** Frontend — React 19, Vite, `@tanstack/react-query` (new). Backend — Express 5, `node:test`. No new backend deps.

**Spec:** `docs/superpowers/specs/2026-05-06-data-cache-design.md`

**Branch:** `feat/data-cache`

---

## File Overview

**New (backend):**
- `backend/middleware/httpCache.js` — Cache-Control header middleware factory
- `backend/tests/httpCache.test.js` — unit tests for the middleware

**Modified (backend):**
- `backend/routes/productsRoutes.js` — apply httpCache middleware to GET routes

**New (frontend):**
- `frontend/src/lib/queryClient.js` — `QueryClient` singleton + defaults
- `frontend/src/lib/queryKeys.js` — central key factory
- `frontend/src/lib/apiFetch.js` — wrappers that throw on non-OK and parse JSON

**Modified (frontend):**
- `frontend/src/main.jsx` — wrap App in `QueryClientProvider`
- `frontend/package.json` — add `@tanstack/react-query` and devtools
- `frontend/src/pages/ShopPage.jsx` — useQuery for products
- `frontend/src/pages/ProductDetailPage.jsx` — useQuery for product
- `frontend/src/pages/OrderHistoryPage.jsx` — useQuery for orders + products (first page); useMutation for cancel/return/address-update
- `frontend/src/components/ReviewsSection.jsx` — useQuery for reviews + useMutation for POST/PATCH/DELETE
- `frontend/src/components/admin/ProductReviewsDrawer.jsx` — useQuery for reviews
- `frontend/src/hooks/usePlaceOrder.js` — useMutation; invalidate `['orders']`
- `frontend/src/hooks/admin/useAdminProducts.js` — invalidate public `['products']` on create/update/archive/unarchive

---

## Phase 1 — Backend HTTP cache (independent; can ship alone)

### Task 1: `httpCache` middleware (TDD)

**Files:**
- Create: `backend/middleware/httpCache.js`
- Test: `backend/tests/httpCache.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/httpCache.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { httpCache } from '../middleware/httpCache.js';

function mockReqRes() {
  const headers = {};
  const res = {
    setHeader(name, value) { headers[name] = value; },
    getHeader(name) { return headers[name]; },
  };
  return { req: {}, res, headers };
}

test('httpCache: sets public max-age directive', () => {
  const { req, res, headers } = mockReqRes();
  let nextCalled = false;
  httpCache({ maxAge: 60 })(req, res, () => { nextCalled = true; });
  assert.equal(headers['Cache-Control'], 'public, max-age=60');
  assert.equal(nextCalled, true);
});

test('httpCache: includes stale-while-revalidate when swr > 0', () => {
  const { req, res, headers } = mockReqRes();
  httpCache({ maxAge: 60, swr: 300 })(req, res, () => {});
  assert.equal(
    headers['Cache-Control'],
    'public, max-age=60, stale-while-revalidate=300'
  );
});

test('httpCache: omits stale-while-revalidate when swr is 0 or missing', () => {
  const { req, res, headers } = mockReqRes();
  httpCache({ maxAge: 30, swr: 0 })(req, res, () => {});
  assert.equal(headers['Cache-Control'], 'public, max-age=30');
});

test('httpCache: respects scope option', () => {
  const { req, res, headers } = mockReqRes();
  httpCache({ maxAge: 60, scope: 'private' })(req, res, () => {});
  assert.equal(headers['Cache-Control'], 'private, max-age=60');
});

test('httpCache: applies defaults when called with empty options', () => {
  const { req, res, headers } = mockReqRes();
  httpCache({})(req, res, () => {});
  assert.equal(headers['Cache-Control'], 'public, max-age=60');
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd backend && node --test tests/httpCache.test.js`
Expected: FAIL with `Cannot find module '../middleware/httpCache.js'`.

- [ ] **Step 3: Implement the middleware**

Create `backend/middleware/httpCache.js`:

```js
export function httpCache({ maxAge = 60, swr = 0, scope = 'public' } = {}) {
  const directives = [scope, `max-age=${maxAge}`];
  if (swr > 0) directives.push(`stale-while-revalidate=${swr}`);
  const value = directives.join(', ');
  return (req, res, next) => {
    res.setHeader('Cache-Control', value);
    next();
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `cd backend && node --test tests/httpCache.test.js`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/middleware/httpCache.js backend/tests/httpCache.test.js
git commit -m "$(cat <<'EOF'
feat(backend): add httpCache middleware for Cache-Control headers
EOF
)"
```

---

### Task 2: Apply `httpCache` to public product routes

**Files:**
- Modify: `backend/routes/productsRoutes.js`

- [ ] **Step 1: Apply middleware to GET routes**

Edit `backend/routes/productsRoutes.js`:

```js
import express from 'express';
import {getProducts, getProduct} from '../controllers/productsController.js';
import {getProductReviews, createReview, updateReview, deleteReview} from '../controllers/reviewsController.js';
import {requireAuth} from '../middleware/requireAuth.js';
import {httpCache} from '../middleware/httpCache.js';

const router = express.Router();

const productsCache = httpCache({ maxAge: 60, swr: 300 });
const reviewsCache = httpCache({ maxAge: 30, swr: 120 });

router.get('/', productsCache, getProducts);
router.get('/:slug', productsCache, getProduct);
router.get('/:slug/reviews', reviewsCache, getProductReviews);
router.post('/:slug/reviews', requireAuth, createReview);
router.patch('/:slug/reviews', requireAuth, updateReview);
router.delete('/:slug/reviews', requireAuth, deleteReview);

export default router;
```

- [ ] **Step 2: Manually verify with curl**

In one terminal: `cd backend && npm run dev`
In another:
```bash
curl -i http://localhost:3000/products | head -20
```
Expected: response includes `Cache-Control: public, max-age=60, stale-while-revalidate=300` and an `ETag: W/"..."` line.

Then re-issue with `If-None-Match`:
```bash
ETAG=$(curl -s -i http://localhost:3000/products | awk '/^ETag:/ {print $2}' | tr -d '\r')
curl -i -H "If-None-Match: $ETAG" http://localhost:3000/products | head -5
```
Expected: `HTTP/1.1 304 Not Modified` with no body.

- [ ] **Step 3: Run all backend tests**

Run: `cd backend && npm test`
Expected: all existing tests still pass plus the 5 new ones.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/productsRoutes.js
git commit -m "$(cat <<'EOF'
feat(backend): apply Cache-Control headers to public product routes
EOF
)"
```

---

## Phase 2 — Frontend cache plumbing

### Task 3: Install TanStack Query and scaffold lib files

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/queryClient.js`
- Create: `frontend/src/lib/queryKeys.js`
- Create: `frontend/src/lib/apiFetch.js`

- [ ] **Step 1: Install dependencies**

```bash
cd frontend && npm install @tanstack/react-query
cd frontend && npm install --save-dev @tanstack/react-query-devtools
```

- [ ] **Step 2: Create `frontend/src/lib/queryClient.js`**

```js
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
```

- [ ] **Step 3: Create `frontend/src/lib/queryKeys.js`**

```js
export const queryKeys = {
  products: (filters = {}) => ['products', filters],
  product: (slug) => ['product', slug],
  reviewsBySlug: (slug) => ['reviews', 'slug', slug],
  reviewsById: (productId) => ['reviews', 'id', productId],
  orders: () => ['orders'],
};
```

(Reviews use two distinct keys because the public component fetches by slug and the admin drawer fetches by id — different URL paths.)

- [ ] **Step 4: Create `frontend/src/lib/apiFetch.js`**

```js
const API_BASE = import.meta.env.VITE_BACKEND_URL;

export async function apiGet(path) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiAuthed(authedFetch, path, init) {
  const res = await authedFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}
```

- [ ] **Step 5: Run lint to check the new files compile**

Run: `cd frontend && npm run lint`
Expected: no errors on the three new files.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/queryClient.js frontend/src/lib/queryKeys.js frontend/src/lib/apiFetch.js
git commit -m "$(cat <<'EOF'
feat(frontend): add TanStack Query plumbing (client, keys, apiFetch)
EOF
)"
```

---

### Task 4: Wrap App in `QueryClientProvider`

**Files:**
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Add provider and devtools**

Replace the contents of `frontend/src/main.jsx`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { queryClient } from './lib/queryClient.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 2: Verify dev server boots**

Run: `cd frontend && npm run dev`
In a browser, visit `http://127.0.0.1:5173`. Confirm the app loads with no console errors. The Devtools floating icon should appear in dev mode.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.jsx
git commit -m "$(cat <<'EOF'
feat(frontend): mount QueryClientProvider and devtools at app root
EOF
)"
```

---

## Phase 3 — Migrate read queries

### Task 5: Migrate `ShopPage` to `useQuery`

**Files:**
- Modify: `frontend/src/pages/ShopPage.jsx`

- [ ] **Step 1: Replace fetch effect with `useQuery`**

In `ShopPage.jsx`, find the `useEffect` block at lines ~113-136 that fetches `/products`. Replace it (and the associated `useState`s for `bakedGoods`, `loading`, `error`) with:

```jsx
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/apiFetch.js';
import { queryKeys } from '../lib/queryKeys.js';

// Inside the component, replacing existing fetch logic:
const trimmed = urlQuery.trim();
const productsQuery = useQuery({
  queryKey: queryKeys.products({ search: trimmed }),
  queryFn: () => apiGet(trimmed ? `/products?search=${encodeURIComponent(trimmed)}` : '/products'),
  staleTime: 60_000,
});

const bakedGoods = productsQuery.data?.items ?? [];
const loading = productsQuery.isLoading;
const error = productsQuery.isError ? 'Failed to load products.' : null;
```

Remove the `useState` declarations for `bakedGoods`, `loading`, `error` and the `useEffect` that fetches.

- [ ] **Step 2: Verify in the browser**

```bash
cd frontend && npm run dev
```
- Visit `/shop` — products load.
- Click into a product, then back to `/shop`. Network tab: the second visit shows no `/products` request (cache hit, within 60s staleTime).
- After 60s, click into and back. Network tab: the request goes out and returns `304` (HTTP cache from Task 2 + ETag).
- Type a search query. New request fires for the new key `['products', { search: '...' }]`.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ShopPage.jsx
git commit -m "$(cat <<'EOF'
feat(frontend): migrate ShopPage products fetch to useQuery
EOF
)"
```

---

### Task 6: Migrate `ProductDetailPage` to `useQuery`

**Files:**
- Modify: `frontend/src/pages/ProductDetailPage.jsx`

- [ ] **Step 1: Replace fetch effect with `useQuery`**

The endpoint `/products/:slug` returns the product object directly (verified in `backend/controllers/productsController.js`: `res.json(formatted)`). 404s must keep their specific "Product not found." copy.

In `ProductDetailPage.jsx`, find the `useEffect` at line ~26-48 that fetches `/products/${slug}`. Replace it (and the local `useState`s for product/loading/error) with:

```jsx
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/apiFetch.js';
import { queryKeys } from '../lib/queryKeys.js';

const productQuery = useQuery({
  queryKey: queryKeys.product(slug),
  queryFn: () => apiGet(`/products/${slug}`),
  staleTime: 60_000,
  enabled: !!slug,
  retry: (failureCount, err) => {
    if (err?.message?.includes('HTTP 404')) return false;
    return failureCount < 1;
  },
});

const product = productQuery.data ?? null;
const loading = productQuery.isLoading;
const error = productQuery.isError
  ? (productQuery.error?.message?.includes('HTTP 404')
      ? 'Product not found.'
      : 'Failed to load product.')
  : null;
```

(`apiGet` throws `Error('HTTP 404')` on a 404; the message is sniffed to preserve the existing copy.)

- [ ] **Step 2: Browser verify**
- Navigate Shop → Product → back to Shop → same Product. Second visit to the product page is instant, no loading state.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProductDetailPage.jsx
git commit -m "$(cat <<'EOF'
feat(frontend): migrate ProductDetailPage to useQuery
EOF
)"
```

---

### Task 7: Migrate `OrderHistoryPage` reads + mutations

**Files:**
- Modify: `frontend/src/pages/OrderHistoryPage.jsx`

This page has: orders first-page fetch, products fetch, and three mutations (cancel, return, address-update). Pagination's `loadMore` stays imperative (out of scope for `useInfiniteQuery`).

- [ ] **Step 1: Wire orders first-page via `useQuery`; keep `loadMore` imperative**

Replace the initial-load `useEffect` (around line 55-70 that calls `fetchMyOrders` for the first page) with:

```jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys.js';
import { apiGet } from '../lib/apiFetch.js';

const queryClient = useQueryClient();

const ordersQuery = useQuery({
  queryKey: queryKeys.orders(),
  queryFn: () => fetchMyOrders(authedFetch, { take: PAGE_SIZE, skip: 0 }),
  enabled: !!user,
  staleTime: 0,
});

// On first load (and on invalidation), seed the local items state from ordersQuery.data.
// Keep items as local state for pagination merging; loadMore appends to it.
useEffect(() => {
  if (ordersQuery.data) {
    setItems(ordersQuery.data.items);
    setHasMore(ordersQuery.data.hasMore);
  }
}, [ordersQuery.data]);
```

Keep the `loadMore` callback as-is (it appends to local `items`).

- [ ] **Step 2: Replace the products fetch with `useQuery`**

Replace the `useEffect` at line ~92-109 that fetches `/products` for `productMap` with:

```jsx
const productsForMapQuery = useQuery({
  queryKey: queryKeys.products({ search: '' }),
  queryFn: () => apiGet('/products'),
  staleTime: 60_000,
});

const productMap = useMemo(() => {
  const items = productsForMapQuery.data?.items ?? [];
  return new Map(items.map((p) => [p.id, p]));
}, [productsForMapQuery.data]);

const productsError = productsForMapQuery.isError
  ? (productsForMapQuery.error?.message ?? 'Could not load products.')
  : null;
```

This shares the `['products', { search: '' }]` cache with `ShopPage`, so navigating Shop → Order History → Shop dedupes free.

- [ ] **Step 3: Convert cancel/return/address-update to mutations**

Wherever `userCancelOrder`, `userReturnOrder`, `updateOrderAddress` are invoked (lines ~146, 166-167, 194), wrap them in `useMutation`s declared at the top of the component:

```jsx
const cancelMutation = useMutation({
  mutationFn: ({ orderId, reason }) => userCancelOrder(authedFetch, orderId, reason),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders() }),
});

const returnMutation = useMutation({
  mutationFn: ({ orderId, reason }) => userReturnOrder(authedFetch, orderId, reason),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders() }),
});

const addressMutation = useMutation({
  mutationFn: ({ orderId, addressId }) => updateOrderAddress(authedFetch, orderId, addressId),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders() }),
});
```

Then replace direct service calls in the existing handlers with `await cancelMutation.mutateAsync({ orderId, reason })` etc., preserving the existing `try/catch` UI behavior. **Keep the existing optimistic `patchOrder` / `setItems` updates** — they make the UI snappy before the invalidation refetch lands.

- [ ] **Step 4: Browser verify**
- Order history loads. Cancel an order: the row updates immediately (optimistic) and re-validates on refetch.
- Navigate to Shop after viewing Order History: products are cached, no extra request.

- [ ] **Step 5: Lint**

Run: `cd frontend && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/OrderHistoryPage.jsx
git commit -m "$(cat <<'EOF'
feat(frontend): migrate OrderHistoryPage reads and mutations to TanStack Query
EOF
)"
```

---

### Task 8: Migrate `ReviewsSection` (GET + 3 mutations)

**Files:**
- Modify: `frontend/src/components/ReviewsSection.jsx`

- [ ] **Step 1: Replace fetch effect with `useQuery`**

In `ReviewsSection.jsx`, replace the `useEffect` at line ~39-48 with:

```jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiAuthed } from '../lib/apiFetch.js';
import { queryKeys } from '../lib/queryKeys.js';

const queryClient = useQueryClient();

const reviewsQuery = useQuery({
  queryKey: queryKeys.reviewsBySlug(productSlug),
  queryFn: () => apiGet(`/products/${productSlug}/reviews`),
  enabled: !!productSlug,
});

const reviews = reviewsQuery.data?.reviews ?? [];
const loading = reviewsQuery.isLoading;
```

Remove the `useState([])` for `reviews` and the `setReviews` calls inside the effect.

- [ ] **Step 2: Wrap mutations**

Replace `handleSubmit` (POST), `handleDelete` (DELETE), `handleEdit` (PATCH) with `useMutation`s. Keep the user-facing form-error/loading state UX intact.

```jsx
const submitMutation = useMutation({
  mutationFn: ({ rating, text }) =>
    apiAuthed(authedFetch, `/products/${productSlug}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating, text: text.trim() || null }),
    }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reviewsBySlug(productSlug) }),
});

const deleteMutation = useMutation({
  mutationFn: () => apiAuthed(authedFetch, `/products/${productSlug}/reviews`, { method: 'DELETE' }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reviewsBySlug(productSlug) }),
});

const editMutation = useMutation({
  mutationFn: ({ rating, text }) =>
    apiAuthed(authedFetch, `/products/${productSlug}/reviews`, {
      method: 'PATCH',
      body: JSON.stringify({ rating, text: text.trim() || null }),
    }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reviewsBySlug(productSlug) }),
});
```

In the existing handlers:

```jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  setFormError('');
  try {
    await submitMutation.mutateAsync({ rating: formData.rating, text: formData.text });
    setFormData({ rating: 5, text: '' });
    setFormOpen(false);
  } catch (err) {
    if (err.status === 409) setFormError('You have already reviewed this product.');
    else setFormError(err.message ?? 'Failed to submit review.');
  }
};

const handleDelete = async () => {
  try { await deleteMutation.mutateAsync(); } catch { /* swallow */ }
};

const handleEdit = async (_review, { rating, text }) => {
  await editMutation.mutateAsync({ rating, text });
};
```

The `submitting` state becomes `submitMutation.isPending`.

- [ ] **Step 3: Browser verify**
- Open a product page, post a review. List refetches and shows the new review.
- Edit a review. List updates.
- Delete a review. List updates.
- Try to post a duplicate review (logged-in user who already reviewed): error message shows correctly.

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ReviewsSection.jsx
git commit -m "$(cat <<'EOF'
feat(frontend): migrate ReviewsSection reads and mutations to TanStack Query
EOF
)"
```

---

### Task 9: Migrate admin `ProductReviewsDrawer` GET

**Files:**
- Modify: `frontend/src/components/admin/ProductReviewsDrawer.jsx`

- [ ] **Step 1: Replace fetch effect with `useQuery`**

In `ProductReviewsDrawer.jsx`, find the fetch at line ~46 (`fetch(.../products/${product.id}/reviews)`) and replace with:

```jsx
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/apiFetch.js';
import { queryKeys } from '../../lib/queryKeys.js';

const reviewsQuery = useQuery({
  queryKey: queryKeys.reviewsById(product.id),
  queryFn: () => apiGet(`/products/${product.id}/reviews`),
  enabled: !!product?.id,
});

const reviews = reviewsQuery.data?.reviews ?? [];
const loading = reviewsQuery.isLoading;
```

Remove the corresponding `useState` and `useEffect`.

- [ ] **Step 2: Browser verify**
- Open the admin Products tab → click "Reviews" on a product. Drawer loads.
- Close and reopen the same drawer within 30s — instant render, no loading flash.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/ProductReviewsDrawer.jsx
git commit -m "$(cat <<'EOF'
feat(frontend): migrate admin ProductReviewsDrawer to useQuery
EOF
)"
```

---

## Phase 4 — Mutations that affect cached reads

### Task 10: Migrate `usePlaceOrder` and invalidate orders

**Files:**
- Modify: `frontend/src/hooks/usePlaceOrder.js`

- [ ] **Step 1: Replace state-managed call with `useMutation`**

Replace `frontend/src/hooks/usePlaceOrder.js` with:

```js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth.js';
import { placeOrder as placeOrderService } from '../services/orderService.js';
import { queryKeys } from '../lib/queryKeys.js';

export function usePlaceOrder({ onSuccess } = {}) {
  const { authedFetch, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ addressId }) => placeOrderService(authedFetch, { addressId }),
    onSuccess: async (created) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
      await refreshProfile();
      if (onSuccess) onSuccess(created);
    },
  });

  const placeOrder = (input) => mutation.mutate(input);

  return {
    placeOrder,
    submitting: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}
```

- [ ] **Step 2: Browser verify**
- Add items to the cart, place an order. Balance updates (via `refreshProfile`), order appears in Order History on next visit.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/usePlaceOrder.js
git commit -m "$(cat <<'EOF'
feat(frontend): migrate usePlaceOrder to useMutation; invalidate orders cache
EOF
)"
```

---

### Task 11: Admin product mutations invalidate public products query

**Files:**
- Modify: `frontend/src/hooks/admin/useAdminProducts.js`

The hand-rolled optimistic state stays — we add cache invalidation so the public `ShopPage` and `OrderHistoryPage` see admin changes on next mount.

- [ ] **Step 1: Add `useQueryClient` and invalidate after mutations**

In `useAdminProducts.js`, add at the top:

```js
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys.js';
```

Inside the hook, near the top:

```js
const queryClient = useQueryClient();
const invalidatePublicProducts = () => {
  queryClient.invalidateQueries({ queryKey: ['products'] });
  queryClient.invalidateQueries({ queryKey: ['product'] });
};
```

(Use the partial keys `['products']` and `['product']` so all filter variants and per-slug caches are invalidated.)

Then in `create`, `update`, `archive`, `unarchive`, after the existing `setItems` updates, call `invalidatePublicProducts()`. Example for `create`:

```js
const create = useCallback(async (data) => {
  const created = await api.createProduct(authedFetch, data);
  setItems((prev) => [{ ...created, avgRating: null, reviewCount: 0 }, ...prev]);
  setTotal((t) => t + 1);
  invalidatePublicProducts();
  return created;
}, [authedFetch, queryClient]);
```

Apply the same pattern to `update`, `archive`, `unarchive`.

- [ ] **Step 2: Browser verify**
- Open Shop in one tab, Admin Products in another. In admin, archive a product. Switch to the Shop tab and reload (or just navigate away and back) — the archived product no longer shows.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/admin/useAdminProducts.js
git commit -m "$(cat <<'EOF'
feat(frontend): admin product mutations invalidate public products cache
EOF
)"
```

---

## Phase 5 — Verify

### Task 12: Run full verify and fix any failures

- [ ] **Step 1: Backend tests**

Run: `cd backend && npm test`
Expected: all tests pass, including the 5 new `httpCache` tests.
If any fail: read the error, locate the cause, fix in place, re-run.

- [ ] **Step 2: Frontend lint**

Run: `cd frontend && npm run lint`
Expected: clean.
If errors: fix in place, re-run.

- [ ] **Step 3: Manual end-to-end verification in the browser**

Run the full app: `npm run dev` (root).
- Visit `/shop`. Open DevTools Network. Note the `/products` request: status 200, response headers include `Cache-Control: public, max-age=60, stale-while-revalidate=300` and `ETag`.
- Click into a product. Click back. Network tab: no new `/products` request.
- Wait 60s+, click into a product, back. Network: a `/products` request fires, returns `304 Not Modified`.
- Add to cart, place an order. Order History shows the new order. Balance reflects the cost.
- Post a review on a product. List updates immediately (mutation success → invalidate → refetch).
- Sign out, sign in. No console errors.
- Open React Query Devtools. Confirm cache entries for `['products', ...]`, `['product', ...]`, `['orders']`, `['reviews', 'slug', ...]` exist after the corresponding pages have been visited.

- [ ] **Step 4: If everything passes, no commit needed (verification step)**

If anything was changed during fixing, commit with a descriptive message.

---

## Out of scope (recap)

- `useCart` (localStorage-first, fire-and-forget sync)
- `useCookieClicker` (keepalive flush, login-migration entanglement)
- `useQuery(['me'])` for profile (lives in AuthProvider context)
- `useInfiniteQuery` migration of OrderHistoryPage pagination
- Frontend test framework
- Optimistic updates beyond what already exists in `useAdminProducts` and `OrderHistoryPage`

---

## Self-review notes (writer)

- Spec coverage: every spec section has a corresponding task.
  - Frontend new files (queryClient, queryKeys, apiFetch) → Task 3
  - Provider mount → Task 4
  - ShopPage → Task 5
  - ProductDetailPage → Task 6
  - OrderHistoryPage → Task 7
  - ReviewsSection → Task 8
  - admin ProductReviewsDrawer → Task 9
  - usePlaceOrder → Task 10
  - Admin product invalidation → Task 11
  - Backend middleware + routes → Tasks 1, 2
  - Verify → Task 12
- Type/name consistency: `queryKeys.products`, `queryKeys.product`, `queryKeys.reviewsBySlug`, `queryKeys.reviewsById`, `queryKeys.orders` are referenced consistently across all tasks.
- No placeholders. Every code block is complete enough to apply.
