import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../lib/apiFetch.js'
import { queryKeys } from '../../lib/queryKeys.js'
import { toNameSlug } from '../../lib/slugUtils.js'

const ANIM_MS = 250

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

export default function ProductReviewsDrawer({ product, onClose }) {
  const [entered, setEntered] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const slug = product?.name ? toNameSlug(product.name) : null

  const reviewsQuery = useQuery({
    queryKey: queryKeys.reviewsById(product.id),
    queryFn: () => apiGet(`/products/${slug}/reviews`),
    enabled: !!slug,
  })

  const reviews = reviewsQuery.data?.reviews ?? []
  const loading = reviewsQuery.isLoading
  const error = reviewsQuery.isError ? 'Failed to load reviews.' : null

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const closeWithAnim = useCallback(() => {
    setLeaving(true)
    setTimeout(onClose, ANIM_MS)
  }, [onClose])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeWithAnim() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeWithAnim])

  const visible = entered && !leaving

  return (
    <>
      <div
        className={`fixed inset-0 h-dvh z-40 bg-black/50 transition-opacity duration-250 ease-out ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={closeWithAnim}
        aria-hidden="true"
      />
      <aside
        className={`fixed top-0 right-0 h-dvh w-120 max-w-full max-sm:w-full bg-surface border-l border-line shadow-[-12px_0_40px_rgba(61,47,36,0.12)] z-50 flex flex-col overflow-hidden transition-transform duration-250 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-label={`Reviews for ${product.name}`}
      >
        <div className="px-6 py-4 border-b border-line bg-cream/40 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted mb-0.5">Reviews</p>
            <h2 className="font-display text-xl text-ink capitalize">{product.name}</h2>
          </div>
          <button
            onClick={closeWithAnim}
            aria-label="Close drawer"
            className="w-8 h-8 rounded-full hover:bg-line flex items-center justify-center text-muted hover:text-ink transition-colors"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
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
      </aside>
    </>
  )
}
