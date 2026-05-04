import StatusBadge from '../StatusBadge.jsx'
import AddressSelector from '../AddressSelector.jsx'

const RETURN_WINDOW_MS = 48 * 60 * 60 * 1000

function canReturn(order) {
  if (order.status !== 'delivered' || !order.deliveredAt) return false
  return Date.now() - new Date(order.deliveredAt).getTime() <= RETURN_WINDOW_MS
}

export default function OrderCard({
  order,
  editingAddressOrderId,
  pendingAddressId,
  addressSaving,
  addressError,
  onPendingAddressChange,
  onStartEditAddress,
  onCancelEditAddress,
  onSaveAddress,
  onCancel,
  onReturn,
  onReorder,
  reorderDisabledReason,
  skippedCount,
}) {
  const isEditingAddress = editingAddressOrderId === order.id

  return (
    <article className="bg-surface border border-line rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3 max-sm:flex-col">
        <div>
          <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-muted">Order</p>
          <h3 className="mt-1 mb-0.5 text-base font-semibold text-ink">#{order.id.slice(-8)}</h3>
          <p className="m-0 text-xs text-muted">
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right max-sm:text-left">
          <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-muted">Total</p>
          <p className="mt-1 mb-0.5 text-base font-semibold text-accent-dark">{order.total} pts</p>
          <div className="mt-1"><StatusBadge status={order.status} /></div>
        </div>
      </div>

      <ul className="mt-3 grid gap-2 list-none p-0 m-0">
        {order.items.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-3 rounded-lg border border-line bg-cream/30 p-2 max-sm:items-start"
          >
            <img
              src={entry.product.imageUrl}
              alt={entry.product.name}
              className="h-10 w-10 rounded-md object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm text-ink truncate">{entry.product.name}</p>
              <p className="mt-0.5 mb-0 text-xs text-muted">
                Qty {entry.quantity} · {entry.unitPrice} pts ea
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <p className="m-0 mb-1.5 text-[11px] uppercase tracking-[0.18em] text-muted">Ship to</p>
        {isEditingAddress ? (
          <div className="space-y-2">
            <AddressSelector
              selectedId={pendingAddressId}
              onSelect={onPendingAddressChange}
            />
            {addressError && (
              <p className="text-danger text-xs m-0">{addressError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={addressSaving}
                onClick={() => onSaveAddress(order.id)}
                className="text-sm px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-dark disabled:opacity-50 transition-colors"
              >
                {addressSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                disabled={addressSaving}
                onClick={onCancelEditAddress}
                className="text-sm px-3 py-1.5 rounded border border-line text-ink hover:bg-cream disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            {order.shippingLine1 ? (
              <div className="text-xs text-ink leading-snug">
                <div>{order.shippingLine1}</div>
                {order.shippingLine2 && <div>{order.shippingLine2}</div>}
                <div>{order.shippingCity}, {order.shippingState} {order.shippingPostalCode}</div>
                <div>{order.shippingCountry}</div>
              </div>
            ) : (
              <p className="m-0 text-xs text-muted">No address on file</p>
            )}
            {order.status === 'confirmed' && (
              <button
                type="button"
                onClick={() => onStartEditAddress(order)}
                className="text-xs px-2.5 py-1 rounded border border-line text-ink hover:bg-cream transition-colors shrink-0"
              >
                Change
              </button>
            )}
          </div>
        )}
      </div>

      {(order.requestReason || order.decisionReason) && (
        <div className="mt-3 space-y-1 text-xs">
          {order.requestReason && (
            <div className="text-muted"><span className="text-ink">Your reason:</span> {order.requestReason}</div>
          )}
          {order.decisionReason && (
            <div className="text-muted"><span className="text-ink">Reason:</span> {order.decisionReason}</div>
          )}
        </div>
      )}

      {skippedCount > 0 && (
        <p className="mt-3 text-xs text-danger m-0">
          {skippedCount === 1
            ? "1 item couldn't be added — it's no longer available."
            : `${skippedCount} items couldn't be added — they're no longer available.`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {order.status === 'confirmed' && (
          <button
            type="button"
            onClick={() => onCancel(order)}
            className="text-xs px-2.5 py-1 rounded border border-line text-ink hover:bg-cream transition-colors"
          >
            Cancel order
          </button>
        )}
        {order.status === 'processing' && !order.decisionReason && (
          <button
            type="button"
            onClick={() => onCancel(order)}
            className="text-xs px-2.5 py-1 rounded border border-line text-ink hover:bg-cream transition-colors"
          >
            Request cancellation
          </button>
        )}
        {order.status === 'delivered' && !order.decisionReason && (
          <button
            type="button"
            disabled={!canReturn(order)}
            title={!canReturn(order) ? 'Return period expired' : undefined}
            onClick={() => onReturn(order)}
            className="text-xs px-2.5 py-1 rounded border border-line text-ink hover:bg-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            Request return
          </button>
        )}
        <button
          type="button"
          disabled={Boolean(reorderDisabledReason)}
          title={reorderDisabledReason ?? undefined}
          onClick={() => onReorder(order)}
          className="text-xs px-2.5 py-1 rounded border border-line text-ink hover:bg-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          Reorder
        </button>
      </div>
    </article>
  )
}
