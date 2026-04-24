import { useState } from 'react';

const INPUT_CLS =
  'w-full border border-line rounded-md px-3 py-2 text-sm bg-surface text-ink focus:outline-none focus:border-accent disabled:opacity-50';
const LABEL_CLS = 'text-[11px] uppercase tracking-wider text-muted mb-1 block';

const EMPTY = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

export default function AddressForm({ initial, submitLabel = 'Save', onSubmit, onCancel }) {
  const [values, setValues] = useState(() => {
    const seed = { ...EMPTY };
    if (initial) {
      for (const key of Object.keys(EMPTY)) {
        if (initial[key] != null) seed[key] = initial[key];
      }
    }
    return seed;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function setField(field, v) {
    setValues((prev) => ({ ...prev, [field]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        line1: values.line1.trim(),
        line2: values.line2.trim() || null,
        city: values.city.trim(),
        state: values.state.trim(),
        postalCode: values.postalCode.trim(),
        country: values.country.trim(),
      };
      for (const required of ['line1', 'city', 'state', 'postalCode', 'country']) {
        if (!payload[required]) {
          setError(`${required} is required`);
          setSubmitting(false);
          return;
        }
      }
      await onSubmit(payload);
    } catch (err) {
      setError(err.message ?? 'Could not save address');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 bg-cream/40 border border-line rounded-xl p-4">
      <div className="col-span-2">
        <label className={LABEL_CLS}>Address line 1</label>
        <input className={INPUT_CLS} value={values.line1} onChange={(e) => setField('line1', e.target.value)} disabled={submitting} />
      </div>
      <div className="col-span-2">
        <label className={LABEL_CLS}>Address line 2 (optional)</label>
        <input className={INPUT_CLS} value={values.line2} onChange={(e) => setField('line2', e.target.value)} disabled={submitting} />
      </div>
      <div>
        <label className={LABEL_CLS}>City</label>
        <input className={INPUT_CLS} value={values.city} onChange={(e) => setField('city', e.target.value)} disabled={submitting} />
      </div>
      <div>
        <label className={LABEL_CLS}>State / region</label>
        <input className={INPUT_CLS} value={values.state} onChange={(e) => setField('state', e.target.value)} disabled={submitting} />
      </div>
      <div>
        <label className={LABEL_CLS}>Postal code</label>
        <input className={INPUT_CLS} value={values.postalCode} onChange={(e) => setField('postalCode', e.target.value)} disabled={submitting} />
      </div>
      <div>
        <label className={LABEL_CLS}>Country</label>
        <input className={INPUT_CLS} value={values.country} onChange={(e) => setField('country', e.target.value)} disabled={submitting} />
      </div>
      {error && <p className="col-span-2 text-danger text-sm">{error}</p>}
      <div className="col-span-2 flex justify-end gap-2 mt-1">
        {onCancel && (
          <button type="button" disabled={submitting} onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-line text-ink hover:bg-cream disabled:opacity-50 transition-colors">
            Cancel
          </button>
        )}
        <button type="submit" disabled={submitting} className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 font-medium transition-colors">
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
