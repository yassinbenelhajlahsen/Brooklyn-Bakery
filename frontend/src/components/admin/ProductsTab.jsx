import { useState } from 'react';
import { useAdminProducts } from '../../hooks/admin/useAdminProducts.js';
import ProductEditModal from './ProductEditModal.jsx';
import ProductReviewsDrawer from './ProductReviewsDrawer.jsx';
import LoadMoreFooter from '../LoadMoreFooter.jsx';

const COLUMNS = ['', 'Name', 'Type', 'Price', 'Stock', 'Rating', 'Status', 'Actions'];

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest' },
  { value: 'popularity', label: 'Popularity (most reviews)' },
];

function StarDisplay({ avgRating, reviewCount }) {
  if (!reviewCount) return <span className="text-muted text-xs">—</span>;
  return (
    <span className="text-sm text-ink">
      ★ {Number(avgRating).toFixed(1)} ({reviewCount})
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-line animate-pulse">
      <td className="px-4 py-3"><div className="w-6 h-6 bg-cream rounded-md" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-36" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-10" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-cream rounded-full w-16" /></td>
      <td className="px-4 py-3"><div className="h-8 bg-cream rounded w-36" /></td>
    </tr>
  );
}

export default function ProductsTab() {
  const {
    items, total, hasMore,
    includeArchived, setIncludeArchived,
    sort, setSort,
    loading, loadingMore, error,
    loadMore,
    create, update, archive, unarchive,
  } = useAdminProducts();

  const [editing, setEditing] = useState(null);
  const [mutating, setMutating] = useState(null);
  const [reviewProduct, setReviewProduct] = useState(null);

  async function handleArchiveToggle(product) {
    if (mutating) return;
    setMutating(product.id);
    try {
      if (product.archivedAt) {
        await unarchive(product.id);
      } else {
        await archive(product.id);
      }
    } finally {
      setMutating(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded border-line accent-accent"
          />
          Include archived
        </label>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[14px] text-ink outline-none transition-shadow focus:shadow-card"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <button
            onClick={() => setEditing({ mode: 'create' })}
            className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark transition-colors font-medium"
          >
            + New product
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border border-line bg-danger/10 text-danger rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '3.5rem' }} />
            <col />
            <col style={{ width: '6rem'  }} />
            <col style={{ width: '5rem'  }} />
            <col style={{ width: '5rem'  }} />
            <col style={{ width: '7rem'  }} />
            <col style={{ width: '6rem'  }} />
            <col style={{ width: '15rem' }} />
          </colgroup>
          <thead>
            <tr className="bg-cream/60 border-b border-line">
              {COLUMNS.map((col, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 text-left text-[11px] uppercase tracking-widest text-muted font-medium"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  No products.
                </td>
              </tr>
            ) : (
              items.map((product, idx) => (
                <tr
                  key={product.id}
                  className={`border-b border-line last:border-b-0 transition-colors duration-100 ${
                    idx % 2 === 1 ? 'bg-cream/30' : 'bg-surface'
                  } ${product.archivedAt ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-6 h-6 rounded-md object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-md bg-line" />
                    )}
                  </td>

                  <td className="px-4 py-3 font-medium text-ink truncate">{product.name}</td>

                  <td className="px-4 py-3 text-muted capitalize">{product.type}</td>

                  <td className="px-4 py-3 text-ink font-mono">{product.price} pts</td>

                  <td className="px-4 py-3 text-ink font-mono">{product.stock}</td>

                  <td className="px-4 py-3">
                    <StarDisplay avgRating={product.avgRating} reviewCount={product.reviewCount} />
                  </td>

                  <td className="px-4 py-3">
                    {product.archivedAt ? (
                      <span className="text-muted text-xs uppercase tracking-widest">
                        Archived
                      </span>
                    ) : (
                      <span className="text-accent text-xs uppercase tracking-widest font-medium">
                        Active
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReviewProduct(product)}
                        className="px-3 py-1 text-xs rounded border border-line hover:bg-cream text-ink transition-colors"
                      >
                        Reviews
                      </button>
                      <button
                        onClick={() => setEditing({ mode: 'edit', product })}
                        className="px-3 py-1 text-xs rounded border border-line hover:bg-cream text-ink transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleArchiveToggle(product)}
                        disabled={mutating === product.id}
                        className={`px-3 py-1 text-xs rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          product.archivedAt
                            ? 'border-accent/40 text-accent hover:bg-accent/5'
                            : 'border-line text-muted hover:bg-cream'
                        }`}
                      >
                        {mutating === product.id
                          ? '…'
                          : product.archivedAt
                          ? 'Unarchive'
                          : 'Archive'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LoadMoreFooter
        shown={items.length}
        total={total}
        hasMore={hasMore}
        loading={loading}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
      />

      {editing && (
        <ProductEditModal
          mode={editing.mode}
          product={editing.product}
          onClose={() => setEditing(null)}
          onCreate={create}
          onUpdate={update}
        />
      )}

      {reviewProduct && (
        <ProductReviewsDrawer
          product={reviewProduct}
          onClose={() => setReviewProduct(null)}
        />
      )}
    </div>
  );
}
