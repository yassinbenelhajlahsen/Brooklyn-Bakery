import { useState } from 'react';
import { useAdminProducts } from '../../hooks/admin/useAdminProducts.js';
import ProductEditModal from './ProductEditModal.jsx';

const COLUMNS = ['', 'Name', 'Type', 'Price', 'Stock', 'Status', 'Actions'];

function SkeletonRow() {
  return (
    <tr className="border-b border-line animate-pulse">
      <td className="px-4 py-3"><div className="w-6 h-6 bg-cream rounded-md" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-36" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-10" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-cream rounded-full w-16" /></td>
      <td className="px-4 py-3"><div className="h-8 bg-cream rounded w-28" /></td>
    </tr>
  );
}

export default function ProductsTab() {
  const {
    products,
    includeArchived,
    setIncludeArchived,
    loading,
    error,
    create,
    update,
    archive,
    unarchive,
  } = useAdminProducts();

  const [editing, setEditing] = useState(null); // { mode: 'create' | 'edit', product? }
  const [mutating, setMutating] = useState(null); // product id being archived/unarchived

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
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded border-line accent-accent"
          />
          Include archived
        </label>

        <button
          onClick={() => setEditing({ mode: 'create' })}
          className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark transition-colors font-medium"
        >
          + New product
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border border-line bg-danger/10 text-danger rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
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
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No products.
                </td>
              </tr>
            ) : (
              products.map((product, idx) => (
                <tr
                  key={product.id}
                  className={`border-b border-line last:border-b-0 transition-colors duration-100 ${
                    idx % 2 === 1 ? 'bg-cream/30' : 'bg-surface'
                  } ${product.archivedAt ? 'opacity-60' : ''}`}
                >
                  {/* Thumbnail */}
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

                  {/* Name */}
                  <td className="px-4 py-3 font-medium text-ink">{product.name}</td>

                  {/* Type */}
                  <td className="px-4 py-3 text-muted capitalize">{product.type}</td>

                  {/* Price */}
                  <td className="px-4 py-3 text-ink font-mono">{product.price} pts</td>

                  {/* Stock */}
                  <td className="px-4 py-3 text-ink font-mono">{product.stock}</td>

                  {/* Status */}
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

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
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

      {/* Modal — conditionally rendered so state resets between opens */}
      {editing && (
        <ProductEditModal
          mode={editing.mode}
          product={editing.product}
          onClose={() => setEditing(null)}
          onCreate={create}
          onUpdate={update}
        />
      )}
    </div>
  );
}
