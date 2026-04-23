import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import QuantityControl from '../components/QuantityControl.jsx'
import ReviewsSection from '../components/ReviewsSection.jsx'

export default function ProductDetailPage({ cart, onIncrement, onDecrement }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/products`)
        const data = await response.json()
        if (!cancelled) {
          const found = data.items.find((item) => item.id === id)
          if (found) {
            setProduct(found)
          } else {
            setError('Product not found.')
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
  }, [id])

  if (loading) {
    return (
      <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
        <p className="text-center text-muted py-12">Loading…</p>
      </main>
    )
  }

  if (error || !product) {
    return (
      <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
        <div className="text-center">
          <p className="text-muted py-12">{error || 'Product not found.'}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-accent text-white border-none rounded-lg px-4 py-2 text-[14px] font-medium transition-[background] duration-150 ease-in-out hover:bg-accent-dark"
          >
            Back to Shop
          </button>
        </div>
      </main>
    )
  }

  const qty = cart[product.id]?.qty ?? 0

  return (
    <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
      <button
        onClick={() => navigate('/')}
        className="mb-6 text-accent hover:text-accent-dark transition-colors text-[14px] font-medium flex items-center gap-1"
      >
        ← Back to Shop
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Product Image */}
        <div className="flex items-center justify-center bg-cream rounded-xl aspect-square overflow-hidden">
          <img
            src={product.imageUrl}
            alt={product.description}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Product Info */}
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
        </div>
      </div>

      {/* Reviews Section */}
      <ReviewsSection productId={product.id} productName={product.name} />
    </main>
  )
}
