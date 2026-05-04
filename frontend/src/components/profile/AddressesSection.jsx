import { useState } from 'react';
import { useAddresses } from '../../hooks/useAddresses.js';
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
  const { addresses, loading, error: loadError, create, update, remove } = useAddresses();
  const [actionError, setActionError] = useState(null);
  const [mode, setMode] = useState({ kind: 'idle' });
  const [busyId, setBusyId] = useState(null);

  async function handleCreate(payload) {
    setActionError(null);
    await create(payload);
    setMode({ kind: 'idle' });
  }

  async function handleUpdate(id, payload) {
    setActionError(null);
    await update(id, payload);
    setMode({ kind: 'idle' });
  }

  async function handleDelete(id) {
    setActionError(null);
    setBusyId(id);
    try {
      await remove(id);
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
                        {formatAddress(a).map((line) => (
                          <div key={line}>{line}</div>
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
