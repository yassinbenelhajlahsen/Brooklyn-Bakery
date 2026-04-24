import { useState } from 'react'
import ReviewCard from './ReviewCard.jsx'

export default function ReviewsSection({ productName }) {
  const [reviews, setReviews] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [formData, setFormData] = useState({
    reviewer: '',
    rating: 5,
    text: '',
  })
  const [formError, setFormError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setFormError('')

    if (!formData.reviewer.trim()) {
      setFormError('Please enter your name.')
      return
    }
    if (!formData.text.trim()) {
      setFormError('Please enter a review.')
      return
    }

    const newReview = {
      id: Date.now().toString(),
      reviewer: formData.reviewer.trim(),
      rating: parseInt(formData.rating),
      text: formData.text.trim(),
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    }

    setReviews([newReview, ...reviews])
    setFormData({ reviewer: '', rating: 5, text: '' })
    setFormOpen(false)
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null

  return (
    <section className="border-t border-line pt-12">
      <div className="mb-8">
        <h2 className="text-[28px] font-display mb-2">Reviews</h2>
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

      {/* Add Review Button/Form */}
      {!formOpen ? (
        <button
          onClick={() => setFormOpen(true)}
          className="mb-8 bg-accent text-white border-none rounded-lg px-4 py-2 text-[14px] font-medium transition-[background] duration-150 ease-in-out hover:bg-accent-dark"
        >
          Write a Review
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mb-8 bg-cream rounded-lg p-6 border border-line"
        >
          <h3 className="text-[18px] font-medium mb-4">Share Your Thoughts</h3>

          {formError && (
            <p className="text-danger text-[14px] mb-4">{formError}</p>
          )}

          <div className="space-y-4">
            {/* Name Input */}
            <div>
              <label className="block text-[14px] font-medium text-ink mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={formData.reviewer}
                onChange={(e) => setFormData({ ...formData, reviewer: e.target.value })}
                placeholder="Enter your name"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none transition-shadow focus:shadow-card"
              />
            </div>

            {/* Rating Input */}
            <div>
              <label className="block text-[14px] font-medium text-ink mb-2">
                Rating
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none transition-shadow focus:shadow-card"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} star{n !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-4 h-4 ${
                        i < formData.rating ? 'fill-accent' : 'fill-line'
                      }`}
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>

            {/* Review Text */}
            <div>
              <label className="block text-[14px] font-medium text-ink mb-2">
                Your Review
              </label>
              <textarea
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="Tell us what you think..."
                rows={4}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none transition-shadow focus:shadow-card resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false)
                  setFormData({ reviewer: '', rating: 5, text: '' })
                  setFormError('')
                }}
                className="px-4 py-2 border border-line bg-surface rounded-lg text-[14px] font-medium text-ink transition-colors hover:bg-cream"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-accent text-white rounded-lg text-[14px] font-medium transition-[background] duration-150 ease-in-out hover:bg-accent-dark"
              >
                Post Review
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <p className="text-muted text-[14px] py-6">
            No reviews yet. Be the first to review {productName}!
          </p>
        ) : (
          reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))
        )}
      </div>
    </section>
  )
}
