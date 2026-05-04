import { useEffect, useState } from 'react'
import ReviewCard from './ReviewCard.jsx'
import ReviewsSkeleton from './ReviewsSkeleton.jsx'

function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none"
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
        >
          <svg
            className={`w-7 h-7 transition-colors ${n <= (hovered || value) ? 'fill-accent' : 'fill-line'}`}
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  )
}

export default function ReviewsSection({ productSlug, productName, authedFetch, isAuthenticated, openLogin, user }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [formData, setFormData] = useState({ rating: 5, text: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${import.meta.env.VITE_BACKEND_URL}/products/${productSlug}/reviews`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setReviews(data.reviews) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productSlug])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      const res = await authedFetch(`/products/${productSlug}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: formData.rating, text: formData.text.trim() || null }),
      })
      if (res.status === 409) {
        setFormError('You have already reviewed this product.')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setFormError(body.error ?? 'Failed to submit review.')
        return
      }
      const created = await res.json()
      setReviews([created, ...reviews])
      setFormData({ rating: 5, text: '' })
      setFormOpen(false)
    } catch {
      setFormError('Failed to submit review.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (review) => {
    try {
      const res = await authedFetch(`/products/${productSlug}/reviews`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        setReviews((prev) => prev.filter((r) => r.id !== review.id))
      }
    } catch { /* swallow */ }
  }

  const handleEdit = async (_review, { rating, text }) => {
    const res = await authedFetch(`/products/${productSlug}/reviews`, {
      method: 'PATCH',
      body: JSON.stringify({ rating, text: text.trim() || null }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to save.')
    }
    const updated = await res.json()
    setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null

  return (
    <section className="border-t border-line pt-6">
      <div className="mb-6">
        <h2 className="text-[22px] font-display mb-2">Reviews</h2>
        {avgRating && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={`w-4 h-4 ${i < Math.round(avgRating) ? 'fill-accent' : 'fill-line'}`}
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <span className="text-[14px] text-muted">
              {avgRating} out of 5 ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
            </span>
          </div>
        )}
      </div>

      {/* Write a Review */}
      {!isAuthenticated ? (
        <button
          onClick={() => openLogin()}
          className="mb-6 bg-accent text-white border-none rounded-lg px-4 py-2 text-[14px] font-medium transition-[background] duration-150 ease-in-out hover:bg-accent-dark"
        >
          Log in to write a review
        </button>
      ) : !formOpen ? (
        <button
          onClick={() => setFormOpen(true)}
          className="mb-6 bg-accent text-white border-none rounded-lg px-4 py-2 text-[14px] font-medium transition-[background] duration-150 ease-in-out hover:bg-accent-dark"
        >
          Write a Review
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mb-6 bg-cream rounded-lg p-5 border border-line"
        >
          <h3 className="text-[16px] font-medium mb-4">Share Your Thoughts</h3>

          {formError && (
            <p className="text-danger text-[14px] mb-4">{formError}</p>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-ink mb-2">Rating</label>
              <StarPicker value={formData.rating} onChange={(n) => setFormData({ ...formData, rating: n })} />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink mb-2">
                Review <span className="text-muted font-normal">(optional)</span>
              </label>
              <textarea
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="Tell us what you think…"
                rows={3}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none transition-shadow focus:shadow-card resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false)
                  setFormData({ rating: 5, text: '' })
                  setFormError('')
                }}
                className="px-4 py-2 border border-line bg-surface rounded-lg text-[14px] font-medium text-ink transition-colors hover:bg-cream"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-accent text-white rounded-lg text-[14px] font-medium transition-[background] duration-150 ease-in-out hover:bg-accent-dark disabled:opacity-50"
              >
                {submitting ? 'Posting…' : 'Post Review'}
              </button>
            </div>
          </div>
        </form>
      )}

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
    </section>
  )
}
