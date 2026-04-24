import { useEffect, useState } from 'react';
import { useAddresses } from '../hooks/useAddresses.js';
import AddressForm from './AddressForm.jsx';

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

export default function AddressSelector({ selectedId, onSelect }) {
  const { addresses, loading, error, create, update, remove } = useAddresses();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [rowError, setRowError] = useState(null);
  const [rowBusy, setRowBusy] = useState(false);

  useEffect(() => {
    if (!selectedId && addresses.length > 0) {
      onSelect(addresses[0].id);
    }
    if (selectedId && !addresses.some((a) => a.id === selectedId)) {
      onSelect(addresses[0]?.id ?? null);
    }
  }, [addresses, selectedId, onSelect]);

  if (loading) {
    return <p className="text-muted text-sm">Loading addresses…</p>;
  }

  if (error) {
    return <p className="text-danger text-sm">{error}</p>;
  }

  if (addresses.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted text-sm">Add a shipping address to continue.</p>
        <AddressForm
          submitLabel="Add address"
          onSubmit={async (payload) => {
            const created = await create(payload);
            onSelect(created.id);
          }}
        />
      </div>
    );
  }

  async function handleDelete(id) {
    setRowBusy(true);
    setRowError(null);
    try {
      await remove(id);
      setConfirmingDeleteId(null);
    } catch (err) {
      setRowError(err.message ?? 'Could not delete address');
    } finally {
      setRowBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <ul className="flex flex-col gap-2 list-none p-0 m-0">
        {addresses.map((a) => {
          if (editingId === a.id) {
            return (
              <li key={a.id}>
                <AddressForm
                  initial={a}
                  submitLabel="Save changes"
                  onSubmit={async (payload) => {
                    await update(a.id, payload);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            );
          }
          const isSelected = selectedId === a.id;
          const isConfirming = confirmingDeleteId === a.id;
          return (
            <li key={a.id}>
              <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${isSelected ? 'border-accent bg-cream/60' : 'border-line bg-surface'}`}>
                <label className="flex items-start gap-3 flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="address"
                    value={a.id}
                    checked={isSelected}
                    onChange={() => onSelect(a.id)}
                    className="mt-1 accent-accent"
                  />
                  <div className="text-sm text-ink leading-relaxed">
                    <div className="font-medium">{a.line1}{a.line2 ? `, ${a.line2}` : ''}</div>
                    <div className="text-muted text-xs">{a.city}, {a.state} {a.postalCode} · {a.country}</div>
                  </div>
                </label>
                <div className="flex items-center gap-1 shrink-0">
                  {isConfirming ? (
                    <>
                      <button type="button" disabled={rowBusy} onClick={() => handleDelete(a.id)} className="text-xs px-2 py-1 rounded-md bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50">
                        {rowBusy ? '…' : 'Confirm'}
                      </button>
                      <button type="button" disabled={rowBusy} onClick={() => { setConfirmingDeleteId(null); setRowError(null); }} className="text-xs px-2 py-1 rounded-md text-muted hover:text-ink">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setEditingId(a.id)} aria-label="Edit address" className="w-7 h-7 grid place-items-center rounded-md text-muted hover:text-accent hover:bg-cream transition-colors">
                        <PencilIcon />
                      </button>
                      <button type="button" onClick={() => { setConfirmingDeleteId(a.id); setRowError(null); }} aria-label="Delete address" className="w-7 h-7 grid place-items-center rounded-md text-muted hover:text-danger hover:bg-danger/5 transition-colors">
                        <TrashIcon />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {rowError && <p className="text-danger text-xs">{rowError}</p>}
      <div className="flex justify-end pt-1">
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="text-xs px-2.5 py-1 rounded-md border border-line text-ink hover:bg-cream"
          >
            Add new
          </button>
        )}
      </div>
      {showAddForm && (
        <div className="pt-2">
          <AddressForm
            submitLabel="Add address"
            onSubmit={async (payload) => {
              const created = await create(payload);
              onSelect(created.id);
              setShowAddForm(false);
            }}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}
    </div>
  );
}
