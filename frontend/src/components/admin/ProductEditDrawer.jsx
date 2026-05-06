import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const TYPES = ['bread', 'pastry', 'cake', 'cookie', 'drink'];
const ANIM_MS = 250;

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-danger text-xs mt-1">{msg}</p>;
}

export default function ProductEditDrawer({ mode, product, onClose, onCreate, onUpdate }) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [type, setType] = useState(product?.type ?? TYPES[0]);
  const [price, setPrice] = useState(product?.price ?? 0);
  const [stock, setStock] = useState(product?.stock ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);

  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const isEdit = mode === 'edit';

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const closeWithAnim = useCallback(() => {
    setLeaving(true);
    setTimeout(onClose, ANIM_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeWithAnim(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeWithAnim]);

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
      closeWithAnim();
    } catch (err) {
      setServerError(err.message ?? 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const visible = entered && !leaving;

  const inputBase =
    'w-full border border-line rounded-md px-3 py-1.5 text-sm text-ink bg-surface focus:outline-none focus:border-accent transition-colors placeholder:text-muted';
  const labelBase =
    'text-[10px] uppercase tracking-widest text-muted block mb-1';

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-250 ease-out ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={closeWithAnim}
        aria-hidden="true"
      />

      <aside
        className={`fixed top-0 right-0 bottom-0 w-120 max-w-full max-sm:w-full bg-surface border-l border-line shadow-[-12px_0_40px_rgba(61,47,36,0.12)] z-50 grid grid-rows-[auto_1fr_auto] overflow-hidden transition-transform duration-250 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-label={isEdit ? 'Edit product' : 'New product'}
      >
        <div className="px-6 py-4 border-b border-line bg-cream/40 flex items-center justify-between shrink-0">
          <span className="font-display text-xl [font-variation-settings:'opsz'_24] text-ink">
            {isEdit ? 'Edit product' : 'New product'}
          </span>
          <button
            type="button"
            onClick={closeWithAnim}
            aria-label="Close drawer"
            className="w-8 h-8 rounded-full hover:bg-line flex items-center justify-center text-muted hover:text-ink transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form
          id="product-edit-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto px-6 py-5 space-y-4"
        >
          {serverError && (
            <div className="border border-danger/30 bg-danger/10 text-danger rounded-lg px-4 py-2.5 text-sm">
              {serverError}
            </div>
          )}

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

          <div>
            <label className={labelBase}>Image URL</label>
            <input
              type="text"
              className={inputBase}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
            <FieldError msg={errors.imageUrl} />
          </div>

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
        </form>

        <div className="px-6 py-4 border-t border-line bg-surface shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] flex justify-end gap-2">
          <button
            type="button"
            onClick={closeWithAnim}
            className="px-3 py-1.5 text-sm rounded-lg border border-line hover:bg-cream text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="product-edit-form"
            disabled={submitting}
            className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </aside>
    </>,
    document.body
  );
}
