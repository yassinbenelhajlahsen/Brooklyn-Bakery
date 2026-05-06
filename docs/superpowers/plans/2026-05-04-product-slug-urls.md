# Product Slug URLs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace UUID-based product URLs (`/product/<uuid>`) with human-readable slug URLs (`/product/<name-slug>-<uuid-hex>`) that remain unique even when two products share the same name.

**Architecture:** The slug is `{kebab-name}-{32-char-hex-uuid}` (e.g. `country-sourdough-loaf-af52179312345678abcd123456789abc`). The 32-char hex suffix is the product UUID with hyphens stripped, which lets the backend reconstruct the exact UUID and do a normal `findUnique` lookup — no raw SQL or prefix scanning needed. A shared `parseProductSlug` / `toProductSlug` utility lives in both `backend/lib/` and `frontend/src/lib/` (two small files, not shared, because the frontend is Vite/React and can't import from the backend).

**Tech Stack:** Node.js (ESM), Express, Prisma, React 18, React Router v6, Vite

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/lib/slugUtils.js` | `parseProductSlug(slug)` → UUID string or null |
| Create | `backend/tests/slugUtils.test.js` | Unit tests for `parseProductSlug` |
| Modify | `backend/controllers/productsController.js` | Use `parseProductSlug` in `getProduct` |
| Modify | `backend/routes/productsRoutes.js` | Rename `:id` param to `:slug` (cosmetic) |
| Create | `frontend/src/lib/slugUtils.js` | `toProductSlug(name, id)` → slug string; `parseProductSlug(slug)` → UUID string or null |
| Modify | `frontend/src/components/cards/BakedGoodCard.jsx` | Use `toProductSlug` when navigating |
| Modify | `frontend/src/pages/ProductDetailPage.jsx` | Extract UUID from slug param before fetching |
| Modify | `frontend/src/App.jsx` | Change route from `/product/:id` to `/product/:slug` |

---

## Task 1: Backend slug utility (TDD)

**Files:**
- Create: `backend/lib/slugUtils.js`
- Create: `backend/tests/slugUtils.test.js`

- [ ] **Step 1: Create the test file**

```js
// backend/tests/slugUtils.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProductSlug } from '../lib/slugUtils.js';

const VALID_UUID = 'af521793-1234-5678-abcd-123456789abc';
const HEX = 'af52179312345678abcd123456789abc'; // UUID with hyphens stripped

test('parseProductSlug: extracts UUID from well-formed slug', () => {
  assert.equal(parseProductSlug(`country-sourdough-loaf-${HEX}`), VALID_UUID);
});

test('parseProductSlug: works when name slug has numbers', () => {
  assert.equal(parseProductSlug(`product-42-${HEX}`), VALID_UUID);
});

test('parseProductSlug: returns null when slug is too short', () => {
  assert.equal(parseProductSlug('short'), null);
});

test('parseProductSlug: returns null when last 32 chars contain non-hex', () => {
  const badHex = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'; // 32 non-hex chars
  assert.equal(parseProductSlug(`some-product-${badHex}`), null);
});

test('parseProductSlug: returns null for non-string input', () => {
  assert.equal(parseProductSlug(null), null);
  assert.equal(parseProductSlug(undefined), null);
  assert.equal(parseProductSlug(42), null);
});
```

- [ ] **Step 2: Run tests to confirm they fail (function not yet defined)**

```bash
cd /path/to/repo/backend && node --test tests/slugUtils.test.js
```

Expected: All 5 tests fail with `Cannot find module '../lib/slugUtils.js'` or similar.

- [ ] **Step 3: Create `backend/lib/slugUtils.js`**

```js
// backend/lib/slugUtils.js
export function parseProductSlug(slug) {
  if (typeof slug !== 'string' || slug.length < 32) return null;
  const hex = slug.slice(-32);
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /path/to/repo/backend && node --test tests/slugUtils.test.js
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/lib/slugUtils.js backend/tests/slugUtils.test.js
git commit -m "$(cat <<'EOF'
feat(backend): add parseProductSlug utility

Extracts the UUID from a slug of the form {kebab-name}-{32-char-hex-uuid}.
EOF
)"
```

---

## Task 2: Update backend controller and route

**Files:**
- Modify: `backend/controllers/productsController.js`
- Modify: `backend/routes/productsRoutes.js`

- [ ] **Step 1: Update `getProduct` in `productsController.js`**

Replace the existing `getProduct` function:

```js
// At the top of productsController.js, add the import:
import { parseProductSlug } from '../lib/slugUtils.js';
```

Replace the existing `getProduct` export:

```js
export async function getProduct(req, res) {
  const id = parseProductSlug(req.params.slug);
  if (!id) return res.status(404).json({ error: 'Product not found.' });
  const product = await prisma.product.findFirst({
    where: { id, archivedAt: null },
    select: PRODUCT_SELECT,
  });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const [formatted] = await withRatings([product]);
  res.json(formatted);
}
```

- [ ] **Step 2: Rename the route param in `productsRoutes.js`**

Change the two occurrences of `/:id` that call `getProduct` and `getProductReviews`:

```js
// backend/routes/productsRoutes.js  — full file after change:
import express from 'express';
import {getProducts, getProduct} from '../controllers/productsController.js';
import {getProductReviews, createReview, updateReview, deleteReview} from '../controllers/reviewsController.js';
import {requireAuth} from '../middleware/requireAuth.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/:slug', getProduct);
router.get('/:slug/reviews', getProductReviews);
router.post('/:slug/reviews', requireAuth, createReview);
router.patch('/:slug/reviews', requireAuth, updateReview);
router.delete('/:slug/reviews', requireAuth, deleteReview);

export default router;
```

- [ ] **Step 3: Update `reviewsController.js` to parse the slug param**

Add the import at the top of `backend/controllers/reviewsController.js`:
```js
import { parseProductSlug } from '../lib/slugUtils.js';
```

Replace the four exported functions in their entirety:

```js
export async function getProductReviews(req, res) {
  const productId = parseProductSlug(req.params.slug);
  if (!productId) return res.status(404).json({ error: 'Product not found.' });
  const reviews = await prisma.review.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    select: REVIEW_SELECT,
  });
  res.json({ reviews });
}

export async function createReview(req, res) {
  const { rating, text } = req.body;
  const productId = parseProductSlug(req.params.slug);
  if (!productId) return res.status(404).json({ error: 'Product not found.' });
  const userId = req.user.id;

  const ratingInt = parseInt(rating, 10);
  if (!Number.isInteger(ratingInt) || ratingInt < 1 || ratingInt > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }
  const trimmedText = text ? String(text).trim() || null : null;

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId } },
  });
  if (existing) {
    return res.status(409).json({ error: 'You have already reviewed this product.' });
  }

  const review = await prisma.review.create({
    data: { productId, userId, rating: ratingInt, text: trimmedText },
    select: REVIEW_SELECT,
  });
  res.status(201).json(review);
}

export async function updateReview(req, res) {
  const { rating, text } = req.body;
  const productId = parseProductSlug(req.params.slug);
  if (!productId) return res.status(404).json({ error: 'Product not found.' });
  const userId = req.user.id;

  const ratingInt = parseInt(rating, 10);
  if (!Number.isInteger(ratingInt) || ratingInt < 1 || ratingInt > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }
  const trimmedText = text ? String(text).trim() || null : null;

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId } },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Review not found.' });
  }

  const review = await prisma.review.update({
    where: { productId_userId: { productId, userId } },
    data: { rating: ratingInt, text: trimmedText },
    select: REVIEW_SELECT,
  });
  res.json(review);
}

export async function deleteReview(req, res) {
  const productId = parseProductSlug(req.params.slug);
  if (!productId) return res.status(404).json({ error: 'Product not found.' });
  const userId = req.user.id;

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId } },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Review not found.' });
  }

  await prisma.review.delete({ where: { productId_userId: { productId, userId } } });
  res.status(204).end();
}
```

- [ ] **Step 4: Run all backend tests**

```bash
cd /path/to/repo/backend && npm test
```

Expected: All existing tests pass plus the 5 new slug tests.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/productsController.js backend/controllers/reviewsController.js backend/routes/productsRoutes.js
git commit -m "$(cat <<'EOF'
feat(backend): look up products by slug instead of raw UUID
EOF
)"
```

---

## Task 3: Frontend slug utility and wiring

**Files:**
- Create: `frontend/src/lib/slugUtils.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/cards/BakedGoodCard.jsx`
- Modify: `frontend/src/pages/ProductDetailPage.jsx`

- [ ] **Step 1: Create `frontend/src/lib/slugUtils.js`**

```js
// frontend/src/lib/slugUtils.js
export function toProductSlug(name, id) {
  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const hex = id.replace(/-/g, '');
  return `${nameSlug}-${hex}`;
}

export function parseProductSlug(slug) {
  if (typeof slug !== 'string' || slug.length < 32) return null;
  const hex = slug.slice(-32);
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
```

- [ ] **Step 2: Update the route in `frontend/src/App.jsx`**

Change:
```jsx
path="/product/:id"
```
To:
```jsx
path="/product/:slug"
```

- [ ] **Step 3: Update `BakedGoodCard.jsx` to navigate to slug URL**

Add the import at the top of `BakedGoodCard.jsx`:
```js
import { toProductSlug } from '../../lib/slugUtils.js'
```

Change the `handleCardClick` function:
```js
const handleCardClick = () => {
  navigate(`/product/${toProductSlug(item.name, item.id)}`)
}
```

- [ ] **Step 4: Update `ProductDetailPage.jsx` to extract UUID from slug**

Add the import at the top:
```js
import { parseProductSlug } from '../lib/slugUtils.js'
```

Change the `useParams` destructuring and the fetch call:
```js
// Replace:
//   const { id } = useParams()
// With:
const { slug } = useParams()
const id = parseProductSlug(slug)
```

Update the `useEffect` dependency array and the early 404 guard:

```js
useEffect(() => {
  let cancelled = false
  ;(async () => {
    if (!id) {
      setError('Product not found.')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/products/${slug}`)
      if (!cancelled) {
        if (response.status === 404) {
          setError('Product not found.')
        } else {
          const data = await response.json()
          setProduct(data)
        }
      }
    } catch (err) {
      if (cancelled) return
      console.error('error: ', err)
      setError('Failed to load product.')
    } finally {
      if (!cancelled) setLoading(false)
    }
  })()
  return () => { cancelled = true }
}, [slug])
```

Note: the fetch URL uses `slug` (the full slug string) because the backend route now expects a slug, not a bare UUID.

- [ ] **Step 5: Run the frontend linter**

```bash
cd /path/to/repo/frontend && npm run lint
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/slugUtils.js frontend/src/App.jsx frontend/src/components/cards/BakedGoodCard.jsx frontend/src/pages/ProductDetailPage.jsx
git commit -m "$(cat <<'EOF'
feat(frontend): navigate to product slug URLs
EOF
)"
```
