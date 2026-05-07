import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth.js';
import Drawer from '../Drawer.jsx';
import { apiAuthed, apiGet } from '../../lib/apiFetch.js';
import { queryKeys } from '../../lib/queryKeys.js';

const ROW_EXIT_MS = 320;

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
  );
}

function ReviewCard({ review, isExiting, onDelete }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (isExiting && ref.current) {
      ref.current.style.setProperty('--exit-h', `${ref.current.scrollHeight}px`);
    }
  }, [isExiting]);

  return (
    <div
      ref={ref}
      className={clsx(
        'bg-cream rounded-lg p-4 border border-line mb-4 last:mb-0',
        isExiting && 'overflow-hidden pointer-events-none animate-review-row-exit motion-reduce:animate-none'
      )}
    >
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink text-sm truncate">
            {review.user.displayName ?? 'Anonymous'}
          </p>
          <p className="text-[12px] text-muted">
            {new Date(review.createdAt).toLocaleDateString()}
          </p>
        </div>
        <StarRow rating={review.rating} />
      </div>
      <p className="text-[14px] text-ink leading-relaxed">{review.text}</p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={isExiting}
          onClick={() => onDelete(review.id)}
          className="text-xs px-2.5 py-1 rounded border border-danger/40 text-danger hover:bg-danger/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function ProductReviewsDrawer({ product, onClose }) {
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();

  const [exitingIds, setExitingIds] = useState(() => new Set());
  const [deleteError, setDeleteError] = useState(null);
  const timeoutsRef = useRef(new Map());

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((id) => clearTimeout(id));
      timeouts.clear();
    };
  }, []);

  const reviewsQuery = useQuery({
    queryKey: queryKeys.reviewsById(product.id),
    queryFn: () => apiGet(`/products/${product.slug}/reviews`),
    enabled: !!product.slug,
  });

  const deleteMutation = useMutation({
    mutationFn: (reviewId) =>
      apiAuthed(authedFetch, `/admin/reviews/${reviewId}`, { method: 'DELETE' }),
  });

  const handleDelete = (reviewId) => {
    if (timeoutsRef.current.has(reviewId)) return;
    setDeleteError(null);
    setExitingIds((prev) => {
      const next = new Set(prev);
      next.add(reviewId);
      return next;
    });

    deleteMutation.mutate(reviewId, {
      onError: (err) => {
        const t = timeoutsRef.current.get(reviewId);
        if (t) clearTimeout(t);
        timeoutsRef.current.delete(reviewId);
        setExitingIds((prev) => {
          const next = new Set(prev);
          next.delete(reviewId);
          return next;
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.reviewsById(product.id) });
        setDeleteError(err?.message ?? 'Could not delete review.');
      },
    });

    const tid = setTimeout(() => {
      timeoutsRef.current.delete(reviewId);
      queryClient.setQueryData(queryKeys.reviewsById(product.id), (old) =>
        old ? { ...old, reviews: old.reviews.filter((r) => r.id !== reviewId) } : old
      );
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(reviewId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewsBySlug(product.slug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProductsAll() });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
    }, ROW_EXIT_MS);
    timeoutsRef.current.set(reviewId, tid);
  };

  const reviews = reviewsQuery.data?.reviews ?? [];
  const loading = reviewsQuery.isLoading;
  const error = reviewsQuery.isError ? 'Failed to load reviews.' : null;

  const header = (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted mb-0.5">Reviews</p>
      <h2 className="font-display text-xl text-ink capitalize truncate">{product.name}</h2>
    </div>
  );

  return (
    <Drawer
      onClose={onClose}
      ariaLabel={`Reviews for ${product.name}`}
      header={header}
    >
      <div className="overflow-y-auto px-6 py-5">
        {loading ? (
          <p className="text-muted text-sm py-4 text-center">Loading…</p>
        ) : error ? (
          <p className="text-danger text-sm py-4 text-center">{error}</p>
        ) : reviews.length === 0 ? (
          <p className="text-muted text-sm py-4 text-center">No reviews yet.</p>
        ) : (
          reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isExiting={exitingIds.has(review.id)}
              onDelete={handleDelete}
            />
          ))
        )}
        {deleteError && (
          <p className="text-danger text-xs text-right mt-2">{deleteError}</p>
        )}
      </div>
    </Drawer>
  );
}
