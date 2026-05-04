import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import {
  fetchAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../../services/addressesService.js';
import AddressForm from '../AddressForm.jsx';

const SECTION_CLS = 'bg-surface border border-line rounded-xl p-6';
const PRIMARY_BTN =
  'px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 font-medium transition-colors';
const SECONDARY_BTN =
  'px-3 py-1.5 text-sm rounded-lg border border-line text-ink hover:bg-cream disabled:opacity-50 transition-colors';
const DANGER_BTN =
  'px-3 py-1.5 text-sm rounded-lg border border-line text-danger hover:bg-danger/5 disabled:opacity-50 transition-colors';

function formatAddress(a) {
  const parts = [a.line1];
  if (a.line2) parts.push(a.line2);
  parts.push(`${a.city}, ${a.state} ${a.postalCode}`);
  parts.push(a.country);
  return parts;
}

export default function AddressesSection() {
  const { authedFetch } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [mode, setMode] = useState({ kind: 'idle' });
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchAddresses(authedFetch);
        if (!cancelled) setAddresses(data ?? []);
      } catch (err) {
        if (!cancelled) setLoadError(err?.message ?? 'Could not load addresses.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authedFetch]);

  async function handleCreate(payload) {
    setActionError(null);
    const created = await createAddress(authedFetch, payload);
    setAddresses((prev) => [...prev, created]);
    setMode({ kind: 'idle' });
  }

  async function handleUpdate(id, payload) {
    setActionError(null);
    const updated = await updateAddress(authedFetch, id, payload);
    setAddresses((prev) => prev.map((a) => (a.id === id ? updated : a)));
    setMode({ kind: 'idle' });
  }

  async function handleDelete(id) {
    setActionError(null);
    setBusyId(id);
    try {
      await deleteAddress(authedFetch, id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setActionError(err?.message ?? 'Could not delete address.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={SECTION_CLS} aria-labelledby="addresses-heading">
      <div className="flex items-center justify-between mb-4">
        <h3 id="addresses-heading" className="font-display text-[22px] text-ink">
          Saved addresses
        </h3>
        {mode.kind === 'idle' && !loading && !loadError && (
          <button type="button" className={PRIMARY_BTN} onClick={() => setMode({ kind: 'create' })}>
            Add address
          </button>
        )}
      </div>

      {loading && <p className="text-muted text-sm">Loading…</p>}
      {loadError && <p className="text-danger text-sm">{loadError}</p>}
      {actionError && <p className="text-danger text-sm mb-3">{actionError}</p>}

      {!loading && !loadError && (
        <>
          {mode.kind === 'create' && (
            <div className="mb-4">
              <AddressForm
                submitLabel="Save"
                onSubmit={handleCreate}
                onCancel={() => setMode({ kind: 'idle' })}
              />
            </div>
          )}

          {addresses.length === 0 && mode.kind !== 'create' ? (
            <p className="text-muted text-sm">No saved addresses yet.</p>
          ) : (
            <ul className="grid gap-3">
              {addresses.map((a) => (
                <li key={a.id} className="border border-line rounded-lg p-4 bg-cream/30">
                  {mode.kind === 'edit' && mode.id === a.id ? (
                    <AddressForm
                      initial={a}
                      submitLabel="Save"
                      onSubmit={(payload) => handleUpdate(a.id, payload)}
                      onCancel={() => setMode({ kind: 'idle' })}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm text-ink leading-snug">
                        {formatAddress(a).map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          className={SECONDARY_BTN}
                          onClick={() => setMode({ kind: 'edit', id: a.id })}
                          disabled={busyId === a.id}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={DANGER_BTN}
                          onClick={() => handleDelete(a.id)}
                          disabled={busyId === a.id}
                        >
                          {busyId === a.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
