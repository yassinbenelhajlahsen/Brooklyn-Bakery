import { useEffect, useState } from 'react'

function StarRow({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className={`w-3 h-3 ${i < rating ? 'fill-accent' : 'fill-line'}`}
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  )
}

export default function ProductReviewsModal({ product, onClose }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.VITE_BACKEND_URL}/products/${product.id}/reviews`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) { setReviews(data.reviews); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError('Failed to load reviews.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [product.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-xl border border-line shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="text-[16px] font-medium text-ink">
            Reviews — {product.name}
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink transition-colors text-[20px] leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {loading ? (
            <p className="text-muted text-sm py-4 text-center">Loading…</p>
          ) : error ? (
            <p className="text-danger text-sm py-4 text-center">{error}</p>
          ) : reviews.length === 0 ? (
            <p className="text-muted text-sm py-4 text-center">No reviews yet.</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="bg-cream rounded-lg p-4 border border-line">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-ink text-sm">
                      {review.user.displayName ?? 'Anonymous'}
                    </p>
                    <p className="text-[12px] text-muted">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <StarRow rating={review.rating} />
                </div>
                <p className="text-[14px] text-ink leading-relaxed">{review.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
