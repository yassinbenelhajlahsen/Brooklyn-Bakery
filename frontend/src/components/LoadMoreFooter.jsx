export default function LoadMoreFooter({ shown, total, hasMore, loading, loadingMore, onLoadMore }) {
  if (loading) return null;
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-sm text-muted">
        Showing {shown} of {total}
      </span>
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="px-3 py-1.5 text-sm rounded-md border border-line text-ink hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
