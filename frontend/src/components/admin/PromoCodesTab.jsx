import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminPromoCodes } from '../../hooks/admin/useAdminPromoCodes.js';
import { apiGet } from '../../lib/apiFetch.js';
import { queryKeys } from '../../lib/queryKeys.js';

const PRODUCT_TYPES = [
  { value: 'bread', label: 'Bread' },
  { value: 'pastry', label: 'Pastry' },
  { value: 'cake', label: 'Cake' },
  { value: 'cookie', label: 'Cookie' },
  { value: 'drink', label: 'Drink' },
];

const initialForm = {
  code: '',
  discountPercent: 10,
  scope: 'storewide',
  productType: 'bread',
  productId: '',
};

function scopeLabel(promo) {
  if (promo.scope === 'storewide') return 'Storewide';
  if (promo.scope === 'category') return `Category: ${promo.productType}`;
  if (promo.scope === 'product') return `Product: ${promo.product?.name ?? 'Unknown product'}`;
  return promo.scope;
}

export default function PromoCodesTab() {
  const { items, loading, error, create, update, remove, creating, updating, updatingId, deleting, deletingId } = useAdminPromoCodes();
  const [form, setForm] = useState(initialForm);
  const [localError, setLocalError] = useState(null);

  const productsQuery = useQuery({
    queryKey: queryKeys.products({ search: '' }),
    queryFn: () => apiGet('/products'),
    staleTime: 60_000,
  });
  const products = productsQuery.data?.items ?? [];

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setLocalError(null);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setLocalError(null);
    try {
      await create({
        code: form.code,
        discountPercent: Number(form.discountPercent),
        scope: form.scope,
        productType: form.scope === 'category' ? form.productType : null,
        productId: form.scope === 'product' ? form.productId : null,
      });
      setForm(initialForm);
    } catch (err) {
      setLocalError(err?.message ?? 'Could not create promo code.');
    }
  }

  async function toggleActive(promo) {
    await update(promo.id, { active: !promo.active });
  }

  async function handleDelete(promo) {
    const ok = window.confirm(`Delete promo code ${promo.code}? It has been used on ${promo.orderCount ?? 0} orders. Past orders keep their saved discount details.`);
    if (!ok) return;
    await remove(promo.id);
  }

  return (
    <div className="space-y-4">
      {(error || localError) && (
        <div className="border border-line bg-danger/10 text-danger rounded-lg px-4 py-3 text-sm">
          {localError || error}
        </div>
      )}

      <form onSubmit={handleCreate} className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-[18px] font-display text-ink">Create a new promotion</h2>
            <p className="m-0 mt-1 text-[12.5px] text-muted">
              Percentage discounts will always round down to whole points*
            </p>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? 'Creating...' : '+ Create'}
          </button>
        </div>

        <div className="grid grid-cols-[1fr_8rem_11rem_1fr] gap-3 max-[980px]:grid-cols-2 max-sm:grid-cols-1">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Code
            <input
              value={form.code}
              onChange={(e) => updateForm('code', e.target.value.toUpperCase())}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus:shadow-card"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Percent
            <input
              type="number"
              min="1"
              max="100"
              value={form.discountPercent}
              onChange={(e) => updateForm('discountPercent', e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus:shadow-card"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Applies to
            <select
              value={form.scope}
              onChange={(e) => updateForm('scope', e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus:shadow-card"
            >
              <option value="storewide">Storewide</option>
              <option value="category">Category</option>
              <option value="product">Product</option>
            </select>
          </label>

          {form.scope === 'category' ? (
            <label className="flex flex-col gap-1 text-sm text-muted">
              Category
              <select
                value={form.productType}
                onChange={(e) => updateForm('productType', e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus:shadow-card"
              >
                {PRODUCT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>
          ) : form.scope === 'product' ? (
            <label className="flex flex-col gap-1 text-sm text-muted">
              Product
              <select
                value={form.productId}
                onChange={(e) => updateForm('productId', e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus:shadow-card"
              >
                <option value="">Choose a product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="flex items-end text-sm text-muted">All products</div>
          )}
        </div>
      </form>

      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '13.5rem' }} />
            <col style={{ width: '7rem' }} />
            <col />
            <col style={{ width: '6rem' }} />
            <col style={{ width: '7rem' }} />
            <col style={{ width: '13.5rem' }} />
          </colgroup>
          <thead>
            <tr className="bg-cream/60 border-b border-line">
              {['Code', 'Discount', 'Scope', 'Times used', 'Status', 'Actions'].map((col) => (
                <th key={col} className="px-4 py-2.5 text-left text-[11px] uppercase tracking-widest text-muted font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-line animate-pulse">
                  <td colSpan={6} className="px-4 py-3"><div className="h-5 bg-cream rounded" /></td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No promo codes yet.
                </td>
              </tr>
            ) : (
              items.map((promo, idx) => (
                <tr
                  key={promo.id}
                  className={`border-b border-line last:border-b-0 ${idx % 2 === 1 ? 'bg-cream/30' : 'bg-surface'} ${promo.active ? '' : 'opacity-60'}`}
                >
                  <td className="px-4 py-3 font-mono font-semibold text-ink truncate">{promo.code}</td>
                  <td className="px-4 py-3 text-ink">{promo.discountPercent}%</td>
                  <td className="px-4 py-3 text-muted truncate">{scopeLabel(promo)}</td>
                  <td className="px-4 py-3 text-ink">{promo.orderCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={promo.active ? 'text-accent text-xs uppercase tracking-widest font-medium' : 'text-muted text-xs uppercase tracking-widest'}>
                      {promo.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleActive(promo)}
                        disabled={updating && updatingId === promo.id}
                        className="px-3 py-1 text-xs rounded border border-line hover:bg-cream text-ink transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {promo.active ? 'Expire' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(promo)}
                        disabled={deleting && deletingId === promo.id}
                        className="px-3 py-1 text-xs rounded border border-line hover:border-danger hover:text-danger text-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
