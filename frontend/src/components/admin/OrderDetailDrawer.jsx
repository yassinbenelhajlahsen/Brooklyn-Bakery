import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import StatusBadge from '../StatusBadge.jsx';

const ACTIONS_BY_STATUS = {
  confirmed:        [{ action: 'setProcessing',  label: 'Mark as processing',     needsReason: false },
                     { action: 'forceCancel',    label: 'Cancel order',           needsReason: true  }],
  processing:       [{ action: 'setShipped',     label: 'Mark as shipped',        needsReason: false },
                     { action: 'forceCancel',    label: 'Cancel order',           needsReason: true  }],
  cancel_requested: [{ action: 'approveCancel',  label: 'Approve cancellation',   needsReason: false },
                     { action: 'denyCancel',     label: 'Deny cancellation',      needsReason: true  }],
  shipped:          [{ action: 'setDelivered',   label: 'Mark as delivered',      needsReason: false }],
  return_requested: [{ action: 'approveReturn',  label: 'Approve return',         needsReason: false },
                     { action: 'denyReturn',     label: 'Deny return',            needsReason: true  }],
  cancelled:        [],
  returned:         [],
};

const DESTRUCTIVE_ACTIONS = new Set(['forceCancel', 'forceReturn', 'denyCancel', 'denyReturn']);
const ANIM_MS = 250;

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">{children}</p>
  );
}

export default function OrderDetailDrawer({ order, onClose, onTransition }) {
  const [pending, setPending] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [transitionError, setTransitionError] = useState(null);

  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);

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

  if (!order) return null;

  const actions = ACTIONS_BY_STATUS[order.status] ?? [];
  const isTerminal = order.status === 'cancelled' || order.status === 'returned';
  const shortId = order.id.slice(-8);
  const visible = entered && !leaving;

  async function fireAction(action, reason) {
    setSubmitting(true);
    setTransitionError(null);
    try {
      await onTransition(action, reason);
      setPending(null);
      setReasonText('');
      setReasonError(null);
    } catch (err) {
      setTransitionError(err.message ?? 'Action failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleActionClick(actionDef) {
    if (submitting) return;
    if (actionDef.needsReason) {
      setPending(actionDef);
      setReasonText('');
      setReasonError(null);
      setTransitionError(null);
    } else {
      fireAction(actionDef.action, '');
    }
  }

  function cancelPending() {
    if (submitting) return;
    setPending(null);
    setReasonText('');
    setReasonError(null);
  }

  function confirmPending() {
    const trimmed = reasonText.trim();
    if (!trimmed) {
      setReasonError('A reason is required.');
      return;
    }
    fireAction(pending.action, trimmed);
  }

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
        aria-label={`Order #${shortId} details`}
      >
        <div className="px-6 py-4 border-b border-line bg-cream/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-display text-xl [font-variation-settings:'opsz'_24] text-ink">
              #{shortId}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <button
            onClick={closeWithAnim}
            aria-label="Close drawer"
            className="w-8 h-8 rounded-full hover:bg-line flex items-center justify-center text-muted hover:text-ink transition-colors"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-cream/50 rounded-lg px-3 py-2.5">
              <SectionLabel>Customer</SectionLabel>
              <p className="text-sm font-medium text-ink">
                {order.user?.displayName || '—'}
              </p>
            </div>
            <div className="bg-cream/50 rounded-lg px-3 py-2.5">
              <SectionLabel>Date</SectionLabel>
              <p className="text-sm font-medium text-ink">
                {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="bg-cream/50 rounded-lg px-3 py-2.5">
              <SectionLabel>Total</SectionLabel>
              <p className="text-sm font-semibold text-ink">{order.total} pts</p>
            </div>
            {order.deliveredAt && (
              <div className="bg-cream/50 rounded-lg px-3 py-2.5">
                <SectionLabel>Delivered</SectionLabel>
                <p className="text-sm font-medium text-ink">
                  {new Date(order.deliveredAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Items ({order.items.length})</SectionLabel>
            <ul className="space-y-2">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 bg-cream/40 rounded-lg px-3 py-2.5"
                >
                  {item.product?.imageUrl ? (
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-10 h-10 rounded-md object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-line shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {item.product?.name ?? '—'}
                    </p>
                    <p className="text-xs text-muted">
                      {item.quantity} × {item.unitPrice} pts
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionLabel>Shipping address</SectionLabel>
            {order.shippingLine1 ? (
              <div className="bg-cream/50 border border-line rounded-lg px-3 py-2.5 text-sm text-ink leading-relaxed">
                <div>{order.shippingLine1}</div>
                {order.shippingLine2 && <div>{order.shippingLine2}</div>}
                <div>{order.shippingCity}, {order.shippingState} {order.shippingPostalCode}</div>
                <div>{order.shippingCountry}</div>
              </div>
            ) : (
              <p className="text-muted text-sm">No address on file</p>
            )}
          </div>

          {order.requestReason && (
            <div>
              <SectionLabel>User&apos;s reason</SectionLabel>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-ink">
                {order.requestReason}
              </div>
            </div>
          )}

          {order.decisionReason && (
            <div>
              <SectionLabel>Admin note</SectionLabel>
              <div className="bg-cream border border-line rounded-lg px-3 py-2.5 text-sm text-ink">
                {order.decisionReason}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line bg-surface shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          {isTerminal || actions.length === 0 ? (
            <p className="text-muted text-sm">No actions available.</p>
          ) : pending ? (
            <div className="space-y-2">
              <SectionLabel>Reason for {pending.label.toLowerCase()}</SectionLabel>
              <textarea
                autoFocus
                value={reasonText}
                onChange={(e) => { setReasonText(e.target.value); setReasonError(null); }}
                placeholder="Enter a reason…"
                disabled={submitting}
                className="w-full border border-line rounded-md p-2 text-sm min-h-20 focus:outline-none focus:border-accent disabled:opacity-50"
              />
              {reasonError && <p className="text-danger text-xs">{reasonError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelPending}
                  disabled={submitting}
                  className="px-3 py-1.5 text-sm rounded-lg border border-line text-ink hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPending}
                  disabled={submitting}
                  className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {submitting ? 'Saving…' : `Confirm ${pending.label.toLowerCase()}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {actions.map((actionDef) => {
                const isDestructive = DESTRUCTIVE_ACTIONS.has(actionDef.action);
                return (
                  <button
                    key={actionDef.action}
                    onClick={() => handleActionClick(actionDef)}
                    disabled={submitting}
                    className={
                      isDestructive
                        ? 'border border-danger/40 text-danger rounded-lg px-4 py-2 text-sm font-medium hover:bg-danger/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                        : 'bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                    }
                  >
                    {actionDef.label}
                  </button>
                );
              })}
            </div>
          )}
          {transitionError && (
            <p className="text-danger text-sm mt-2">{transitionError}</p>
          )}
        </div>
      </aside>
    </>,
    document.body
  );
}
