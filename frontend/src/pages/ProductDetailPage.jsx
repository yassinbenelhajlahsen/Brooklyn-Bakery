import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import QuantityControl from '../components/QuantityControl.jsx'
import ReviewsSection from '../components/ReviewsSection.jsx'
import ProductDetailSkeleton from '../components/ProductDetailSkeleton.jsx'
import { useAuth } from '../auth/useAuth.js'
import { parseProductSlug } from '../lib/slugUtils.js'

const BACK_BTN = clsx(
  "bg-transparent text-muted border border-line rounded-lg p-3",
  "font-sans font-medium text-[12px] leading-[1] tracking-[0.1em] uppercase",
  "[transition:color_180ms_ease,border-color_180ms_ease]",
  "hover:text-accent hover:border-accent",
  "motion-reduce:transition-none",
)

export default function ProductDetailPage({ cart, onIncrement, onDecrement }) {
  const { slug } = useParams()
  const id = parseProductSlug(slug)
  const navigate = useNavigate()
  const { authedFetch, user, openLogin } = useAuth()
  const isAuthenticated = !!user
  const [product, setProduct] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

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
  }, [slug, id])

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
          <div className="flex items-center gap-4">
            {qty === 0 ? (
              <button
                className="flex-1 bg-accent text-white border-none rounded-lg px-4 py-3 text-[16px] font-medium transition-[background] duration-150 ease-in-out hover:bg-accent-dark"
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
          </div>

          <ReviewsSection
            productId={product.id}
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
