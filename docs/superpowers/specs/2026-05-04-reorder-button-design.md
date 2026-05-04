# Reorder Button — Design

**Date:** 2026-05-04
**Status:** Spec — pending plan

## Problem

`TODO.md` (Tier 2) lists "Re-order button — order history page exists but there's no 're-order with one click' action (no frontend button, no backend endpoint)."

## Goals

- From the Order History page, the user can re-buy the contents of a past order in one click.
- The action is resilient to product drift since the original order: archived/deleted products are skipped, current prices apply, and stock errors surface naturally at checkout.
- Quantities merge with the existing cart rather than replacing it.

## Non-goals

- A new backend endpoint. The existing `/products` endpoint and order history payload are sufficient.
- Toast notifications (Tier 3 work, not yet wired). Inline messaging is used instead.
- Re-ordering in one tap with no review screen. The user lands on `/checkout` to confirm address, balance, and quantities before placing.
- Frontend tests (project has none today; manual verification only).

## User flow

1. User opens Order History (`/orders` or wherever it's mounted).
2. Each order card shows a "Reorder" button alongside the existing Cancel/Return actions, regardless of order status.
3. User clicks Reorder. The page maps the order's line items to currently-available products, merges them into the cart, and navigates to `/checkout`.
4. If one or more products are no longer purchasable (archived or deleted), the available items are still added and the user is still navigated to `/checkout`. If *all* items are unavailable, navigation is suppressed and an inline note appears on the order card: *"2 items couldn't be added — they're no longer available."* (See "Reporting skipped items" below.)
5. On the checkout page, the user sees current prices, current balance, and any stock issues at place-order time — same as a normal checkout.

## Architecture

### Why no backend endpoint

Order line items snapshot `productId`, `quantity`, `unitPrice`, name, and imageUrl (see `backend/controllers/orderController.js:listMyOrders` — `product: { select: { name: true, imageUrl: true } }`). The frontend cart needs a live product object (current price, stock, full fields) to drive the checkout view.

The Order History page will fetch `/products` on mount (the existing endpoint) and build a `productId → product` map. Reordering then becomes: for each line item, look up the current product, call `addItem(product, qty)`, navigate. Items missing from the map are reported as skipped.

This avoids a new endpoint, avoids enlarging the order history payload, and uses the same product shape the rest of the app already uses.

### Frontend changes

**`useCart` — new `addItem(item, qty)` method**

Currently `useCart` exposes `increment(item)` (always +1). Looping `increment` for a multi-quantity reorder would trigger N localStorage writes and N server syncs per item. Add a single `addItem(item, qty)` that increments by `qty` in one `setQty` call:

```js
const addItem = (item, qty) => setQty(item, (cart[item.id]?.qty ?? 0) + qty)
```

The existing 99-cap in `setQty` handles the "already in cart" case correctly.

**`App.jsx` — pass cart helpers to `OrderHistoryPage`**

`OrderHistoryPage` is currently rendered without cart props. Add `addItem` (the new method) to its props.

**`OrderHistoryPage.jsx` — fetch products, own reorder logic**

- On mount, `GET /products` and build `productMap = Map<productId, product>`.
- State: `skippedByOrderId: Record<orderId, number>` for inline messages.
- Handler `handleReorder(order)`:
  1. Walk `order.items`. For each, look up `productMap.get(item.productId)`.
  2. If found, call `addItem(product, item.quantity)`. If not, increment the skipped count for this order.
  3. If at least one item was added, `navigate('/checkout')`.
  4. If *all* items were skipped, stay on the page and update `skippedByOrderId[order.id]` so the user sees the message.
- Pass `onReorder` and `skippedCount` into each `OrderCard`.

**`OrderCard.jsx` — Reorder button + skipped note**

- Add a "Reorder" button to the existing action row (`<div className="mt-4 flex gap-2">`). Show it for every status — there's no harm in re-buying items from a cancelled or returned order.
- Above the action row, render the inline note when `skippedCount > 0`:
  *"N item(s) couldn't be added — they're no longer available."*

### Reporting skipped items

The user clicks Reorder. Two outcomes:

- **At least one item available** → navigate to `/checkout` immediately. The skipped note is set on the order card, but the user has left the page. This is acceptable: the user can come back, and we don't want to delay the happy path.
- **All items unavailable** → do not navigate. Set the skipped note. The button stays clickable but the user now sees why nothing happened.

This avoids a modal and avoids the toast library (not yet installed).

### Edge cases

| Case | Behavior |
|------|----------|
| Product archived since order | Skip, count toward inline note. |
| Product deleted (no row) | Same as archived. `productMap.get()` returns `undefined`. |
| Item already in cart | Quantities sum, capped at 99 by existing `setQty` logic. |
| Out of stock now | Still added to cart. `placeOrder` already returns 409 on insufficient stock at order time, surfaced by `usePlaceOrder` in CheckoutPage. |
| User logged out mid-flow | `OrderHistoryPage` already redirects to `/` via `<Navigate>` if `!user`. No new handling needed. |
| `/products` fetch fails | Reorder buttons are disabled with title="Loading products…" until the fetch resolves. On error, button stays disabled with title="Could not load products — refresh to try again." |

## Data flow

```
click Reorder on order #abc
   ↓
handleReorder(order):
  for each item in order.items:
    product = productMap.get(item.productId)
    if product: addItem(product, item.quantity)
    else: skipped++
   ↓
skipped > 0 → setSkippedByOrderId({ ...prev, [order.id]: skipped })
   ↓
addedAny → navigate('/checkout')
   ↓
CheckoutPage renders with merged cart, current prices, address picker
   ↓
user places order via existing flow
```

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/hooks/useCart.js` | Add `addItem(item, qty)`; export it. |
| Modify | `frontend/src/App.jsx` | Pass `addItem` to `OrderHistoryPage`. |
| Modify | `frontend/src/pages/OrderHistoryPage.jsx` | Accept `addItem` prop; fetch products on mount; track `skippedByOrderId`; implement `handleReorder`; pass into each `OrderCard`. |
| Modify | `frontend/src/components/cards/OrderCard.jsx` | Render "Reorder" button; render skipped-items inline note when count > 0. |
| Create | `docs/superpowers/specs/2026-05-04-reorder-button-design.md` | This spec. |
| Create | `docs/superpowers/plans/2026-05-04-reorder-button-plan.md` | Implementation plan (written by the writing-plans skill). |

No backend changes. No schema changes. No new dependencies.

## Test plan

### Backend

No backend changes; no new tests.

### Frontend (manual)

- Reorder a delivered order with 3 in-stock items → cart contains the items at current prices, navigates to `/checkout`.
- Reorder when one of the order's products has been archived → cart contains the available items; the order card shows "1 item couldn't be added — it's no longer available."; navigates to `/checkout`.
- Reorder when all of the order's products have been archived → no navigation; inline note shows the count; cart unchanged.
- Reorder an item already in the cart → quantities sum; the 99-cap is respected.
- Reorder a cancelled order → button still works, items still added.
- Reorder while `/products` is still loading → button is disabled with helpful title.
- Reorder when product price has changed since the order → checkout shows the *current* price, not the snapshotted one.

## Open questions

None.

## Out of scope (future work)

- Toast/snackbar notifications once a toast library is installed (Tier 3).
- A "Reorder" action from the order detail view, if/when one is added.
- Treating "Reorder" as a true one-click order placement (would need address default + balance check + price-confirm dialog).
