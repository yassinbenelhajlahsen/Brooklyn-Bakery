import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import QuantityControl from '../components/QuantityControl.jsx'
import ReviewsSection from '../components/ReviewsSection.jsx'
import ProductDetailSkeleton from '../components/ProductDetailSkeleton.jsx'
import { useAuth } from '../auth/useAuth.js'
import { apiGet } from '../lib/apiFetch.js'
import { queryKeys } from '../lib/queryKeys.js'
import { addWishlistItem, fetchWishlist, removeWishlistItem } from '../services/wishlistService.js'

const BACK_BTN = clsx(
  'bg-transparent text-muted border border-line rounded-lg p-3',
  'font-sans font-medium text-[12px] leading-[1] tracking-[0.1em] uppercase',
  '[transition:color_180ms_ease,border-color_180ms_ease]',
  'hover:text-accent hover:border-accent',
  'motion-reduce:transition-none',
)

const PRIMARY_BTN = clsx(
  'rounded-xl bg-accent px-5 py-3.5 text-white',
  'font-sans text-[13px] font-medium uppercase tracking-[0.12em]',
  'transition hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed',
  'motion-reduce:transition-none',
)

const SECONDARY_BTN = clsx(
  'rounded-xl border border-line bg-surface px-5 py-3.5 text-ink',
  'font-sans text-[13px] font-medium uppercase tracking-[0.12em]',
  'transition hover:border-accent hover:text-accent hover:bg-cream',
  'disabled:opacity-60 disabled:cursor-not-allowed',
  'motion-reduce:transition-none',
)

export default function ProductDetailPage({ cart, onIncrement, onDecrement }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { authedFetch, user, openLogin } = useAuth()
  const isAuthenticated = !!user
  const queryClient = useQueryClient()
  const [pendingWishProductId, setPendingWishProductId] = useState(null)

  const productQuery = useQuery({
    queryKey: queryKeys.product(slug),
    queryFn: () => apiGet(`/products/${slug}`),
    staleTime: 60_000,
    enabled: !!slug,
    retry: (failureCount, err) => {
      if (err?.status === 404) return false
      return failureCount < 1
    },
  })

  const wishlistQuery = useQuery({
    queryKey: queryKeys.wishlist(),
    queryFn: () => fetchWishlist(authedFetch),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  const addWishMutation = useMutation({
    mutationFn: (productId) => addWishlistItem(authedFetch, productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wishlist() }),
  })

  const removeWishMutation = useMutation({
    mutationFn: (productId) => removeWishlistItem(authedFetch, productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wishlist() }),
  })

  const addWishMutate = addWishMutation.mutate

  useEffect(() => {
    if (!isAuthenticated || pendingWishProductId == null) return
    if (!wishlistQuery.isSuccess) return

    const productId = pendingWishProductId
    const already = wishlistQuery.data?.items?.some((entry) => entry.productId === productId)

    // Clear before mutating so a re-render from the mutation doesn't refire the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingWishProductId(null)

    if (!already) {
      addWishMutate(productId)
    }
  }, [isAuthenticated, pendingWishProductId, wishlistQuery.isSuccess, wishlistQuery.data, addWishMutate])

  const product = productQuery.data ?? null
  const loading = productQuery.isLoading
  const error = productQuery.isError
    ? productQuery.error?.status === 404
      ? 'Product not found.'
      : 'Failed to load product.'
    : null

  if (loading) {
    return (
      <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
        <div className="mb-6 flex justify-start">
          <button onClick={() => navigate('/')} className={BACK_BTN}>
            Back to Shop
          </button>
        </div>
        <ProductDetailSkeleton />
      </main>
    )
  }

  if (error || !product) {
    return (
      <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
        <div className="text-center">
          <p className="text-muted py-12">{error || 'Product not found.'}</p>
          <button onClick={() => navigate('/')} className={BACK_BTN}>
            Back to Shop
          </button>
        </div>
      </main>
    )
  }

  const qty = cart[product.id]?.qty ?? 0
  const isWishlisted = !!wishlistQuery.data?.items?.some((entry) => entry.productId === product.id)
  const wishPending = addWishMutation.isPending || removeWishMutation.isPending
  const rating = product.avgRating ?? null
  const reviewCount = product.reviewCount ?? 0
  const stock = product.stock ?? null
  const outOfStock = stock === 0

  function handleWishlistClick() {
    if (!isAuthenticated) {
      setPendingWishProductId(product.id)
      openLogin()
      return
    }

    if (isWishlisted) {
      removeWishMutation.mutate(product.id)
    } else {
      addWishMutation.mutate(product.id)
    }
  }

  return (
    <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
      <div className="mb-6 flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
        <button onClick={() => navigate('/')} className={BACK_BTN}>
          Back to Shop
        </button>

        <button
          type="button"
          onClick={handleWishlistClick}
          disabled={wishPending}
          aria-pressed={isWishlisted}
          className={clsx(
            SECONDARY_BTN,
            'inline-flex items-center justify-center gap-2',
            isWishlisted && 'border-accent bg-accent/10 text-accent',
            wishPending && 'cursor-wait opacity-60',
          )}
        >
          <HeartIcon filled={isWishlisted} className="h-4 w-4" />
          <span>{isWishlisted ? 'Saved to wishlist' : 'Save to wishlist'}</span>
        </button>
      </div>

      <section className="rounded-3xl border border-line bg-surface shadow-card overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] max-[960px]:grid-cols-1">
          <div className="bg-cream/70 p-6 max-sm:p-4">
            <div className="relative overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-[620px] w-full object-cover max-[960px]:h-[420px] max-sm:h-[320px]"
              />

              {product.type && (
                <div className="absolute left-4 top-4 rounded-full bg-surface/90 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-accent shadow-sm backdrop-blur">
                  {product.type}
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col p-8 max-sm:p-5">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-line bg-cream px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted">
                  Brooklyn Bakery
                </span>

                {stock != null && (
                  <span
                    className={clsx(
                      'rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em]',
                      outOfStock
                        ? 'bg-danger/10 text-danger'
                        : 'bg-emerald-50 text-emerald-700',
                    )}
                  >
                    {outOfStock ? 'Out of stock' : `${stock} available`}
                  </span>
                )}
              </div>

              <h1 className="font-display text-[46px] leading-[1.02] tracking-[-0.02em] text-ink capitalize max-sm:text-[34px]">
                {product.name}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 text-accent">
                  <StarRating value={rating} />
                </div>

                <span className="text-sm text-muted">
                  {rating ? `${rating.toFixed(1)} rating` : 'No ratings yet'}
                  {reviewCount > 0 ? ` • ${reviewCount} review${reviewCount === 1 ? '' : 's'}` : ''}
                </span>
              </div>

              <p className="mt-5 text-[15px] leading-7 text-muted">
                {product.description}
              </p>
            </div>

            <div className="my-7 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <InfoTile label="Price" value={`${product.price} pts`} />
              <InfoTile label="Category" value={product.type ?? 'Bakery'} capitalize />
            </div>

            <div className="rounded-2xl border border-line bg-white/70 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-muted">
                    Your cart
                  </p>
                  <p className="m-0 mt-1 text-sm text-ink">
                    {qty === 0 ? 'This item is not in your cart yet.' : `${qty} in cart`}
                  </p>
                </div>

                {qty > 0 && (
                  <QuantityControl
                    qty={qty}
                    onDecrement={() => onDecrement(product)}
                    onIncrement={() => onIncrement(product)}
                  />
                )}
              </div>

              {qty === 0 ? (
                <button
                  type="button"
                  className={clsx(PRIMARY_BTN, 'w-full')}
                  onClick={() => onIncrement(product)}
                  disabled={outOfStock}
                >
                  {outOfStock ? 'Out of stock' : 'Add to cart'}
                </button>
              ) : (
                <button
                  type="button"
                  className={clsx(PRIMARY_BTN, 'w-full')}
                  onClick={() => navigate('/checkout')}
                >
                  Go to checkout
                </button>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-line bg-cream/40 p-4">
              <p className="m-0 text-sm text-ink font-medium">
                Freshly prepared bakery item
              </p>
              <p className="m-0 mt-1 text-xs leading-5 text-muted">
                Add it to your cart with points. You can adjust the quantity before checkout.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-line bg-surface p-6 shadow-card max-sm:p-4">
        <div className="mb-5 flex items-end justify-between gap-3 max-sm:flex-col max-sm:items-start">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted">
              Customer feedback
            </p>
            <h2 className="font-display text-[30px] leading-tight text-ink">
              Reviews for {product.name}
            </h2>
          </div>

          <div className="rounded-full bg-cream px-4 py-2 text-sm text-muted">
            {reviewCount} review{reviewCount === 1 ? '' : 's'}
          </div>
        </div>

        <ReviewsSection
          productSlug={slug}
          productName={product.name}
          authedFetch={authedFetch}
          isAuthenticated={isAuthenticated}
          openLogin={openLogin}
          user={user}
        />
      </section>
    </main>
  )
}

function InfoTile({ label, value, capitalize = false }) {
  return (
    <div className="rounded-2xl border border-line bg-white/70 p-4">
      <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <p
        className={clsx(
          'm-0 mt-2 text-[18px] font-medium text-ink',
          capitalize && 'capitalize',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function StarRating({ value }) {
  const rounded = value ? Math.round(value) : 0

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value ? `${value} out of 5 stars` : 'No rating yet'}>
      {Array.from({ length: 5 }).map((_, index) => (
        <StarIcon key={index} filled={index < rounded} className="h-4 w-4" />
      ))}
    </span>
  )
}

function StarIcon({ filled, className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5 14.9 8.6l6.6.95-4.8 4.7 1.15 6.6L12 17.75 6.15 20.85 7.3 14.25l-4.8-4.7 6.6-.95Z" />
    </svg>
  )
}

function HeartIcon({ filled, className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 4.6c-1.8-1.7-4.7-1.6-6.4.2L12 7.3 9.6 4.8C7.9 3 5 2.9 3.2 4.6 1.3 6.5 1.3 9.5 3.1 11.3L12 20l8.9-8.7c1.8-1.8 1.8-4.8-.1-6.7Z" />
    </svg>
  )
}
