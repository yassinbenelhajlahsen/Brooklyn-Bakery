export default function ReviewCard({ review, currentUserId, onDelete }) {
  const isOwn = currentUserId && review.userId === currentUserId

  return (
    <article className="bg-cream rounded-lg p-4 border border-line">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-ink">{review.user.displayName ?? 'Anonymous'}</h4>
          <p className="text-[12px] text-muted">
            {new Date(review.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={`w-4 h-4 ${i < review.rating ? 'fill-accent' : 'fill-line'}`}
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ))}
          </div>
          {isOwn && (
            <button
              onClick={onDelete}
              className="text-[12px] text-muted hover:text-danger transition-colors ml-1"
              aria-label="Delete review"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {review.text && <p className="text-[14px] text-ink m-0 leading-relaxed">{review.text}</p>}
    </article>
  )
}
