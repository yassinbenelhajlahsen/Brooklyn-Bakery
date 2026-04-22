import { useState } from 'react';

const TYPES = ['bread', 'pastry', 'cake', 'cookie', 'drink'];

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-danger text-xs mt-1">{msg}</p>;
}

export default function ProductEditModal({ mode, product, onClose, onCreate, onUpdate }) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [type, setType] = useState(product?.type ?? TYPES[0]);
  const [price, setPrice] = useState(product?.price ?? 0);
  const [stock, setStock] = useState(product?.stock ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);

  const isEdit = mode === 'edit';

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Required';
    if (!description.trim()) e.description = 'Required';
    const urlTrimmed = imageUrl.trim();
    if (!urlTrimmed) {
      e.imageUrl = 'Required';
    } else if (!urlTrimmed.includes('://') && !urlTrimmed.startsWith('/')) {
      e.imageUrl = 'Must be a URL (contains ://) or a path starting with /';
    }
    if (!TYPES.includes(type)) e.type = 'Invalid type';
    const priceNum = Number(price);
    if (!Number.isInteger(priceNum) || priceNum < 0) e.price = 'Must be a non-negative integer';
    const stockNum = Number(stock);
    if (!Number.isInteger(stockNum) || stockNum < 0) e.stock = 'Must be a non-negative integer';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        type,
        price: Number(price),
        stock: Number(stock),
      };
      if (isEdit) await onUpdate(product.id, data);
      else await onCreate(data);
      onClose();
    } catch (err) {
      setServerError(err.message ?? 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase =
    'w-full border border-line rounded-md px-3 py-1.5 text-sm text-ink bg-surface focus:outline-none focus:border-accent transition-colors placeholder:text-muted';
  const labelBase =
    'text-[10px] uppercase tracking-widest text-muted block mb-1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <form
        className="bg-surface rounded-xl shadow-card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display text-ink">
            {isEdit ? 'Edit product' : 'New product'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full hover:bg-line flex items-center justify-center text-muted hover:text-ink transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Server error */}
        {serverError && (
          <div className="mb-4 border border-danger/30 bg-danger/10 text-danger rounded-lg px-4 py-2.5 text-sm">
            {serverError}
          </div>
        )}

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className={labelBase}>Name</label>
            <input
              type="text"
              className={inputBase}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sourdough loaf"
            />
            <FieldError msg={errors.name} />
          </div>

          {/* Description */}
          <div>
            <label className={labelBase}>Description</label>
            <textarea
              className={`${inputBase} min-h-[72px] resize-y`}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short product description"
            />
            <FieldError msg={errors.description} />
          </div>

          {/* Image URL */}
          <div>
            <label className={labelBase}>Image URL</label>
            <input
              type="text"
              className={inputBase}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... or /images/..."
            />
            <FieldError msg={errors.imageUrl} />
          </div>

          {/* Type */}
          <div>
            <label className={labelBase}>Type</label>
            <select
              className={`${inputBase} cursor-pointer`}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
            <FieldError msg={errors.type} />
          </div>

          {/* Price + Stock side-by-side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelBase}>Price (pts)</label>
              <input
                type="number"
                min="0"
                step="1"
                className={inputBase}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <FieldError msg={errors.price} />
            </div>
            <div>
              <label className={labelBase}>Stock</label>
              <input
                type="number"
                min="0"
                step="1"
                className={inputBase}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
              <FieldError msg={errors.stock} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg border border-line hover:bg-cream text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </form>
    </div>
  );
}
