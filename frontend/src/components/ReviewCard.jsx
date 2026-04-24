import { useState } from 'react'

function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex items-center gap-0.5">
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
            className={`w-5 h-5 transition-colors ${n <= (hovered || value) ? 'fill-accent' : 'fill-line'}`}
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

export default function ReviewCard({ review, currentUserId, onDelete, onEdit }) {
  const isOwn = currentUserId && review.userId === currentUserId
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ rating: review.rating, text: review.text ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openEdit() {
    setDraft({ rating: review.rating, text: review.text ?? '' })
    setError('')
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await onEdit(review, draft)
      setEditing(false)
    } catch (err) {
      setError(err.message ?? 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="bg-cream rounded-lg p-4 border border-line">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-ink">{review.user.displayName ?? 'Anonymous'}</h4>
          <p className="text-[12px] text-muted">
            {new Date(review.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {!editing && (
            <div className="flex items-center gap-1 mr-1">
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
          )}
          {isOwn && !editing && (
            <>
              <button
                onClick={openEdit}
                className="text-muted hover:text-ink transition-colors p-0.5 rounded"
                aria-label="Edit review"
              >
                <EditIcon />
              </button>
              <button
                onClick={onDelete}
                className="text-muted hover:text-danger transition-colors p-0.5 rounded"
                aria-label="Delete review"
              >
                <TrashIcon />
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <StarPicker value={draft.rating} onChange={(n) => setDraft({ ...draft, rating: n })} />
          <textarea
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            placeholder="Tell us what you think… (optional)"
            rows={3}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none transition-shadow focus:shadow-card resize-none"
          />
          {error && <p className="text-danger text-[13px]">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 border border-line bg-surface rounded-lg text-[13px] font-medium text-ink transition-colors hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-accent text-white rounded-lg text-[13px] font-medium transition-[background] duration-150 hover:bg-accent-dark disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        review.text && <p className="text-[14px] text-ink m-0 leading-relaxed">{review.text}</p>
      )}
    </article>
  )
}
