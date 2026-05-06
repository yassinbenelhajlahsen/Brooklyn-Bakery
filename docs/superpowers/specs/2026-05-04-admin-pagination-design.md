# Admin Pagination + Skeleton Alignment — Design

**Date:** 2026-05-04
**Branch:** `feat/admin-pagination`
**Status:** Spec — pending plan

## Problem

Two issues in the admin page (`/admin`):

1. **Every list endpoint returns the full table.** `GET /admin/orders`, `/admin/products`, and `/admin/users` all call `prisma.findMany` with no `take`/`skip`. Today this is tolerable (small dataset), but payloads, render cost, and image decode (products thumbnails) all grow linearly with the table.

2. **Column widths shift visibly when data loads.** The tables use the browser's default auto-layout, so column widths are computed from whichever cell content is widest at any given moment. Skeleton-row bar widths don't match real content widths, so when real data swaps in, headers and columns jump:
   - **Orders** and **Products**: skeleton bars are wider than typical real values → headers shift left on load.
   - **Users**: a long display name is wider than the skeleton bar → headers shift right on load.

   No matter how carefully we pick skeleton widths, real-data variance defeats them. The fix is structural, not cosmetic.

## Goals

- All three admin tabs (Orders, Products, Users) page from the server: 10 rows initially, "Load more" appends another 10.
- Each tab shows total row count: "Showing 10 of 47".
- Column widths are stable across skeleton → loaded → loaded-more states.
- "Sort by popularity" in the Products tab keeps working under pagination — moves to the server.
- Existing filters (`status`, `includeArchived`) and mutations (transition, role/balance, create/archive product) continue to work; filters/sort changes reset the list to page 1.

## Non-goals

- Numbered pages or jump-to-page UI ("Load more" only).
- Cursor-based pagination (offset is sufficient for this scale).
- Search inputs in admin tabs.
- Server-side sort for Orders or Users beyond the existing `createdAt desc` default.
- Frontend tests (project has none today; manual verification only).
- Persisting pagination state in the URL.

## Decisions locked in during brainstorming

- **Pagination strategy:** offset/limit (`take` + `skip`). Cursor pagination is overkill at this scale and would complicate the popularity sort.
- **Page size:** 10. Capped at 50 server-side.
- **Response envelope:** `{ items, total, hasMore }` for all three list endpoints. Key renamed from `orders` / `products` / `users` → `items` for consistency.
- **Popularity sort:** moves server-side. Sort meaning changes from "highest avg rating" → "most reviews" (uses Prisma `orderBy: { reviews: { _count: 'desc' } }` directly; cleaner code; better admin signal — a 5★ product with 1 review shouldn't outrank a 4.7★ product with 80 reviews).
- **Skeleton fix:** structural — `table-fixed` + explicit column widths. Skeleton bar widths stop mattering for layout; they remain only as decorative hints.

## Architecture

### Backend

#### Shared helper — `backend/lib/pagination.js` (new)

```js
import { httpError } from './httpError.js';

export function parsePagination(query) {
  const rawTake = query.take === undefined ? 10 : Number(query.take);
  const rawSkip = query.skip === undefined ? 0  : Number(query.skip);
  if (!Number.isInteger(rawTake) || rawTake < 1) throw httpError(400, 'Invalid take');
  if (!Number.isInteger(rawSkip) || rawSkip < 0) throw httpError(400, 'Invalid skip');
  return { take: Math.min(50, rawTake), skip: rawSkip };
}
```

#### `GET /admin/orders` — `listAllOrders`

- Parse `take`/`skip` via the helper.
- Build the existing `where` (status filter unchanged).
- `Promise.all([ findMany({ where, take, skip, orderBy, include }), count({ where }) ])`.
- Return `{ items, total, hasMore: skip + items.length < total }`.

#### `GET /admin/products` — `listProducts`

- Parse `take`/`skip` via the helper.
- New `sort` query param: `'popularity' | 'newest'`. Default `'newest'`.
  - `newest` → `orderBy: { createdAt: 'desc' }` (existing behavior).
  - `popularity` → `orderBy: [{ reviews: { _count: 'desc' } }, { createdAt: 'desc' }]`. Tiebreak by `createdAt` so paging is deterministic.
- Reject other `sort` values with 400.
- `Promise.all([ findMany({ where, take, skip, orderBy, select: ADMIN_PRODUCT_SELECT }), count({ where }) ])`.
- `withAdminRatings` now operates on a single page — still issues one aggregate `groupBy`, but only for the visible products (pass `where: { productId: { in: pageIds } }` to the groupBy to keep it cheap).
- Return `{ items, total, hasMore }`.

#### `GET /admin/users` — `listUsers`

- Parse `take`/`skip` via the helper.
- `Promise.all([ findMany({ take, skip, orderBy: { createdAt: 'desc' }, select }), count() ])`.
- Return `{ items, total, hasMore }`.

#### Validation

- `take` not an integer ≥ 1 → 400.
- `skip` not an integer ≥ 0 → 400.
- `take > 50` is **clamped** silently to 50, not an error.
- Products `sort` not in the allowed set → 400.

### Frontend

#### Hook contract changes — `useAdminOrders`, `useAdminProducts`, `useAdminUsers`

Each hook gains:

| Field/method  | Type / shape                                  | Notes                                                       |
|---------------|-----------------------------------------------|-------------------------------------------------------------|
| `items`       | array                                         | Replaces `orders` / `products` / `users` (rename in tabs)   |
| `total`       | number                                        | Total rows matching current filters                         |
| `hasMore`     | boolean                                       | Whether another page is available                           |
| `loadingMore` | boolean                                       | True only during a `loadMore` fetch (separate from `loading`)|
| `loadMore()`  | `() => Promise<void>`                         | Fetches next 10 with current filters; appends to `items`    |
| `pageSize`    | constant `10`                                 | Used for `skip = items.length`                              |

Naming: `orders` → `items` in `useAdminOrders` (and same for the other two). Tab components update to read `items`. Mutation paths (`transition`, `create`, `archive`, etc.) operate on the in-memory `items` array as today.

##### Filter/sort change behavior

The existing `useEffect`-on-filter pattern continues to work: when `status` (orders), `includeArchived` (products), or `sort` (products, new) changes, `refresh()` runs, which:

- Sets `items = []` before fetching (so a fresh page-1 request can't be confused with append).
- Fetches `?take=10&skip=0&...filters`.
- Replaces `items` with the response, updates `total` and `hasMore`.

##### `loadMore` behavior

- Guard: no-op if `!hasMore` or `loadingMore`.
- Sets `loadingMore = true`.
- Fetches `?take=10&skip=${items.length}&...current filters`.
- **Stale-response guard:** before applying, check that the current filter signature (status / includeArchived / sort) still matches what was active at request time; if not, drop the response. This prevents a slow "Load more" response from polluting a list the user has since refiltered.
- Appends response items to `items`, updates `total` and `hasMore`, sets `loadingMore = false`.

##### Mutation interactions with `total`

| Mutation                                              | Effect on `items`                                                                                  | Effect on `total` |
|-------------------------------------------------------|----------------------------------------------------------------------------------------------------|-------------------|
| `create` (products)                                   | Prepend to `items`                                                                                 | `total + 1`       |
| `archive` (products) when `!includeArchived`          | Remove from `items`                                                                                | `total - 1`       |
| `archive` (products) when `includeArchived`           | Patch in place                                                                                     | unchanged         |
| `unarchive` (products)                                | Patch in place                                                                                     | unchanged         |
| `transition` (orders) when filter excludes new status | Remove from `items`                                                                                | `total - 1`       |
| `transition` (orders) when filter does not exclude    | Patch in place                                                                                     | unchanged         |
| `setRole`, `adjustBalance` (users)                    | Patch in place                                                                                     | unchanged         |

When a row is removed from `items`, we don't auto-fetch a replacement to "fill" the page; the user's "Showing 9 of 46" briefly stays at 9, and the next "Load more" fetches `skip = 9`. This may surface or skip one row at the page boundary in rare race conditions, which is acceptable for an admin tool with low concurrent write rates.

#### Components

##### "Load more" footer (shared component, new — `frontend/src/components/admin/LoadMoreFooter.jsx`)

```jsx
<LoadMoreFooter
  shown={items.length}
  total={total}
  hasMore={hasMore}
  loading={loading}
  loadingMore={loadingMore}
  onLoadMore={loadMore}
/>
```

Renders below each table. Visibility rules:

- If `loading` (initial fetch) → render nothing. The skeleton rows already convey "loading".
- Else if `total === 0` → render nothing. The table's empty-state row already says "No X found."
- Else → render `Showing ${shown} of ${total}` on the left, and on the right: a "Load more" button when `hasMore` (disabled with `Loading…` label when `loadingMore`); nothing when `!hasMore`.

##### Tabs — `OrdersTab`, `ProductsTab`, `UsersTab`

- Read `items` instead of `orders` / `products` / `users`.
- Render `<LoadMoreFooter …/>` after the table.
- `ProductsTab` toolbar: replace the current client-side sort `<select>` (Default / Popularity) with a server-driven `sort` value piped into the hook. Options: `Newest` (default), `Popularity (most reviews)`. The label change makes the new semantics explicit.

#### Skeleton alignment fix — fixed table layout

Each tab's `<table>` gets:

- `className="w-full text-sm table-fixed"` (Tailwind `table-fixed` → `table-layout: fixed`).
- A `<colgroup>` with explicit `<col>` widths per column, sized so typical content fits without truncation but the layout doesn't depend on content.

**Per-tab column widths:**

| Tab      | Columns (and width)                                                                                                                                                       |
|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Orders   | Order `8rem`, Customer `auto`, Items `4rem`, Total `6rem`, Status `9rem`, Date `12rem`                                                                                    |
| Products | Thumb `3.5rem`, Name `auto`, Type `6rem`, Price `5rem`, Stock `5rem`, Rating `7rem`, Status `6rem`, Actions `15rem`                                                       |
| Users    | Display name `auto`, Role `7rem`, Balance `6rem`, Orders `5rem`, Joined `9rem`                                                                                            |

The single `auto` column per table absorbs slack on wide viewports. All other columns are fixed.

**Cell content:** add `truncate` (Tailwind: `overflow-hidden text-ellipsis whitespace-nowrap`) to text cells where overflow is possible (display name, customer name, product name). The order ID cell already truncates to `slice(-8)` so this is unnecessary there.

Skeleton-bar widths inside the `<td>` no longer matter for layout — `<col>` widths are authoritative — but I'll leave them at sensible values so the skeleton still looks like the column it represents.

### Data flow (per tab)

```
mount / filter change
   ↓
hook.refresh()  →  GET /admin/<resource>?take=10&skip=0&…
   ↓
setItems(items); setTotal; setHasMore
   ↓
table renders 10 rows  +  <LoadMoreFooter shown=10 total=47 hasMore=true />

user clicks "Load more"
   ↓
hook.loadMore()  →  GET /admin/<resource>?take=10&skip=10&…
   ↓
appendItems; update hasMore
   ↓
table renders 20 rows  +  <LoadMoreFooter shown=20 total=47 hasMore=true />
```

## File map

| Action  | Path                                                          | Responsibility                                                                                                |
|---------|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| Create  | `backend/lib/pagination.js`                                   | `parsePagination(query)` helper.                                                                              |
| Modify  | `backend/controllers/adminOrdersController.js`                | `listAllOrders`: parse pagination, parallel `count`, return `{ items, total, hasMore }`.                      |
| Modify  | `backend/controllers/adminProductsController.js`              | `listProducts`: parse pagination + `sort`, parallel `count`, return new envelope. Tighten `withAdminRatings`.  |
| Modify  | `backend/controllers/adminUsersController.js`                 | `listUsers`: parse pagination, parallel `count`, return new envelope.                                         |
| Create  | `backend/tests/admin.pagination.test.js`                      | Tests below.                                                                                                  |
| Modify  | `frontend/src/services/admin/adminOrdersService.js`           | `listOrders` accepts `{ status, take, skip }`; returns `{ items, total, hasMore }`.                            |
| Modify  | `frontend/src/services/admin/adminProductsService.js`         | `listProducts` accepts `{ includeArchived, sort, take, skip }`; returns new envelope.                          |
| Modify  | `frontend/src/services/admin/adminUsersService.js`            | `listUsers` accepts `{ take, skip }`; returns new envelope.                                                    |
| Modify  | `frontend/src/hooks/admin/useAdminOrders.js`                  | New state (`items`, `total`, `hasMore`, `loadingMore`); `loadMore` action; mutation paths update `total`.       |
| Modify  | `frontend/src/hooks/admin/useAdminProducts.js`                | Same + new `sort` state piped to API; drop client-side `sortProducts`.                                         |
| Modify  | `frontend/src/hooks/admin/useAdminUsers.js`                   | Same; mutations are patch-in-place so `total` unchanged.                                                       |
| Create  | `frontend/src/components/admin/LoadMoreFooter.jsx`            | "Showing X of Y" + Load more button.                                                                          |
| Modify  | `frontend/src/components/admin/OrdersTab.jsx`                 | `table-fixed` + `<colgroup>`; render `<LoadMoreFooter>`; rename `orders` → `items`.                            |
| Modify  | `frontend/src/components/admin/ProductsTab.jsx`               | Same; replace client-side sort with hook-driven `sort`; remove `sortProducts`. Update sort labels.            |
| Modify  | `frontend/src/components/admin/UsersTab.jsx`                  | Same; rename `users` → `items`.                                                                               |
| Create  | `docs/superpowers/specs/2026-05-04-admin-pagination-design.md`| This spec.                                                                                                    |
| Create  | `docs/superpowers/plans/2026-05-04-admin-pagination-plan.md`  | Implementation plan (written by writing-plans skill).                                                          |

No schema changes. No new dependencies.

## Test plan

### Backend (`backend/tests/admin.pagination.test.js`)

- `GET /admin/orders` with no params returns `{ items, total, hasMore }`; `items.length === Math.min(10, total)`.
- `GET /admin/orders?take=5&skip=5` returns the next 5 rows by `createdAt desc`, `hasMore` matches.
- `GET /admin/orders?take=10&skip=999` returns `items: []`, `hasMore: false`, `total` unchanged.
- `GET /admin/orders?take=0`, `take=-1`, `skip=-1`, non-integer values → 400.
- `GET /admin/orders?take=999` clamps to 50, no error.
- `GET /admin/orders?status=cancel_requested&take=10` filters before paging; `total` reflects the filtered count.
- Same suite for `/admin/users` (no status filter, just pagination + envelope).
- `GET /admin/products?sort=popularity` orders by review count desc with `createdAt desc` tiebreak; pagination stable across pages.
- `GET /admin/products?sort=newest` matches today's `createdAt desc` ordering.
- `GET /admin/products?sort=bogus` → 400.
- `GET /admin/products?includeArchived=true&sort=popularity&take=10` filters and sorts together.

### Frontend (manual)

- Each tab loads with 10 rows and a "Showing 10 of N" footer; if N ≤ 10, no Load more button.
- Click "Load more" — table grows by up to 10; footer updates; button hides at the end.
- Orders: change status filter — list resets to 10 rows of the new filter; total updates.
- Products: toggle "Include archived" — list resets to 10; total updates.
- Products: switch sort to "Popularity (most reviews)" — list resets to 10 sorted by review count.
- Products: create a new product — appears at top of items, total +1.
- Products: archive a product (with `!includeArchived`) — disappears from items, total -1.
- Orders: transition an order to a status outside the active filter — disappears, total -1.
- Users: change role / adjust balance — row updates in place, total unchanged.
- **Skeleton alignment:** load each tab; verify column header widths do *not* shift between skeleton state and loaded state. Test with at least one user whose display name is long enough to have caused the right-shift today.
- Stale-response guard: in DevTools, throttle network, click "Load more" then immediately switch the status filter. Verify the late "Load more" response does not append stale rows.

## Open questions

None.

## Out of scope (future work)

- Numbered pagination / jump-to-page.
- URL-persisted pagination state.
- Server-side filtering by date range or text search in admin.
- Cursor pagination if data grows past tens of thousands of rows.
- Server-side sort for Orders and Users.
