# Data Cache (TanStack Query + HTTP Cache Headers) — Design

**Date:** 2026-05-06
**Status:** Spec — pending plan

## Problem

Navigating between pages in the app feels sluggish. Every mount of `ShopPage`, `ProductDetailPage`, `OrderHistoryPage`, and review-listing components fires a fresh `fetch` from `useEffect`, even when the same data was just rendered moments ago. There is no client-side request cache, no in-flight dedup, and no HTTP cache hint from the server, so the browser must fully revalidate every navigation.

Two latency layers compose here: render-perceived latency (component starts in `loading=true` even when data is already known) and network latency (the request actually goes to the origin every time).

## Goals

- Navigating back to a previously-viewed page renders cached content immediately, with optional background revalidation.
- In-flight identical requests are deduplicated.
- Public read endpoints (`/products`, `/products/:slug`, reviews) emit `Cache-Control` + `ETag` so the browser can serve from HTTP cache or revalidate via 304.
- Mutations (checkout, order cancel/return/address-update, reviews, admin product CRUD) explicitly invalidate the cache keys they affect, so the UI stays consistent without manual refetch wiring.
- All existing user-visible behavior is preserved: the same loading/error UX, the same auth boundaries, the same admin flows.

## Non-goals

- Adding Redis or any backend cache layer. There is no measured DB bottleneck.
- Adding a frontend test framework. The project has none today; manual browser verification is sufficient.
- Replacing the existing `authedFetch` wrapper or session handling. They stay unchanged.
- Server-Side Rendering, prefetching on link hover, or service-worker caching. Out of scope.
- Caching authenticated endpoints at the HTTP layer. Those stay `Cache-Control: private, no-store`.
- Migrating `useCookieClicker`. The hook uses `keepalive: true` raw `fetch` to flush pending clicks on logout (must run during unmount/sign-out, can't be a `useMutation`). The migration-on-login path is similarly entangled with auth-state transitions. The cost-to-benefit ratio is poor; cookie clicker stays as-is.
- Migrating `useCart` to TanStack Query. The cart is localStorage-first with fire-and-forget backend sync (`syncCartItem` is best-effort, intentionally non-awaited). Wrapping it in `useMutation` would change semantics and hurt the offline/typing UX. Cart stays as-is.
- Migrating the user profile (`AuthProvider.profile`, balance) to a TSQ query. The profile lives in auth context and is refreshed imperatively via `refreshProfile()` on deliberate events (login, click flush, checkout). There's no `useQuery(['me'])` consumer in the app, so adding one is dead weight.

## Architecture

Two cooperating layers:

1. **Frontend in-memory cache:** `@tanstack/react-query` (TSQ) holds query results keyed by stable arrays. `useQuery` replaces ad-hoc `useEffect` + `fetch` + local state. `useMutation` replaces ad-hoc `try/catch` POSTs and triggers explicit `queryClient.invalidateQueries(...)` on success.

2. **HTTP cache headers:** A small Express middleware sets `Cache-Control` on public read endpoints. Express 5 already emits weak `ETag` on response bodies, so 304 revalidation works automatically when the client sends `If-None-Match`.

The two layers compose: TSQ's `queryFn` calls `fetch`, which the browser may serve from HTTP cache or revalidate via 304. Either way, TSQ stores the result keyed in memory, so subsequent navigations don't re-render through a loading state.

### Why both layers

- TSQ alone fixes navigation perception (cached pages render instantly) but doesn't help cold-cache visits or hard-refreshes — the network request still goes to the origin every time.
- HTTP headers alone fix the network round-trip but not the render round-trip — `useEffect` still fires `fetch`, components still start in `loading=true`, and React state has no awareness of the HTTP cache.

Together they give snappy navigation *and* cheap cold loads.

## Frontend changes

### New files

**`frontend/src/lib/queryClient.js`** — exports a singleton `QueryClient` with these defaults:

```js
{
  queries: {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  },
  mutations: {
    retry: false,
  },
}
```

`refetchOnWindowFocus: false` because this is a small bakery app, not a dashboard — silent background refetches on tab-focus would surprise more than help. `retry: false` on mutations because cart/checkout calls must not duplicate.

**`frontend/src/lib/queryKeys.js`** — central key factory to avoid stringly-typed keys scattered across files:

```js
export const queryKeys = {
  products: (filters = {}) => ['products', filters],
  product: (slug) => ['product', slug],
  reviews: (productId) => ['reviews', productId],
  orders: () => ['orders'],
};
```

**`frontend/src/lib/apiFetch.js`** — small wrapper used by every `queryFn` and `mutationFn`. Wraps either a raw `fetch` or `authedFetch`, throws on `!res.ok` (so TSQ surfaces the error), and parses JSON:

```js
export async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiAuthed(authedFetch, path, init) {
  const res = await authedFetch(path, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}
```

This is the load-bearing piece. `authedFetch` itself is **not modified** — too many existing callers depend on getting a `Response` object back. Only the new `apiAuthed` helper throws.

### Modified files

**`main.jsx`** — wrap `<App />` in `QueryClientProvider`. Optionally mount React Query Devtools in dev only.

**`pages/ShopPage.jsx`** — replace `useEffect` + `fetch` with `useQuery({ queryKey: queryKeys.products(filters), queryFn: () => apiGet(url) })`. The `filters` object (search, sort, etc. read from URL) becomes part of the key, so different filter sets get cached separately.

**`pages/ProductDetailPage.jsx`** — `useQuery({ queryKey: queryKeys.product(slug), queryFn: () => apiGet(`${API}/products/${slug}`) })`.

**`pages/OrderHistoryPage.jsx`** — two queries:
- `useQuery(queryKeys.orders())` for the orders list (uses `authedFetch` + `apiAuthed`).
- `useQuery(queryKeys.products())` for the productMap used by the Reorder feature. Reuses the same key as `ShopPage`, so navigating between Shop and Order History dedupes free.

The existing pagination-cursor logic in `loadMore` becomes `fetchNextPage` if we adopt `useInfiniteQuery`, OR stays as a stateful `useState` cursor that calls a separate `apiAuthed` directly and merges results into a manually-managed list. **Decision:** keep the current pagination model — wrap only the *first page* fetch in `useQuery`, and leave `loadMore` as an imperative call. Migrating to `useInfiniteQuery` is out of scope; it would require restructuring the page's local state more aggressively than this work justifies.

**`components/ReviewsSection.jsx`** — `useQuery(queryKeys.reviews(productId))`.

**`components/admin/ProductReviewsDrawer.jsx`** — `useQuery(queryKeys.reviews(productId))` (shares the same cache key as the public reviews list, which is fine because the data is identical).

**`hooks/useCookieClicker.js`** — unchanged. As noted in non-goals.

**`hooks/useCart.js`** — unchanged. As noted in non-goals.

**`hooks/usePlaceOrder.js`** — the `placeOrderService(authedFetch, …)` call becomes a `useMutation`'s `mutationFn`. On success, invalidate `queryKeys.orders()`. The existing `refreshProfile()` call stays (handles balance refresh via the auth context — independent of TSQ).

**`pages/OrderHistoryPage.jsx` order mutations** — `userCancelOrder`, `userReturnOrder`, `updateOrderAddress` calls become `useMutation`s that invalidate `queryKeys.orders()` on success.

**Admin product CRUD** — admin services live in `frontend/src/services/admin/` and admin hooks/queries in `frontend/src/hooks/admin/`. The fetch sites in `components/admin/ProductsTab.jsx` and `components/admin/ProductEditModal.jsx` go through those layers. Create/update/delete become `useMutation`s that invalidate `queryKeys.products()` (and `queryKeys.product(slug)` when known) on success. The implementation plan will enumerate the exact admin hook/service files; the migration pattern is the same as the public hooks above.

**`auth/AuthProvider.jsx`** — unchanged. `authedFetch` keeps returning `Response`. Only `apiAuthed` (the new helper) throws.

### Cache policy summary

The `QueryClient` default is `staleTime: 30_000`. The values below are per-query overrides set on each `useQuery` call where they differ from the default.

| Key | staleTime (override) | Invalidated by |
|---|---|---|
| `['products', filters]` | 60s | admin product create/update/delete |
| `['product', slug]` | 60s | admin product update/delete for that slug |
| `['reviews', productId]` | 30s (matches default) | post/delete review for that product |
| `['orders']` | 0 | checkout success, order cancel/return/address-update |

(No `['cart']` or `['me']` query — see non-goals.)

`staleTime: 0` on `['orders']` means TSQ refetches on every mount but still serves cached data immediately during render — so no loading flash, but data is always re-validated.

## Backend changes

### New file

**`backend/middleware/httpCache.js`** — small middleware factory:

```js
export function httpCache({ maxAge = 60, swr = 0, scope = 'public' }) {
  const directives = [scope, `max-age=${maxAge}`];
  if (swr > 0) directives.push(`stale-while-revalidate=${swr}`);
  const value = directives.join(', ');
  return (req, res, next) => {
    res.setHeader('Cache-Control', value);
    next();
  };
}
```

Pure header-setting; the actual ETag + 304 short-circuit is Express 5's default behavior for response bodies.

### Modified files

**`backend/routes/productsRoutes.js`** — apply `httpCache({ maxAge: 60, swr: 300 })` to GET `/` (list) and GET `/:slug` (detail). Apply `httpCache({ maxAge: 30, swr: 120 })` to GET `/:slug/reviews` (or wherever reviews live within the products router).

**`backend/server.js`** — no changes needed. Authenticated routers (`/orders`, `/cart`, `/me`, admin) emit no cache header by default, which is the correct behavior.

### What we are deliberately not changing

- No cache header on POST/PATCH/DELETE — those don't get caching directives anyway.
- No `Vary` header on `/products` — the response doesn't vary by `Authorization` (the endpoint is public and ignores any auth header), and we're not negotiating `Accept-Encoding` manually.
- No CDN-aware tuning. If a CDN is added later, `Cache-Control: public` is already friendly; `s-maxage` can be added then.

## Data flow

**Cold visit to `/shop`:**
1. `ShopPage` renders, `useQuery(['products', filters])` calls `apiGet('/products?...')`.
2. Browser has no cached entry → request hits backend.
3. Backend returns 200 + body + `Cache-Control: public, max-age=60, stale-while-revalidate=300` + weak ETag.
4. TSQ stores the body keyed by `['products', filters]`.
5. UI renders products.

**Navigate to `/products/:slug` then back to `/shop` within 60s:**
1. `ShopPage` re-mounts. `useQuery(['products', filters])` finds a fresh cache entry → returns it synchronously.
2. UI renders products **immediately**, no loading flash, no network request.

**Same navigation after 60s but within `swr=300`:**
1. `useQuery` returns the stale entry immediately (UI renders instantly).
2. TSQ kicks off a background refetch (because `staleTime` elapsed).
3. The refetch sends `If-None-Match: <etag>`. Backend returns `304 Not Modified` (cheap).
4. TSQ marks the entry fresh again. No re-render.

**Place order (checkout):**
1. `useMutation` fires `placeOrderService(authedFetch, { addressId })` → `POST /orders`.
2. On success, `queryClient.invalidateQueries({ queryKey: queryKeys.orders() })`.
3. `refreshProfile()` is still called by `usePlaceOrder` to update the auth-context balance.
4. Any component subscribed to `['orders']` refetches and re-renders.

**Post a review:**
1. `useMutation` fires `POST /products/:slug/reviews`.
2. On success, `queryClient.invalidateQueries({ queryKey: queryKeys.reviews(productId) })`.
3. The reviews list refetches and shows the new review.

## Error handling

- `useQuery` exposes `{ data, error, isLoading, isError }`. Pages render an error UI from `error?.message`. Existing inline error states (per-page strings, retry buttons) keep their current visual treatment — only the data plumbing changes.
- `useMutation` exposes `onError` for per-call handling. Cart and checkout flows keep their existing user-facing error UI; the error just routes through `onError` instead of a `try/catch` around `fetch`.
- The backend's existing global error handler (per recent commit `de61d4e`) is unchanged. It still returns JSON with `{ error: ... }`; `apiAuthed` throws an `Error('HTTP <status>')` from the status code, which is enough for the UI today. If we want richer error messages later, `apiAuthed` can parse the error body and throw `new Error(body.error)`.
- HTTP cache middleware is fail-open: a misconfigured options object means no header is set and behavior reverts to the current state.

## Testing

### Backend (has `node:test`)

Add `backend/tests/httpCache.test.js`:
- GET `/products` returns `Cache-Control: public, max-age=60, stale-while-revalidate=300`.
- GET `/products/:slug` returns the same.
- GET `/products/:slug/reviews` returns `max-age=30, stale-while-revalidate=120`.
- GET `/cart` (with auth) returns no `Cache-Control` header (or no `public`/`max-age` directive).
- GET `/products` with `If-None-Match: <etag from previous response>` returns `304 Not Modified` with no body.

These tests instantiate the Express app in-process (or use the existing test harness pattern in `backend/tests/`).

### Frontend (no test infra)

Manual verification in the browser:
- Open DevTools → Network tab.
- Visit `/shop`, wait for load, navigate to a product, navigate back. The second `/shop` visit shows no network request for `/products` (TSQ cache hit) — or if `staleTime` is exceeded, shows a `304`.
- Add to cart from the product page: cart count in header updates without a manual refetch.
- Place an order: balance, orders page, and cart all reflect the change.
- Hard-refresh `/shop`: `/products` returns 200 with `Cache-Control` header. Refresh again: returns `304` (assuming within `max-age` or via revalidation).
- Sign out: any pending queries don't crash; subsequent navigation to authenticated pages re-prompts auth as before.

## Out-of-scope follow-ups

- Migrate `OrderHistoryPage` pagination to `useInfiniteQuery`.
- Add `Vary` and `s-maxage` if a CDN is introduced.
- Add toast notifications on mutation success/error (Tier 3).
- Frontend test framework + integration tests for cache behavior.
- Optimistic UI for cart add/remove (currently sync via mutation).

## Dependencies

- `@tanstack/react-query` (frontend dep, ~13kb gzipped).
- `@tanstack/react-query-devtools` (frontend dev-dep, dev-only mount).
- No new backend deps.
