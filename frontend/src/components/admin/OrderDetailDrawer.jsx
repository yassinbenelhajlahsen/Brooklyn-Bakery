import { useState } from 'react';
import ReasonPromptModal from '../ReasonPromptModal.jsx';
import StatusBadge from '../StatusBadge.jsx';

const ACTIONS_BY_STATUS = {
  confirmed:        [{ action: 'setProcessing',  label: 'Mark as processing',       needsReason: false },
                     { action: 'forceCancel',    label: 'Cancel order',           needsReason: true  }],
  processing:       [{ action: 'setShipped',     label: 'Mark as shipped',           needsReason: false },
                     { action: 'forceCancel',    label: 'Cancel order',           needsReason: true  }],
  cancel_requested: [{ action: 'approveCancel',  label: 'Approve cancellation',   needsReason: false },
                     { action: 'denyCancel',     label: 'Deny cancellation',      needsReason: true  }],
  shipped:          [{ action: 'setDelivered',   label: 'Mark as delivered',         needsReason: false }],
  return_requested: [{ action: 'approveReturn',  label: 'Approve return',         needsReason: false },
                     { action: 'denyReturn',     label: 'Deny return',            needsReason: true  }],
  cancelled:        [],
  returned:         [],
};

const DESTRUCTIVE_ACTIONS = new Set(['forceCancel', 'forceReturn', 'denyCancel', 'denyReturn']);

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">{children}</p>
  );
}

export default function OrderDetailDrawer({ order, onClose, onTransition }) {
  const [pending, setPending] = useState(null); // { action, label }
  const [submitting, setSubmitting] = useState(false);
  const [transitionError, setTransitionError] = useState(null);

  if (!order) return null;

  const actions = ACTIONS_BY_STATUS[order.status] ?? [];
  const isTerminal = order.status === 'cancelled' || order.status === 'returned';
  const shortId = order.id.slice(-8);

  async function fireAction(action, reason) {
    setSubmitting(true);
    setTransitionError(null);
    try {
      await onTransition(action, reason);
      setPending(null);
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
    } else {
      fireAction(actionDef.action, '');
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className="fixed top-0 right-0 bottom-0 w-120 max-w-full max-sm:w-full bg-surface border-l border-line shadow-[-12px_0_40px_rgba(61,47,36,0.12)] z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-label={`Order #${shortId} details`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-line bg-cream/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-display text-xl [font-variation-settings:'opsz'_24] text-ink">
              #{shortId}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="w-8 h-8 rounded-full hover:bg-line flex items-center justify-center text-muted hover:text-ink transition-colors"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Info grid: Customer / Date / Total */}
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

          {/* Items */}
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

          {/* User's reason (if present) */}
          {order.requestReason && (
            <div>
              <SectionLabel>User&apos;s reason</SectionLabel>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-ink">
                {order.requestReason}
              </div>
            </div>
          )}

          {/* Admin note (if present) */}
          {order.decisionReason && (
            <div>
              <SectionLabel>Admin note</SectionLabel>
              <div className="bg-cream border border-line rounded-lg px-3 py-2.5 text-sm text-ink">
                {order.decisionReason}
              </div>
            </div>
          )}
        </div>

        {/* Sticky action footer */}
        <div className="px-6 py-4 border-t border-line bg-surface shrink-0">
          {isTerminal || actions.length === 0 ? (
            <p className="text-muted text-sm">No actions available.</p>
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

      {/* Reason modal — conditionally rendered only when needed */}
      {pending && (
        <ReasonPromptModal
          open={true}
          title={pending.label}
          placeholder="Enter a reason…"
          required={true}
          submitLabel={pending.label}
          onSubmit={(reason) => fireAction(pending.action, reason)}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}
