# Reviews Feature Design

**Date:** 2026-04-24  
**Status:** Approved

---

## Overview

Add a product review system to Brooklyn Bakery. Any visitor can read reviews; authenticated users can submit one review per product. The admin products tab gains average rating display, a per-product reviews drawer, and a "sort by popularity" option. The shop page also gains a popularity sort.

---

## Data Model

New `reviews` table:

| Column       | Type         | Constraints                        |
|--------------|--------------|------------------------------------|
| id           | UUID         | PK, default gen_random_uuid()      |
| product_id   | UUID         | FK → products.id ON DELETE CASCADE |
| user_id      | UUID         | FK → users.id ON DELETE CASCADE    |
| rating       | INT          | NOT NULL, CHECK 1–5                |
| text         | TEXT         | NOT NULL                           |
| created_at   | TIMESTAMPTZ  | NOT NULL, default now()            |

Unique constraint: `(product_id, user_id)` — one review per user per product.

Prisma model `Review` with relations to `Product` and `User`. Both existing models gain a `reviews Review[]` relation field.

---

## Backend

### New: `backend/controllers/reviewsController.js`

**`getProductReviews(req, res)`** — public  
- `GET /products/:id/reviews`  
- Returns all reviews for the product joined with `users.displayName`, ordered by `createdAt DESC`  
- Response: `{ reviews: [{ id, rating, text, createdAt, user: { displayName } }] }`

**`createReview(req, res)`** — `requireAuth`  
- `POST /products/:id/reviews`  
- Body: `{ rating: int, text: string }`  
- Validates: rating 1–5, text non-empty; returns 400 on invalid input  
- Returns 409 if the user already has a review for this product (no upsert)  
- Response: the created review object

### Route additions (`backend/routes/productsRoutes.js`)

```js
router.get('/:id/reviews', getProductReviews)
router.post('/:id/reviews', requireAuth, createReview)
```

### Updated product responses

`getProducts` and `getProduct` both gain:
- `avgRating: number | null` — Prisma `_avg.rating` on the reviews relation
- `reviewCount: number` — Prisma `_count.reviews`

---

## Frontend

### `ReviewsSection.jsx`

- New props: `productId`, `authedFetch`, `isAuthenticated`
- Remove the `reviewer` name field; identity comes from auth context
- On mount, fetch `GET /products/:id/reviews`; replace local state with API data
- On submit, call `POST /products/:id/reviews` via `authedFetch`; refresh list on success
- If unauthenticated, render a "Log in to write a review" prompt instead of the form button
- Display a user-facing message on 409 (already reviewed)

### `ReviewCard.jsx`

- Replace `review.reviewer` with `review.user.displayName`
- Replace `review.date` string with `new Date(review.createdAt).toLocaleDateString()`

### `ProductDetailPage.jsx`

- Pass `productId`, `authedFetch`, and `isAuthenticated` from auth context into `ReviewsSection`

### `BakedGoodCard.jsx`

- Below the product name, render a small star row showing `avgRating` (1 decimal) and `reviewCount`
- If `reviewCount === 0`, render nothing

### Shop page sort

- Add a "Sort by" control to the shop grid
- Options: Default (name/type) | Top rated
- "Top rated" sorts client-side by `avgRating DESC`; unrated products go to the end

### Admin products tab

- Add `★ avgRating (reviewCount)` display next to each product row
- Add a "Reviews" button per product that opens a drawer listing reviews read-only (reviewer name, rating, text, date)
- Add "Sort by popularity" to existing sort options, ordering by `avgRating DESC`

---

## No Tests

No backend or frontend tests are in scope for this feature.

---

## Implementation Order

1. Prisma migration + schema update + `db:generate`
2. Backend controller + routes + updated product responses
3. Frontend: wire `ReviewsSection` and `ReviewCard` to the API
4. Frontend: `BakedGoodCard` star display
5. Frontend: shop sort by popularity
6. Frontend: admin products tab — stars, Reviews drawer, sort
