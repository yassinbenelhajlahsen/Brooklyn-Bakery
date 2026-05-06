# Tier 1: Product Search + Newest Sort — Design

**Date:** 2026-05-04
**Branch:** `feat/product-improvements`
**Status:** Spec — pending plan

## Problem

`TODO.md` lists two missing Tier 1 requirements:

1. **Product search by name** — no search bar in the UI and no backend `?search=` query param.
2. **Sort by newest arrivals** — sort dropdown supports price and top-rated but not `createdAt`.

Both belong on the Shop page (`/`).

## Goals

- Users can find a product by typing into a search input on the Shop page.
- Search matches both `name` and `description`, with name-matches ranked above description-only matches.
- Search state persists in the URL (`?q=…`) so refresh, back/forward, and link-sharing all work.
- Users can sort the catalog by newest arrivals (`createdAt desc`).

## Non-goals

- Pagination, fuzzy/typo tolerance, full-text-search ranking (`ts_rank`).
- A global search input in the header.
- Moving category filter or sort to the backend.
- Persisting category or sort selection in the URL.
- Frontend tests (the project has none today; manual verification only).

## User flow

1. User loads `/` → Shop page fetches `/products` and renders all products as today.
2. User types `cro` in the new search input → after 250ms the URL becomes `/?q=cro`, the page refetches `/products?search=cro`, and results filter live.
3. The Sort dropdown automatically gains a "Relevance" option and switches to it (unless the user has already chosen a different sort, which is preserved).
4. User picks "Price: Low to High" → list reorders client-side; "Relevance" remains an available option.
5. User clears the search → URL becomes `/`, list shows everything; if sort was "Relevance", it flips back to "Featured".
6. If the search has no matches, the grid is replaced with `No products match "cro".`.

## Architecture

### Backend

`GET /products` accepts an optional `?search=<string>` query parameter.

```text
GET /products                  → existing behavior (unchanged response shape, plus createdAt)
GET /products?search=<q>       → filtered list, each item carries a `score` field
```

**Filter:**

```js
where = {
  archivedAt: null,
  ...(q && {
    OR: [
      { name:        { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ],
  }),
}
```

**Scoring (computed in JS after the query):**

- `score: 2` — name (case-insensitive substring) matches `q`.
- `score: 1` — only description matches.
- `score` field is omitted when `q` is empty/absent.

The backend does **not** sort by score. Backend ordering when `search` is present is unspecified (the client is responsible for ordering by score in "Relevance" mode). When `search` is absent, the existing `[type asc, name asc]` ordering is preserved.

**Response shape additions:**

- `createdAt` — ISO timestamp on every item (used by client-side "Newest" sort).
- `score` — `1` or `2`, present only when `?search=` was supplied.

### Frontend

`ShopPage.jsx` toolbar layout (left → right):

```
<item count>     <search input>     Sort by <dropdown>
```

**Search input:**

- `<input type="search" placeholder="Search products…">`.
- Local `inputValue` state updates on every keystroke (input stays responsive).
- 250 ms debounce, then `setSearchParams({ q })` updates the URL.
- Native `<input type="search">` clear (×) is sufficient for resetting `q`.

**URL state:**

- `useSearchParams` from `react-router-dom` is the source of truth for `q`.
- A `useEffect` keyed on `q` fetches `${VITE_BACKEND_URL}/products?search=${encodeURIComponent(q.trim())}`. When `q.trim()` is empty, fetch `/products` (no `search` param).
- Refresh and back/forward preserve the active query.

**Sort dropdown — final option set:**

| Value         | Label                  | When visible          | Comparator                                              |
|---------------|------------------------|-----------------------|---------------------------------------------------------|
| `relevance`   | Relevance              | only when `q` present | `score` desc, then `name` asc                           |
| `default`     | Featured               | always                | `name` asc (existing behavior)                          |
| `newest`      | Newest arrivals        | always                | `createdAt` desc, then `name` asc                       |
| `price-asc`   | Price: Low to High     | always                | existing                                                |
| `price-desc`  | Price: High to Low     | always                | existing                                                |
| `top-rated`   | Top Rated              | always                | existing                                                |

**Default-flip behavior:**

For these rules, "non-empty `q`" means `q.trim().length > 0`.

- On initial mount or when `q` transitions empty → non-empty: if current sort is `default`, switch to `relevance`.
- When `q` transitions non-empty → empty: if current sort is `relevance`, switch to `default`.
- A sort the user explicitly picked (anything other than the auto-flip case above) is preserved across `q` changes.

**Empty state:**

- When `q` is non-empty and `visible.length === 0`: render `No products match "<q>".` in place of the grid.

### Data flow

```
keystroke
   ↓ (immediate)
inputValue state
   ↓ (250 ms debounce)
setSearchParams({ q })
   ↓ (URL changes)
useEffect on q
   ↓
fetch /products?search=<q>
   ↓
setBakedGoods(items)             # items include score, createdAt
   ↓
useMemo: filter by category → sort by selected sort
   ↓
render ProductCard[]  (or empty-state message)
```

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `backend/controllers/productsController.js` | Accept `req.query.search`, build conditional `OR` where, attach `score`, add `createdAt` to `PRODUCT_SELECT` and the response. |
| Create | `backend/tests/products.search.test.js` | Tests below. |
| Modify | `frontend/src/pages/ShopPage.jsx` | Search input, URL sync via `useSearchParams`, refetch on `q`, new `relevance` and `newest` sort options, default-flip logic, empty-state. |
| Create | `docs/superpowers/specs/2026-05-04-tier1-search-and-newest-sort-design.md` | This spec. |
| Create | `docs/superpowers/plans/2026-05-04-tier1-search-and-newest-sort-plan.md` | Implementation plan (written by the writing-plans skill). |

No schema changes. No new dependencies.

## Test plan

### Backend (`backend/tests/products.search.test.js`)

- `GET /products` with no `search` returns all non-archived items, no `score` field on items, includes `createdAt`.
- `GET /products?search=<name-substring>` returns only matching products; matched items have `score: 2`.
- `GET /products?search=<description-only-substring>` returns matching products with `score: 1`.
- `GET /products?search=<substring matching both name and description>` returns `score: 2` (name match wins).
- Search is case-insensitive (e.g. `Cookie` and `cookie` both match `Chocolate Chip Cookie`).
- Archived products are excluded from search results.
- `GET /products?search=<no-matches>` returns `{ items: [] }`.
- Empty `search` (`?search=`) is treated identically to no `search` param.

### Frontend (manual)

- Type a name fragment → results filter; "Relevance" appears and is selected; URL contains `?q=…`.
- Refresh with `?q=…` in the URL → input is pre-filled, results are filtered, "Relevance" selected.
- Clear the search → URL drops `q`, sort returns to "Featured", grid shows everything.
- Sort by "Newest arrivals" → newest products first (verify via seed data `createdAt`).
- Pick a non-default sort, then type a query → user-selected sort is preserved (no auto-flip).
- Type a query with no matches → empty state message renders the typed query verbatim.
- Category filter still works alongside search.

## Open questions

None.

## Out of scope (future work)

- Move category filter and sort selection to URL query params.
- Add `ts_rank`-based scoring once the catalog grows past a few hundred products.
- Global header search.
- Pagination.
