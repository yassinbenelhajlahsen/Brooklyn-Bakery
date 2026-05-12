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
  "bg-transparent text-muted border border-line rounded-lg p-3",
  "font-sans font-medium text-[12px] leading-[1] tracking-[0.1em] uppercase",
  "[transition:color_180ms_ease,border-color_180ms_ease]",
  "hover:text-accent hover:border-accent",
  "motion-reduce:transition-none",
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
    ? (productQuery.error?.status === 404 ? 'Product not found.' : 'Failed to load product.')
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
      <div className="mb-6 flex justify-start">
        <button onClick={() => navigate('/')} className={BACK_BTN}>
          Back to Shop
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Product Image */}
        <div className="flex items-center justify-center bg-cream rounded-xl aspect-square overflow-hidden">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Product Info + Reviews */}
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-[36px] capitalize font-display mb-2">{product.name}</h1>
            <p className="text-muted text-[16px]">{product.description}</p>
          </div>

          <div className="border-t border-b border-line py-4">
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-[32px] font-semibold text-accent-dark">{product.price}</span>
              <span className="text-[16px] text-muted">pts</span>
            </div>
            {product.type && (
              <p className="text-[14px] text-muted capitalize">
                Category: <span className="text-ink font-medium">{product.type}</span>
              </p>
            )}
          </div>

          {/* Add to Cart Section */}
          <div className="flex items-center gap-3 flex-wrap">
            {qty === 0 ? (
              <button
                className="min-w-[180px] flex-1 bg-accent text-white border-none rounded-lg px-4 py-3 text-[16px] font-medium transition-[background] duration-150 ease-in-out hover:bg-accent-dark"
                onClick={() => onIncrement(product)}
              >
                Add to cart
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-[14px] text-muted">Qty in cart:</span>
                <QuantityControl
                  qty={qty}
                  onDecrement={() => onDecrement(product)}
                  onIncrement={() => onIncrement(product)}
                />
              </div>
            )}
            <button
              type="button"
              className={clsx(
                "rounded-lg border px-4 py-3 text-[16px] font-medium transition-colors duration-150 ease-in-out",
                "inline-flex items-center justify-center gap-2",
                isWishlisted
                  ? "bg-accent text-white border-accent hover:bg-accent-dark"
                  : "border-line bg-surface text-ink hover:border-accent hover:text-accent",
                wishPending && "opacity-60 cursor-wait",
              )}
              onClick={handleWishlistClick}
              disabled={wishPending}
              aria-pressed={isWishlisted}
            >
              <HeartIcon filled={isWishlisted} className="w-4.5 h-4.5" />
              <span>{isWishlisted ? 'Wished' : 'Wish'}</span>
            </button>
          </div>

          <ReviewsSection
            productSlug={slug}
            productName={product.name}
            authedFetch={authedFetch}
            isAuthenticated={isAuthenticated}
            openLogin={openLogin}
            user={user}
          />
        </div>
      </div>
    </main>
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
