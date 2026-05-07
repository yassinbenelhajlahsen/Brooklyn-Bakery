import { useQuery } from '@tanstack/react-query';
import Drawer from '../Drawer.jsx';
import { apiGet } from '../../lib/apiFetch.js';
import { queryKeys } from '../../lib/queryKeys.js';

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

export default function ProductReviewsDrawer({ product, onClose }) {
  const reviewsQuery = useQuery({
    queryKey: queryKeys.reviewsById(product.id),
    queryFn: () => apiGet(`/products/${product.slug}/reviews`),
    enabled: !!product.slug,
  });

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
      <div className="overflow-y-auto px-6 py-5 space-y-4">
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
    </Drawer>
  );
}
