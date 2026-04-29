# Shimmer Loading States — Design

**Date:** 2026-04-29
**Branch:** `feat/loading-state-improvements`
**Status:** Approved (pending user spec review)

## Goal

Replace the plain `Loading…` text states on the customer-facing pages with shimmer skeletons that mirror the real content's footprint. Improves perceived performance and gives the four loading-heavy contexts a single consistent visual language.

**In scope:** ShopPage, ProductDetailPage (+ inner ReviewsSection), OrderHistoryPage, CheckoutPage's `AddressSelector`.

**Out of scope:**
- AdminPage and all components inside it (per user instruction — they look fine).
- In-flight action feedback such as button labels (`Saving…`, `Posting…`, `Placing order…`). These are post-click affordances, not initial-load states; shimmer is the wrong vocabulary for them.

## Non-goals

- Changing data-fetch logic.
- Adding a skeleton for the cart drawer or any other surface not enumerated above.
- Introducing a third-party skeleton library.

---

## Architecture

One reusable primitive plus per-context layout components. No variants on the primitive — callers control the shape with Tailwind utilities.

```
frontend/src/components/
  Skeleton.jsx                       # primitive
  ProductDetailSkeleton.jsx          # full page-body layout
  ReviewsSkeleton.jsx                # review-list layout
  cards/
    BakedGoodCard.jsx                # existing
    BakedGoodCardSkeleton.jsx        # new
    OrderCard.jsx                    # new (extracted from OrderHistoryPage)
    OrderCardSkeleton.jsx            # new
```

`AddressSelector` gets a 2-row inline skeleton (too small to warrant its own file).

### Why a single primitive

Four contexts all need the same animated placeholder shape. A 20-line primitive plus per-context layouts removes duplication, keeps animation tuning in one place, and lets each layout focus on matching its real-content footprint.

### Why extract OrderCard

The order article is currently ~130 lines of inline JSX inside `OrderHistoryPage.jsx`. To build a faithful skeleton, the real card's structure needs to be a self-contained reference. Extracting to `components/cards/OrderCard.jsx` puts the real and skeleton versions side-by-side and brings `OrderHistoryPage.jsx` down to a manageable size. This is targeted improvement to code being touched, not unrelated refactoring.

---

## Components

### `Skeleton.jsx` — primitive

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

- Base tone is `--color-line` (existing soft beige) — palette-consistent, not generic gray.
- Highlight band uses `--color-cream`, the brightest existing surface tone.
- `aria-hidden="true"` — skeletons are pure visual filler. Status announcements (when needed) live elsewhere.
- `motion-reduce` strips the gradient image (`bg-none`), leaving the flat `bg-line` tone with no animation — matching the project's existing `motion-reduce:animate-none` convention.

### Animation in `frontend/src/index.css`

Added to the `@theme` block alongside the other `--animate-*` tokens:

```css
--animate-shimmer: shimmer 1.4s infinite linear;
```

And to the keyframes section:

```css
@keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
```

### Per-context layout components

| Component | Mirrors | Outer shell |
|---|---|---|
| `BakedGoodCardSkeleton` | `BakedGoodCard.jsx`: square image, title, rating row, two description lines, price row | `bg-surface border border-line rounded-xl` |
| `OrderCardSkeleton` | New `OrderCard.jsx`: header (id + total + status), divider, two item rows, ship-to block, action button | `bg-surface border border-line rounded-xl p-6` |
| `ProductDetailSkeleton` | Two-column lg layout: left image; right title/desc/divider/price/divider/button + nested `ReviewsSkeleton` | none — fills the page main |
| `ReviewsSkeleton` | Review-list area in `ReviewsSection`: 2 review-row placeholders (avatar circle + name bar + star row + two text lines) | none — drops into existing section |

Each uses the real component's outer shell (where applicable) so the swap doesn't shift the layout.

### `OrderCard.jsx` extraction

Extract the existing inline `<article>` from `OrderHistoryPage.jsx` (lines ~171–304) into `components/cards/OrderCard.jsx`. Props match the closures it currently uses:

```
<OrderCard
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

No behavior change — pure move with prop wiring.

---

## Integration

### Skeleton counts (per Approach 1, Question 5A)

- ShopPage: 8 `BakedGoodCardSkeleton`
- OrderHistoryPage: 3 `OrderCardSkeleton`
- ProductDetailPage: 1 `ProductDetailSkeleton`
- ReviewsSection: 2 review-row skeletons via `ReviewsSkeleton`
- AddressSelector: 2 inline address-row skeletons

### Per-page changes

**`ShopPage.jsx`** — replace the `!bakedGoods.length ? <p>Loading…</p> :` branch with a grid of 8 `BakedGoodCardSkeleton` using the same grid container classes (`grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6`). Track an explicit `loading` boolean rather than reusing `!bakedGoods.length`, so an empty result set doesn't render skeletons forever.

**`ProductDetailPage.jsx`** — replace the loading-branch paragraph with `<ProductDetailSkeleton />` inside the same `<main>` wrapper. Error branch unchanged.

**`OrderHistoryPage.jsx`** — replace the loading-branch bordered card with a grid of 3 `OrderCardSkeleton` using the same `grid gap-5` container. Real branch renders `<OrderCard ... />` instead of inline JSX.

**`ReviewsSection.jsx`** — currently no loading state (reviews start `[]`, briefly shows "No reviews yet"). Add an explicit `loading` state that starts `true`, set `false` in the fetch's `.then`/`.catch`. Render `<ReviewsSkeleton />` while loading, then the existing list/empty-state.

**`AddressSelector.jsx`** — replace the `<p>Loading addresses…</p>` branch with a 2-row skeleton (`<Skeleton>` rectangles sized to match the existing address rows).

### Loading-text strings left as-is

Per Approach 1: `Saving…`, `Posting…`, `Placing order…`, button-disabled spinners, etc. remain plain text — they're action feedback, not data-fetch states.

---

## Data flow

No change. Each page already has a `loading`/`error`/`data` state machine; the only modification is what's rendered in the loading branch.

`ReviewsSection` is the one place we add a new `loading` boolean — currently absent.

`ShopPage` switches from "implicit loading via empty array" to "explicit `loading` boolean" so we don't render skeletons indefinitely if the response is legitimately empty.

---

## Accessibility

- `<Skeleton>` is `aria-hidden="true"` — placeholders should not be announced.
- `motion-reduce` respected: no shimmer animation when the user prefers reduced motion. The gradient image is stripped, leaving the flat `bg-line` tone.
- No new live regions introduced. The existing pages don't announce loading states today; this change is not the right place to add that.

---

## Error handling

No change. Error branches in each page are unaffected — they continue to render their existing error UI.

If the fetch resolves with an empty list (e.g., no orders, no products), the page exits the loading branch and falls through to its existing "no items" empty-state copy, not skeletons.

---

## Testing

Frontend has no test infrastructure (per `CLAUDE.md`). Verification is manual:

1. **Visual smoke test** — throttle the network in DevTools and load each page; confirm the skeleton appears, mirrors the real layout, and the swap doesn't shift content.
2. **Reduced-motion check** — toggle `prefers-reduced-motion` in DevTools rendering panel; confirm the shimmer stops animating.
3. **Empty-state check** — for ShopPage and OrderHistoryPage, simulate an empty response (e.g., temporarily filter to nothing in the backend or comment out seed data) and confirm the empty-state copy still renders, not skeletons.
4. **`OrderCard` extraction parity** — exercise every order action (cancel, request-cancel, request-return, change address, save address, cancel-edit) on the new component to confirm no regression vs the inline version.

---

## File-level summary

**New files:**
- `frontend/src/components/Skeleton.jsx`
- `frontend/src/components/ProductDetailSkeleton.jsx`
- `frontend/src/components/ReviewsSkeleton.jsx`
- `frontend/src/components/cards/OrderCard.jsx` (extracted)
- `frontend/src/components/cards/OrderCardSkeleton.jsx`
- `frontend/src/components/cards/BakedGoodCardSkeleton.jsx`

**Modified files:**
- `frontend/src/index.css` (add `--animate-shimmer` token + `@keyframes shimmer`)
- `frontend/src/pages/ShopPage.jsx` (explicit loading state, render skeleton grid)
- `frontend/src/pages/ProductDetailPage.jsx` (render `<ProductDetailSkeleton />`)
- `frontend/src/pages/OrderHistoryPage.jsx` (render `<OrderCardSkeleton />`s, swap inline article for `<OrderCard />`)
- `frontend/src/components/ReviewsSection.jsx` (add `loading` state, render `<ReviewsSkeleton />`)
- `frontend/src/components/AddressSelector.jsx` (render skeleton rows in loading branch)

No backend changes. No schema changes. No new dependencies.
