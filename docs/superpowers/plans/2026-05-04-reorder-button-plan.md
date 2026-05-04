# Reorder Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Reorder" button to each card on the Order History page that adds a past order's still-available items to the current cart and navigates to checkout.

**Architecture:** No backend changes. The Order History page fetches `/products` on mount, builds a `productId → product` map, and on click maps the order's line items to current products via that map. Items whose product is archived/deleted are skipped and reported inline. A new bulk-increment helper `addItem(item, qty)` is added to `useCart` to keep the merge to one state update per item.

**Tech Stack:** React 18, React Router v6, Vite. (No backend changes; no new dependencies.)

**Spec:** `docs/superpowers/specs/2026-05-04-reorder-button-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/hooks/useCart.js` | Add `addItem(item, qty)`; export it. |
| Modify | `frontend/src/App.jsx` | Pass `addItem` to `OrderHistoryPage`. |
| Modify | `frontend/src/pages/OrderHistoryPage.jsx` | Accept `addItem`; fetch `/products` on mount; track `skippedByOrderId`; implement `handleReorder`; pass into each `OrderCard`. |
| Modify | `frontend/src/components/cards/OrderCard.jsx` | Render "Reorder" button; render skipped-items inline note when count > 0. |

The project has no frontend tests. Verification is manual via the dev server (consistent with existing tier-1 frontend work). Backend has no changes, so backend tests are not affected.

---

## Task 1: Add `addItem` to `useCart`

**Files:**
- Modify: `frontend/src/hooks/useCart.js:82-94`

- [ ] **Step 1: Add `addItem` and include it in the returned object**

Add the new helper just below the existing `increment` declaration, and include it in the destructured return.

Replace lines 82–94 of `frontend/src/hooks/useCart.js`:

```js
  const increment = (item) => setQty(item, (cart[item.id]?.qty ?? 0) + 1)
  const decrement = (item) => setQty(item, (cart[item.id]?.qty ?? 0) - 1)
  const removeItem = (item) => setQty(item, 0)
  const addItem = (item, qty) => setQty(item, (cart[item.id]?.qty ?? 0) + qty)
  const clearCart = () => {
    setCart({})
    if (session?.access_token) {
      clearServerCart(authedFetch)
    }
  }

  const itemCount = useMemo(() => computeCartItemCount(cart), [cart])

  return { cart, itemCount, increment, decrement, removeItem, addItem, clearCart }
```

The 99-cap and "delete on qty <= 0" logic in `setQty` (lines 66-80) handle the bulk add correctly. Passing `qty <= 0` is a no-op (the existing branch deletes the entry only if `clamped <= 0`, which only happens when current qty is 0 — fine).

- [ ] **Step 2: Verify no other consumer breaks**

Run: `grep -rn "useCart()" /Users/yassin/work/Brooklyn-Bakery/frontend/src`
Expected: only `App.jsx` calls `useCart()`. The existing destructure does not name `addItem`, so adding it is purely additive.

---

## Task 2: Wire `addItem` through `App.jsx` to `OrderHistoryPage`

**Files:**
- Modify: `frontend/src/App.jsx:25, 81`

- [ ] **Step 1: Destructure `addItem`**

Change `App.jsx:25` from:

```js
  const { cart, itemCount, increment, decrement, removeItem, clearCart } = useCart()
```

to:

```js
  const { cart, itemCount, increment, decrement, removeItem, addItem, clearCart } = useCart()
```

- [ ] **Step 2: Pass `addItem` into the `/orders` route**

Change `App.jsx:81` from:

```jsx
        <Route path="/orders" element={<OrderHistoryPage />} />
```

to:

```jsx
        <Route path="/orders" element={<OrderHistoryPage addItem={addItem} />} />
```

- [ ] **Step 3: Verify the build**

Run: `cd /Users/yassin/work/Brooklyn-Bakery/frontend && npm run build`
Expected: build succeeds. (No type checks, but Vite will fail on syntax errors.)

---

## Task 3: Fetch products in `OrderHistoryPage` and implement `handleReorder`

**Files:**
- Modify: `frontend/src/pages/OrderHistoryPage.jsx`

- [ ] **Step 1: Accept `addItem`, add product fetch + skipped state**

In the imports section (top of file), the file already imports `useEffect, useState`. No new imports needed for state.

Change the function signature on line 30 from:

```js
export default function OrderHistoryPage() {
```

to:

```js
export default function OrderHistoryPage({ addItem }) {
```

Inside the component (just after the existing `addressError` state on line 40), add three new state values:

```js
  const [productMap, setProductMap] = useState(null)
  const [productsError, setProductsError] = useState(null)
  const [skippedByOrderId, setSkippedByOrderId] = useState({})
```

After the existing orders-loading `useEffect` (line 70), add a second `useEffect` that fetches the catalog once on mount:

```js
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/products`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (cancelled) return
        const map = new Map((data.items ?? []).map((p) => [p.id, p]))
        setProductMap(map)
        setProductsError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load products for reorder', err)
        setProductsError(err?.message ?? 'Could not load products.')
      }
    })()
    return () => { cancelled = true }
  }, [])
```

- [ ] **Step 2: Add `handleReorder`**

Add this handler alongside the other handlers (e.g. just before `if (!user) return …` on line 136):

```js
  function handleReorder(order) {
    if (!productMap) return
    let skipped = 0
    let added = 0
    for (const entry of order.items) {
      const product = productMap.get(entry.productId)
      if (product) {
        addItem(product, entry.quantity)
        added += 1
      } else {
        skipped += 1
      }
    }
    if (skipped > 0) {
      setSkippedByOrderId((prev) => ({ ...prev, [order.id]: skipped }))
    } else {
      setSkippedByOrderId((prev) => {
        if (!(order.id in prev)) return prev
        const next = { ...prev }
        delete next[order.id]
        return next
      })
    }
    if (added > 0) {
      navigate('/checkout')
    }
  }
```

- [ ] **Step 3: Pass reorder data into each `OrderCard`**

Change the `<OrderCard>` block inside the orders map (around line 166) so it receives the new props. Replace:

```jsx
              <OrderCard
                key={order.id}
                order={order}
                editingAddressOrderId={editingAddressOrderId}
                pendingAddressId={pendingAddressId}
                addressSaving={addressSaving}
                addressError={addressError}
                onPendingAddressChange={setPendingAddressId}
                onStartEditAddress={startEditingAddress}
                onCancelEditAddress={cancelEditingAddress}
                onSaveAddress={saveAddress}
                onCancel={handleCancel}
                onReturn={handleReturn}
              />
```

with:

```jsx
              <OrderCard
                key={order.id}
                order={order}
                editingAddressOrderId={editingAddressOrderId}
                pendingAddressId={pendingAddressId}
                addressSaving={addressSaving}
                addressError={addressError}
                onPendingAddressChange={setPendingAddressId}
                onStartEditAddress={startEditingAddress}
                onCancelEditAddress={cancelEditingAddress}
                onSaveAddress={saveAddress}
                onCancel={handleCancel}
                onReturn={handleReturn}
                onReorder={handleReorder}
                reorderDisabledReason={
                  productsError
                    ? 'Could not load products — refresh to try again.'
                    : !productMap
                      ? 'Loading products…'
                      : null
                }
                skippedCount={skippedByOrderId[order.id] ?? 0}
              />
```

---

## Task 4: Add the Reorder button and skipped-items note to `OrderCard`

**Files:**
- Modify: `frontend/src/components/cards/OrderCard.jsx`

- [ ] **Step 1: Accept the new props**

Change the destructure on lines 11-23 to include the three new props:

```js
export default function OrderCard({
  order,
  editingAddressOrderId,
  pendingAddressId,
  addressSaving,
  addressError,
  onPendingAddressChange,
  onStartEditAddress,
  onCancelEditAddress,
  onSaveAddress,
  onCancel,
  onReturn,
  onReorder,
  reorderDisabledReason,
  skippedCount,
}) {
```

- [ ] **Step 2: Render the inline skipped note above the action row**

The existing action row starts at line 130 with `<div className="mt-4 flex gap-2">`. Immediately *before* that div, insert:

```jsx
      {skippedCount > 0 && (
        <p className="mt-4 text-sm text-danger m-0">
          {skippedCount === 1
            ? "1 item couldn't be added — it's no longer available."
            : `${skippedCount} items couldn't be added — they're no longer available.`}
        </p>
      )}
```

- [ ] **Step 3: Add the Reorder button to the action row**

Inside the existing `<div className="mt-4 flex gap-2">` (after the closing of the existing buttons, before its closing `</div>` on line 160), append:

```jsx
        <button
          type="button"
          disabled={Boolean(reorderDisabledReason)}
          title={reorderDisabledReason ?? undefined}
          onClick={() => onReorder(order)}
          className="text-sm px-3 py-1.5 rounded border border-line text-ink hover:bg-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          Reorder
        </button>
```

This matches the styling of the sibling buttons in the same row (Cancel/Return).

- [ ] **Step 4: Verify the build**

Run: `cd /Users/yassin/work/Brooklyn-Bakery/frontend && npm run build`
Expected: build succeeds.

---

## Task 5: Lint and manual smoke test

- [ ] **Step 1: Lint**

Run: `cd /Users/yassin/work/Brooklyn-Bakery/frontend && npm run lint`
Expected: no errors. Fix any lint errors introduced by the new code (most likely an unused import or missing dependency in the `useEffect` array — both should be clean as written above).

- [ ] **Step 2: Start the dev server and walk through the spec's manual test plan**

Run (from repo root): `npm run dev`

Walk through every bullet in the spec's "Frontend (manual)" section:
- Reorder a delivered order with multiple in-stock items → cart contains the items at current prices, navigates to `/checkout`.
- Reorder an item already in the cart → quantities sum; the 99-cap is respected.
- Reorder a cancelled order → button still works.
- Reorder while the product fetch is in flight (you may need to throttle the network in DevTools) → button disabled with "Loading products…" title.
- Reorder when product price has changed since the order → checkout shows current price.
- (If feasible) archive a product via admin, then reorder an order that contained it → that item is skipped, inline note shows the count.

If anything diverges from the spec, fix it and re-run the relevant cases.

---

## Task 6: Commit spec + plan + code together

Per project convention, the spec + plan + implementation are bundled into one commit (single change set, easy to revert).

- [ ] **Step 1: Update TODO.md**

Edit `/Users/yassin/work/Brooklyn-Bakery/TODO.md`: change the Tier 2 reorder bullet from `- [ ]` to `- [x]`.

- [ ] **Step 2: Stage and commit**

Run:

```bash
cd /Users/yassin/work/Brooklyn-Bakery
git add TODO.md \
        docs/superpowers/specs/2026-05-04-reorder-button-design.md \
        docs/superpowers/plans/2026-05-04-reorder-button-plan.md \
        frontend/src/hooks/useCart.js \
        frontend/src/App.jsx \
        frontend/src/pages/OrderHistoryPage.jsx \
        frontend/src/components/cards/OrderCard.jsx
git status
```

Expected `git status`: only the listed files staged. If anything else is modified (e.g. `package-lock.json`), inspect before committing.

Then:

```bash
git commit -m "$(cat <<'EOF'
feat: reorder button on order history

Adds a "Reorder" action to each order card. Maps the order's line items
to currently-available products via a fresh /products fetch, merges them
into the cart, and navigates to /checkout. Items whose product has been
archived or deleted are skipped and reported inline on the order card.

Includes spec and implementation plan.
EOF
)"
```

- [ ] **Step 3: Verify**

Run: `git log -1 --stat`
Expected: one commit, the four code files + spec + plan + TODO.md listed.
