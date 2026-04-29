# Shimmer Loading States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plain "Loading…" text on the customer-facing pages (Shop, Order History, Product Detail, Checkout's AddressSelector, ReviewsSection) with shimmer skeletons that mirror real content footprints.

**Architecture:** A single `Skeleton` primitive (animated palette-consistent placeholder) plus per-context layout components that compose it. Animation lives in `index.css` as `--animate-shimmer` alongside the project's existing `--animate-*` tokens. Respects `motion-reduce`.

**Tech Stack:** React, Vite, Tailwind v4 (`@theme`-based config in `index.css`), `clsx`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-29-shimmer-loading-design.md`

---

## File Structure

**New files:**
- `frontend/src/components/Skeleton.jsx` — primitive
- `frontend/src/components/ProductDetailSkeleton.jsx` — page-body layout
- `frontend/src/components/ReviewsSkeleton.jsx` — review-list layout
- `frontend/src/components/cards/BakedGoodCardSkeleton.jsx` — product card layout
- `frontend/src/components/cards/OrderCard.jsx` — extracted real order card
- `frontend/src/components/cards/OrderCardSkeleton.jsx` — order card layout

**Modified files:**
- `frontend/src/index.css` — add shimmer keyframes + animation token
- `frontend/src/pages/ShopPage.jsx` — explicit loading boolean, render skeleton grid
- `frontend/src/pages/ProductDetailPage.jsx` — render `<ProductDetailSkeleton />`
- `frontend/src/pages/OrderHistoryPage.jsx` — render skeletons; swap inline `<article>` for `<OrderCard />`
- `frontend/src/components/ReviewsSection.jsx` — add `loading` state; render `<ReviewsSkeleton />`
- `frontend/src/components/AddressSelector.jsx` — render skeleton rows in loading branch

**No backend changes. No schema changes. No new dependencies.**

---

## Verification Protocol

The frontend has no test framework. Verification at each task is manual via the dev server:

1. From repo root: `npm run dev` (or check it's already running)
2. Open `http://127.0.0.1:5173` in a browser with DevTools open
3. **Network throttling:** DevTools → Network tab → set throttling to "Slow 3G" before navigating to a page being tested. This makes the loading state visible long enough to inspect.
4. **Reduced-motion check (Tasks 1, 2, 4, 5b, 6):** DevTools → Rendering panel → "Emulate CSS media feature prefers-reduced-motion" → "reduce". Confirm the shimmer animation stops and the skeleton shows as a flat tone.

---

## Task 0: Commit spec + plan together

This task exists because of a project convention: spec and implementation plan are bundled into a single commit, not two.

**Files:**
- Add: `docs/superpowers/specs/2026-04-29-shimmer-loading-design.md` (already written)
- Add: `docs/superpowers/plans/2026-04-29-shimmer-loading.md` (this file)

- [ ] **Step 1: Verify both files exist and are unstaged**

Run:
```bash
git status docs/superpowers/
```

Expected: both files appear under "Untracked files".

- [ ] **Step 2: Stage both files**

Run:
```bash
git add docs/superpowers/specs/2026-04-29-shimmer-loading-design.md docs/superpowers/plans/2026-04-29-shimmer-loading.md
```

- [ ] **Step 3: Commit together**

Run:
```bash
git commit -m "$(cat <<'EOF'
docs: shimmer loading states spec + implementation plan
EOF
)"
```

- [ ] **Step 4: Verify the commit**

Run:
```bash
git log -1 --stat
```

Expected: a single commit touching exactly the two doc files above.

---

## Task 1: Add shimmer animation + Skeleton primitive

The primitive is useless without the animation, the animation has no consumers without the primitive — ship them together.

**Files:**
- Modify: `frontend/src/index.css` (add to `@theme` block and `@keyframes` section)
- Create: `frontend/src/components/Skeleton.jsx`

- [ ] **Step 1: Add the animation token to the `@theme` block**

In `frontend/src/index.css`, locate the line:

```css
    --animate-checkout-rise-quick: checkout-rise 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
```

Insert the shimmer token immediately before the closing `}`:

```css
    --animate-checkout-rise-quick: checkout-rise 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
    --animate-shimmer: shimmer 1.4s infinite linear;
}
```

- [ ] **Step 2: Add the `@keyframes shimmer` block**

In `frontend/src/index.css`, locate the existing `@keyframes checkout-rise { ... }` block. Immediately after its closing `}`, add:

```css
@keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
```

- [ ] **Step 3: Create the Skeleton primitive**

Create `frontend/src/components/Skeleton.jsx`:

```jsx
import clsx from 'clsx'

export default function Skeleton({ className = '', ...rest }) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "rounded bg-line bg-[linear-gradient(100deg,transparent_30%,var(--color-cream)_50%,transparent_70%)]",
        "bg-[length:200%_100%] animate-shimmer",
        "motion-reduce:animate-none motion-reduce:bg-none",
        className,
      )}
      {...rest}
    />
  )
}
```

- [ ] **Step 4: Quick smoke check via temporary mount**

There's nothing rendering the primitive yet. Verify it's wired correctly by temporarily inserting a probe in `frontend/src/App.jsx`. Locate the existing `<Routes>` block (or wherever the top-level layout is) — at the very top of the returned JSX add:

```jsx
import Skeleton from './components/Skeleton.jsx' // TEMP
// inside the returned JSX, somewhere obvious like the top of the layout:
<div className="p-4 flex gap-2">
  <Skeleton className="h-4 w-32" />
  <Skeleton className="h-10 w-10 rounded-full" />
</div>
```

Start the dev server if not running:
```bash
npm run dev
```

Open `http://127.0.0.1:5173`. Expected: a beige bar and circle visibly shimmering with a brighter cream highlight sweeping diagonally across them every ~1.4s.

Reduced-motion check: DevTools → Rendering → `prefers-reduced-motion: reduce`. Expected: shimmer stops, both shapes show as flat beige.

- [ ] **Step 5: Remove the temporary probe**

Delete the temporary `import` and JSX block from `frontend/src/App.jsx`. Verify with:
```bash
git diff frontend/src/App.jsx
```
Expected: empty diff (nothing changed in App.jsx).

- [ ] **Step 6: Lint and commit**

Run:
```bash
cd frontend && npm run lint
```

Expected: no errors related to the new file.

Then commit:
```bash
git add frontend/src/index.css frontend/src/components/Skeleton.jsx
git commit -m "$(cat <<'EOF'
feat(ui): add shimmer animation token and Skeleton primitive
EOF
)"
```

---

## Task 2: ShopPage skeleton grid

**Files:**
- Create: `frontend/src/components/cards/BakedGoodCardSkeleton.jsx`
- Modify: `frontend/src/pages/ShopPage.jsx` (add explicit `loading` state, render skeleton grid)

- [ ] **Step 1: Create `BakedGoodCardSkeleton.jsx`**

Create `frontend/src/components/cards/BakedGoodCardSkeleton.jsx`:

```jsx
import Skeleton from '../Skeleton.jsx'

export default function BakedGoodCardSkeleton() {
  return (
    <article className="bg-surface border border-line rounded-xl overflow-hidden flex flex-col">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="p-4 flex flex-col gap-2 flex-1">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <div className="flex items-center justify-between mt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </article>
  )
}
```

The outer `<article>` matches `BakedGoodCard.jsx`'s outer shell exactly so grid spacing doesn't shift on swap. The inner shapes mirror the real card's title / rating / description / price / button pattern.

- [ ] **Step 2: Add explicit loading state to ShopPage**

In `frontend/src/pages/ShopPage.jsx`, add to the imports near the top:

```jsx
import BakedGoodCardSkeleton from '../components/cards/BakedGoodCardSkeleton.jsx'
```

Locate the existing `useState` block (around line 42-45):

```jsx
  const [bakedGoods, setBakedGoods] = useState([])
  const [error, setError] = useState(null)
  const [activeCategory, setActiveCategory] = useState(null)
  const [sortBy, setSortBy] = useState('default')
```

Add a `loading` state immediately after `error`:

```jsx
  const [bakedGoods, setBakedGoods] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(null)
  const [sortBy, setSortBy] = useState('default')
```

- [ ] **Step 3: Set loading false in the fetch effect**

In `frontend/src/pages/ShopPage.jsx`, locate the existing `useEffect`:

```jsx
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/products`)
        const data = await response.json()
        if (!cancelled) setBakedGoods(data.items)
      } catch (err) {
        if (cancelled) return
        console.error('error: ', err)
        setError('Failed to load products.')
      }
    })()
    return () => { cancelled = true }
  }, [])
```

Replace it with:

```jsx
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/products`)
        const data = await response.json()
        if (!cancelled) setBakedGoods(data.items)
      } catch (err) {
        if (cancelled) return
        console.error('error: ', err)
        setError('Failed to load products.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])
```

- [ ] **Step 4: Replace the loading text with the skeleton grid**

In `frontend/src/pages/ShopPage.jsx`, locate the render branch:

```jsx
        {error ? (
          <p className={STATUS_CLS}>{error}</p>
        ) : !bakedGoods.length ? (
          <p className={STATUS_CLS}>Loading…</p>
        ) : (
```

Replace the `!bakedGoods.length ? <p>Loading…</p> :` middle branch with an explicit `loading` check that renders the skeleton grid:

```jsx
        {error ? (
          <p className={STATUS_CLS}>{error}</p>
        ) : loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <BakedGoodCardSkeleton key={i} />
            ))}
          </div>
        ) : (
```

The grid container classes match the real-content grid below it exactly, so the swap doesn't shift layout.

- [ ] **Step 5: Verify in browser**

Make sure `npm run dev` is running. In DevTools → Network → throttling = "Slow 3G". Hard reload `http://127.0.0.1:5173` (Cmd-Shift-R).

Expected:
- For ~1-3 seconds: 8 shimmering card placeholders matching the real card grid layout. Card count fills a typical desktop width without obvious gaps.
- Then real cards swap in. Check carefully: the grid does NOT visibly shift on swap — same column count, same gaps, same card outer dimensions.

Reduced-motion check: enable `prefers-reduced-motion: reduce` and reload. Expected: skeletons appear as flat beige cards, no shimmer.

Empty-state check: stop the backend (`Ctrl-C` the `npm run dev` process or just kill backend in another terminal), reload Shop. Expected: error branch shows "Failed to load products." — NOT skeletons indefinitely. Restart backend afterwards.

- [ ] **Step 6: Lint and commit**

Run:
```bash
cd frontend && npm run lint
```
Expected: no errors related to the modified files.

Commit:
```bash
git add frontend/src/components/cards/BakedGoodCardSkeleton.jsx frontend/src/pages/ShopPage.jsx
git commit -m "$(cat <<'EOF'
feat(ui): shimmer skeleton grid on shop page
EOF
)"
```

---

## Task 3: Extract OrderCard from OrderHistoryPage (refactor only — no shimmer yet)

Pure refactor. Done as its own task and commit so the diff is easy to review later. No behavior change.

**Files:**
- Create: `frontend/src/components/cards/OrderCard.jsx`
- Modify: `frontend/src/pages/OrderHistoryPage.jsx` (replace inline `<article>` with `<OrderCard />`)

- [ ] **Step 1: Create `OrderCard.jsx`**

Create `frontend/src/components/cards/OrderCard.jsx`. This is a near-verbatim copy of the inline `<article>` block currently at lines ~171-304 of `OrderHistoryPage.jsx`, with closures replaced by props:

```jsx
import StatusBadge from '../StatusBadge.jsx'
import AddressSelector from '../AddressSelector.jsx'

const RETURN_WINDOW_MS = 48 * 60 * 60 * 1000

function canReturn(order) {
  if (order.status !== 'delivered' || !order.deliveredAt) return false
  return Date.now() - new Date(order.deliveredAt).getTime() <= RETURN_WINDOW_MS
}

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
}) {
  const isEditingAddress = editingAddressOrderId === order.id

  return (
    <article className="bg-surface border border-line rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 border-b border-line pb-4 max-sm:flex-col">
        <div>
          <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-muted">Order</p>
          <h3 className="mt-2 mb-1 text-xl text-ink">#{order.id.slice(-8)}</h3>
          <p className="m-0 text-sm text-muted">
            {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="text-right max-sm:text-left">
          <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-muted">Total</p>
          <p className="mt-2 mb-1 text-lg font-semibold text-accent-dark">{order.total} pts</p>
          <div className="mt-1"><StatusBadge status={order.status} /></div>
        </div>
      </div>

      <ul className="mt-4 grid gap-3 list-none p-0 m-0">
        {order.items.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-4 rounded-xl border border-line bg-cream/30 p-3 max-sm:items-start"
          >
            <img
              src={entry.product.imageUrl}
              alt={entry.product.name}
              className="h-16 w-16 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-base text-ink">{entry.product.name}</p>
              <p className="mt-1 mb-0 text-sm text-muted">
                Qty {entry.quantity} at {entry.unitPrice} pts each
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <p className="m-0 mb-2 text-[11px] uppercase tracking-[0.18em] text-muted">Ship to</p>
        {isEditingAddress ? (
          <div className="space-y-2">
            <AddressSelector
              selectedId={pendingAddressId}
              onSelect={onPendingAddressChange}
            />
            {addressError && (
              <p className="text-danger text-xs m-0">{addressError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={addressSaving}
                onClick={() => onSaveAddress(order.id)}
                className="text-sm px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-dark disabled:opacity-50 transition-colors"
              >
                {addressSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                disabled={addressSaving}
                onClick={onCancelEditAddress}
                className="text-sm px-3 py-1.5 rounded border border-line text-ink hover:bg-cream disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            {order.shippingLine1 ? (
              <div className="text-sm text-ink leading-relaxed">
                <div>{order.shippingLine1}</div>
                {order.shippingLine2 && <div>{order.shippingLine2}</div>}
                <div>{order.shippingCity}, {order.shippingState} {order.shippingPostalCode}</div>
                <div>{order.shippingCountry}</div>
              </div>
            ) : (
              <p className="m-0 text-sm text-muted">No address on file</p>
            )}
            {order.status === 'confirmed' && (
              <button
                type="button"
                onClick={() => onStartEditAddress(order)}
                className="text-sm px-3 py-1.5 rounded border border-line text-ink hover:bg-cream transition-colors shrink-0"
              >
                Change
              </button>
            )}
          </div>
        )}
      </div>

      {(order.requestReason || order.decisionReason) && (
        <div className="mt-4 space-y-1 text-sm">
          {order.requestReason && (
            <div className="text-muted"><span className="text-ink">Your reason:</span> {order.requestReason}</div>
          )}
          {order.decisionReason && (
            <div className="text-muted"><span className="text-ink">Reason:</span> {order.decisionReason}</div>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {order.status === 'confirmed' && (
          <button
            type="button"
            onClick={() => onCancel(order)}
            className="text-sm px-3 py-1.5 rounded border border-line text-ink hover:bg-cream transition-colors"
          >
            Cancel order
          </button>
        )}
        {order.status === 'processing' && !order.decisionReason && (
          <button
            type="button"
            onClick={() => onCancel(order)}
            className="text-sm px-3 py-1.5 rounded border border-line text-ink hover:bg-cream transition-colors"
          >
            Request cancellation
          </button>
        )}
        {order.status === 'delivered' && !order.decisionReason && (
          <button
            type="button"
            disabled={!canReturn(order)}
            title={!canReturn(order) ? 'Return period expired' : undefined}
            onClick={() => onReturn(order)}
            className="text-sm px-3 py-1.5 rounded border border-line text-ink hover:bg-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            Request return
          </button>
        )}
      </div>
    </article>
  )
}
```

Note: `RETURN_WINDOW_MS` and `canReturn` are moved into this file because they're only used by the order card. Remove them from `OrderHistoryPage.jsx` in the next step.

- [ ] **Step 2: Update `OrderHistoryPage.jsx` to use `<OrderCard />`**

In `frontend/src/pages/OrderHistoryPage.jsx`:

(a) Add the import near the existing imports:
```jsx
import OrderCard from '../components/cards/OrderCard.jsx'
```

(b) Remove the import for `StatusBadge` (it's now used inside `OrderCard`, not directly here):
```jsx
// DELETE this line:
import StatusBadge from '../components/StatusBadge.jsx'
```

(c) Remove the now-unused top-level `RETURN_WINDOW_MS` constant and `canReturn` helper (lines 19-24 of the original file):
```jsx
// DELETE these lines:
const RETURN_WINDOW_MS = 48 * 60 * 60 * 1000;

function canReturn(order) {
  if (order.status !== 'delivered' || !order.deliveredAt) return false;
  return Date.now() - new Date(order.deliveredAt).getTime() <= RETURN_WINDOW_MS;
}
```

(d) Replace the entire inline `orders.map((order) => ( <article ...>...</article> ))` block (lines ~170-305 of the original) with:

```jsx
            {orders.map((order) => (
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
            ))}
```

(e) Remove the now-unused `AddressSelector` import from `OrderHistoryPage.jsx` (it's still used inside `OrderCard`):
```jsx
// DELETE this line from OrderHistoryPage.jsx:
import AddressSelector from '../components/AddressSelector.jsx'
```

- [ ] **Step 3: Verify behavior parity in browser**

Make sure `npm run dev` is running. Log in as a user that has at least one order in each relevant status (confirmed, processing, delivered). If only seed data is available, place a fresh test order to get a `confirmed` row.

Navigate to Order History. For each order, verify:

- Header (id, total, date, status badge) renders correctly.
- Items list renders with images, names, quantities, unit prices.
- Ship-to block renders the address (or "No address on file").
- "Change" button appears only on `confirmed` orders.
- Click "Change" → AddressSelector appears, "Save" / "Cancel" buttons work, picking a different address and saving updates the order in the list. "Cancel" reverts.
- "Cancel order" button on `confirmed` orders cancels immediately (no modal).
- "Request cancellation" button on `processing` orders opens the modal.
- "Request return" button on `delivered` orders is enabled within 48h, disabled with tooltip after.
- Reasons (requestReason, decisionReason) render when present.

Expected: every behavior identical to before the refactor.

- [ ] **Step 4: Lint and commit**

Run:
```bash
cd frontend && npm run lint
```
Expected: no errors.

Commit:
```bash
git add frontend/src/components/cards/OrderCard.jsx frontend/src/pages/OrderHistoryPage.jsx
git commit -m "$(cat <<'EOF'
refactor(orders): extract OrderCard from OrderHistoryPage
EOF
)"
```

---

## Task 4: OrderHistoryPage skeleton grid

**Files:**
- Create: `frontend/src/components/cards/OrderCardSkeleton.jsx`
- Modify: `frontend/src/pages/OrderHistoryPage.jsx` (replace loading text with skeleton grid)

- [ ] **Step 1: Create `OrderCardSkeleton.jsx`**

Create `frontend/src/components/cards/OrderCardSkeleton.jsx`:

```jsx
import Skeleton from '../Skeleton.jsx'

export default function OrderCardSkeleton() {
  return (
    <article className="bg-surface border border-line rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 border-b border-line pb-4 max-sm:flex-col">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="flex flex-col gap-2 items-end max-sm:items-start">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>

      <ul className="mt-4 grid gap-3 list-none p-0 m-0">
        {[0, 1].map((i) => (
          <li key={i} className="flex items-center gap-4 rounded-xl border border-line bg-cream/30 p-3">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div className="min-w-0 flex-1 flex flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>

      <div className="mt-4">
        <Skeleton className="h-8 w-32 rounded" />
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Wire the skeleton into OrderHistoryPage's loading branch**

In `frontend/src/pages/OrderHistoryPage.jsx`, add to imports:

```jsx
import OrderCardSkeleton from '../components/cards/OrderCardSkeleton.jsx'
```

Locate the existing loading branch:

```jsx
        {loading ? (
          <div className="bg-surface border border-line rounded-xl px-8 py-12 text-center text-muted">
            Loading order history...
          </div>
        ) : error ? (
```

Replace with:

```jsx
        {loading ? (
          <div className="grid gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <OrderCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
```

The `grid gap-5` matches the real-content grid container exactly.

- [ ] **Step 3: Verify in browser**

DevTools → Network → "Slow 3G". Hard reload `/order-history` while logged in.

Expected:
- 3 shimmering order-card placeholders, each mirroring the real card's footprint (header row with id/total/badge, two item rows with thumbnails, ship-to block, action button).
- Smooth swap to real cards. Check carefully: layout does NOT shift on swap.

Reduced-motion check: enable `prefers-reduced-motion: reduce` and reload. Expected: flat beige placeholders, no animation.

Empty-state check: log in as a user with no orders. Expected: existing "You have not placed any orders yet." copy renders — NOT skeletons.

- [ ] **Step 4: Lint and commit**

Run:
```bash
cd frontend && npm run lint
```
Expected: no errors.

Commit:
```bash
git add frontend/src/components/cards/OrderCardSkeleton.jsx frontend/src/pages/OrderHistoryPage.jsx
git commit -m "$(cat <<'EOF'
feat(ui): shimmer skeleton grid on order history page
EOF
)"
```

---

## Task 5a: ReviewsSection loading state + ReviewsSkeleton

`ReviewsSection` currently has no loading state — `reviews` starts `[]` and the empty branch flashes "No reviews yet" before fetch resolves. Fix this with an explicit `loading` boolean and shimmer.

**Files:**
- Create: `frontend/src/components/ReviewsSkeleton.jsx`
- Modify: `frontend/src/components/ReviewsSection.jsx` (add `loading` state, render skeleton while loading)

- [ ] **Step 1: Create `ReviewsSkeleton.jsx`**

Create `frontend/src/components/ReviewsSkeleton.jsx`:

```jsx
import Skeleton from './Skeleton.jsx'

function ReviewRowSkeleton() {
  return (
    <div className="flex gap-3 py-3 border-b border-line last:border-b-0">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  )
}

export default function ReviewsSkeleton({ count = 2 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ReviewRowSkeleton key={i} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add `loading` state to ReviewsSection**

In `frontend/src/components/ReviewsSection.jsx`, add to imports:

```jsx
import ReviewsSkeleton from './ReviewsSkeleton.jsx'
```

Locate the existing `useState` block (around lines 31-35):

```jsx
  const [reviews, setReviews] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [formData, setFormData] = useState({ rating: 5, text: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
```

Add a `loading` state immediately after `reviews`:

```jsx
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [formData, setFormData] = useState({ rating: 5, text: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
```

- [ ] **Step 3: Set `loading` to false in the fetch effect**

Locate the existing `useEffect`:

```jsx
  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.VITE_BACKEND_URL}/products/${productId}/reviews`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setReviews(data.reviews) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [productId])
```

Replace with:

```jsx
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${import.meta.env.VITE_BACKEND_URL}/products/${productId}/reviews`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setReviews(data.reviews) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])
```

- [ ] **Step 4: Render the skeleton in the list area while loading**

Locate the existing reviews list block (around lines 194-211):

```jsx
      {/* Reviews List */}
      <div className="space-y-3">
        {reviews.length === 0 ? (
          <p className="text-muted text-[14px] py-4">
            No reviews yet. Be the first to review {productName}!
          </p>
        ) : (
          reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={user?.id}
              onDelete={() => handleDelete(review)}
              onEdit={handleEdit}
            />
          ))
        )}
      </div>
```

Replace with:

```jsx
      {/* Reviews List */}
      <div className="space-y-3">
        {loading ? (
          <ReviewsSkeleton />
        ) : reviews.length === 0 ? (
          <p className="text-muted text-[14px] py-4">
            No reviews yet. Be the first to review {productName}!
          </p>
        ) : (
          reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={user?.id}
              onDelete={() => handleDelete(review)}
              onEdit={handleEdit}
            />
          ))
        )}
      </div>
```

- [ ] **Step 5: Verify in browser**

DevTools → Network → "Slow 3G". Navigate to a product detail page (e.g. `/product/<some-id>`). Reload.

Expected: in the Reviews section, while reviews fetch, 2 shimmering review-row placeholders render — NOT "No reviews yet". Then real reviews (or the empty-state copy) swap in.

Empty-state check: pick a product with no reviews. Expected: "No reviews yet. Be the first…" copy renders after loading completes.

Reduced-motion check: enable `prefers-reduced-motion: reduce` and reload. Expected: flat beige placeholders during load.

- [ ] **Step 6: Lint and commit**

Run:
```bash
cd frontend && npm run lint
```
Expected: no errors.

Commit:
```bash
git add frontend/src/components/ReviewsSkeleton.jsx frontend/src/components/ReviewsSection.jsx
git commit -m "$(cat <<'EOF'
feat(ui): shimmer skeleton for reviews list and add explicit loading state
EOF
)"
```

---

## Task 5b: ProductDetailPage skeleton

**Files:**
- Create: `frontend/src/components/ProductDetailSkeleton.jsx`
- Modify: `frontend/src/pages/ProductDetailPage.jsx` (render `<ProductDetailSkeleton />` in loading branch)

- [ ] **Step 1: Create `ProductDetailSkeleton.jsx`**

Create `frontend/src/components/ProductDetailSkeleton.jsx`:

```jsx
import Skeleton from './Skeleton.jsx'
import ReviewsSkeleton from './ReviewsSkeleton.jsx'

export default function ProductDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <Skeleton className="aspect-square w-full rounded-xl" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        <div className="border-t border-b border-line py-4 flex flex-col gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>

        <Skeleton className="h-12 w-full rounded-lg" />

        <section className="border-t border-line pt-6">
          <Skeleton className="h-6 w-24 mb-4" />
          <ReviewsSkeleton />
        </section>
      </div>
    </div>
  )
}
```

The outer grid mirrors `ProductDetailPage`'s real two-column lg layout exactly. Heights/widths approximate the real elements.

- [ ] **Step 2: Wire skeleton into ProductDetailPage's loading branch**

In `frontend/src/pages/ProductDetailPage.jsx`, add to imports:

```jsx
import ProductDetailSkeleton from '../components/ProductDetailSkeleton.jsx'
```

Locate the existing loading branch (around lines 50-56):

```jsx
  if (loading) {
    return (
      <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
        <p className="text-center text-muted py-12">Loading…</p>
      </main>
    )
  }
```

Replace with:

```jsx
  if (loading) {
    return (
      <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
        <ProductDetailSkeleton />
      </main>
    )
  }
```

- [ ] **Step 3: Verify in browser**

DevTools → Network → "Slow 3G". Navigate to `/product/<some-id>`. Reload.

Expected:
- Two-column skeleton layout: left = square image placeholder; right = title bar, two description lines, divider, price block, divider, button placeholder, then reviews-section skeleton (heading + 2 review rows).
- Smooth swap to real content. Check that the layout does NOT shift dramatically (small shifts are acceptable since text is variable-length).
- On smaller viewports (resize browser below `lg` breakpoint of 1024px), the skeleton stacks single-column matching the real layout.

Reduced-motion check: enable `prefers-reduced-motion: reduce` and reload. Expected: flat beige placeholders, no shimmer.

Error path check: try a non-existent product id (e.g. `/product/does-not-exist`). Expected: existing "Product not found." error UI renders after the loading skeleton — NOT skeletons indefinitely.

- [ ] **Step 4: Lint and commit**

Run:
```bash
cd frontend && npm run lint
```
Expected: no errors.

Commit:
```bash
git add frontend/src/components/ProductDetailSkeleton.jsx frontend/src/pages/ProductDetailPage.jsx
git commit -m "$(cat <<'EOF'
feat(ui): shimmer skeleton on product detail page
EOF
)"
```

---

## Task 6: AddressSelector inline skeleton rows

**Files:**
- Modify: `frontend/src/components/AddressSelector.jsx` (replace `<p>Loading addresses…</p>` with skeleton rows)

- [ ] **Step 1: Add Skeleton import and replace the loading branch**

In `frontend/src/components/AddressSelector.jsx`, add to imports near the top:

```jsx
import Skeleton from './Skeleton.jsx'
```

Locate the existing loading branch (around lines 41-43):

```jsx
  if (loading) {
    return <p className="text-muted text-sm">Loading addresses…</p>;
  }
```

Replace with:

```jsx
  if (loading) {
    return (
      <ul className="flex flex-col gap-2 list-none p-0 m-0">
        {[0, 1].map((i) => (
          <li key={i}>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-surface">
              <Skeleton className="h-4 w-4 mt-1 rounded-full shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }
```

The outer wrapper (`<ul>` + `<li>` + the row's `flex items-start gap-3 p-3 rounded-lg border border-line bg-surface`) matches the real address-row structure so the swap doesn't shift layout. The inner shapes mirror the radio + line1 + line2/city/state pattern.

- [ ] **Step 2: Verify in browser**

The `AddressSelector` is used in two contexts (`CheckoutPage`'s sidebar, and `OrderHistoryPage`'s "Change address" flow). Verify both:

(a) DevTools → Network → "Slow 3G". Add an item to your cart, navigate to `/checkout`. Expected: in the right sidebar's "Ship to" section, 2 shimmering address-row placeholders appear briefly, then real addresses swap in. Layout does NOT shift on swap.

(b) On `/order-history`, click "Change" on a confirmed order. Expected: same 2-row skeleton appears briefly inside the order card, then real addresses swap in.

Reduced-motion check: enable `prefers-reduced-motion: reduce` and reload either page. Expected: flat beige placeholders.

Empty-state check: log in as a user with no addresses (or temporarily delete all your addresses via the UI). Expected: existing "Add a shipping address to continue." copy with the AddressForm renders after loading completes — NOT skeletons.

- [ ] **Step 3: Lint and commit**

Run:
```bash
cd frontend && npm run lint
```
Expected: no errors.

Commit:
```bash
git add frontend/src/components/AddressSelector.jsx
git commit -m "$(cat <<'EOF'
feat(ui): shimmer skeleton rows in AddressSelector loading state
EOF
)"
```

---

## Task 7: Final cross-page sweep

This task is verification-only. No new code.

- [ ] **Step 1: End-to-end visual sweep**

Make sure `npm run dev` is running. With DevTools → Network → "Slow 3G", visit each page in this order, hard-reloading each:

1. `/` (ShopPage) — confirm 8 product card skeletons → real cards swap.
2. `/product/<some-id>` — confirm two-column skeleton + reviews skeleton → real content swap.
3. `/checkout` (with item in cart) — confirm 2 address-row skeletons in sidebar → real addresses swap.
4. `/order-history` — confirm 3 order card skeletons → real orders swap.
5. `/order-history` → click "Change" on a confirmed order — confirm address skeletons inside the order card.

Expected: every skeleton mirrors its real-content footprint. No visible layout shift on any swap.

- [ ] **Step 2: Reduced-motion sweep**

DevTools → Rendering → `prefers-reduced-motion: reduce`. Repeat the 5 navigations above.

Expected: every skeleton renders as a flat beige placeholder with no animation.

- [ ] **Step 3: Empty- and error-state sweep**

- ShopPage with backend down → "Failed to load products." renders (not skeletons indefinitely).
- ProductDetailPage with bogus id → "Product not found." renders.
- OrderHistoryPage as a user with no orders → "You have not placed any orders yet." renders.
- ReviewsSection on a product with no reviews → "No reviews yet…" renders after loading.
- AddressSelector for a user with no addresses → existing "Add a shipping address to continue." copy renders.

Expected: every empty/error path still shows the right existing copy after the loading skeleton resolves.

- [ ] **Step 4: AdminPage smoke check**

Navigate through the admin pages briefly. Expected: zero visual change vs. before — admin was explicitly out of scope.

- [ ] **Step 5: Final lint**

```bash
cd frontend && npm run lint
```
Expected: clean.

No commit for this task — it's verification only. If any check fails, open a follow-up commit on the appropriate file.

---

## Self-Review

**Spec coverage check:**
- Skeleton primitive — Task 1 ✓
- Shimmer animation in `index.css` — Task 1 ✓
- `BakedGoodCardSkeleton` + ShopPage wiring + explicit loading boolean — Task 2 ✓
- `OrderCard` extraction — Task 3 ✓
- `OrderCardSkeleton` + OrderHistoryPage wiring — Task 4 ✓
- `ReviewsSkeleton` + ReviewsSection loading state — Task 5a ✓
- `ProductDetailSkeleton` + ProductDetailPage wiring — Task 5b ✓
- AddressSelector skeleton rows — Task 6 ✓
- Reduced-motion respected — covered in verification of every task that introduces shimmer ✓
- "Saving…", "Posting…", "Placing order…" left as plain text — never modified ✓
- AdminPage untouched — verified in Task 7 ✓
- Empty-state correctness — verified in every relevant task and Task 7 ✓
- No new dependencies — confirmed (only `clsx`, already used) ✓

**Placeholder scan:** No "TBD", "TODO", "fill in details", "similar to", or generic "add error handling" instructions. Every step contains exact code or exact commands. ✓

**Type / signature consistency:**
- `<Skeleton className="..." />` — same signature in every consumer ✓
- `OrderCard` props (`order`, `editingAddressOrderId`, `pendingAddressId`, `addressSaving`, `addressError`, `onPendingAddressChange`, `onStartEditAddress`, `onCancelEditAddress`, `onSaveAddress`, `onCancel`, `onReturn`) — defined in Task 3 Step 1, consumed in Task 3 Step 2(d). Names match. ✓
- `ReviewsSkeleton` `count` prop — defined with default `2` in Task 5a, consumed without override in Task 5a and Task 5b ✓

No issues found.
