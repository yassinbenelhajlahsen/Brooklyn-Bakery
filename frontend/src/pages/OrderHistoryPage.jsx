import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import Ornament from '../components/Ornament.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ReasonPromptModal from '../components/ReasonPromptModal.jsx'
import { fetchMyOrders, userCancelOrder, userReturnOrder, updateOrderAddress } from '../services/orderService.js'
import AddressSelector from '../components/AddressSelector.jsx'

const BACK_BTN = clsx(
  "bg-transparent text-muted border border-line rounded-lg p-3",
  "font-sans font-medium text-[12px] leading-[1] tracking-[0.1em] uppercase",
  "[transition:color_180ms_ease,border-color_180ms_ease]",
  "hover:text-accent hover:border-accent",
  "motion-reduce:transition-none",
)

const RETURN_WINDOW_MS = 48 * 60 * 60 * 1000;

function canReturn(order) {
  if (order.status !== 'delivered' || !order.deliveredAt) return false;
  return Date.now() - new Date(order.deliveredAt).getTime() <= RETURN_WINDOW_MS;
}

function OrderHeader() {
  return (
    <header className="text-center mb-10">
      <h2 className="font-display font-normal text-[42px] leading-[1.1] tracking-[-0.015em] text-ink m-0 [font-variation-settings:'opsz'_48] max-[880px]:text-[32px]">
        Order history
      </h2>
      <Ornament className="mt-5" />
    </header>
  )
}

export default function OrderHistoryPage() {
  const { user, authedFetch } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [editingAddressOrderId, setEditingAddressOrderId] = useState(null)
  const [pendingAddressId, setPendingAddressId] = useState(null)
  const [addressSaving, setAddressSaving] = useState(false)
  const [addressError, setAddressError] = useState(null)

  async function refresh() {
    const data = await fetchMyOrders(authedFetch)
    setOrders(data.orders ?? [])
  }

  useEffect(() => {
    let cancelled = false

    async function loadOrders() {
      if (!user) return

      setLoading(true)
      setError(null)
      try {
        const data = await fetchMyOrders(authedFetch)
        if (!cancelled) setOrders(data.orders ?? [])
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load order history', err)
          setError(err?.message ?? 'Could not load your order history.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadOrders()
    return () => { cancelled = true }
  }, [user, authedFetch])

  async function handleCancel(order) {
    if (order.status === 'confirmed') {
      try {
        await userCancelOrder(authedFetch, order.id, '')
        await refresh()
      } catch (err) {
        setError(err?.message ?? 'Cancel failed')
      }
    } else {
      setModal({ kind: 'cancel', orderId: order.id })
    }
  }

  function handleReturn(order) {
    setModal({ kind: 'return', orderId: order.id })
  }

  async function submitReason(reason) {
    if (!modal) return
    const { kind, orderId } = modal
    setModal(null)
    try {
      if (kind === 'cancel') {
        await userCancelOrder(authedFetch, orderId, reason)
      } else {
        await userReturnOrder(authedFetch, orderId, reason)
      }
      await refresh()
    } catch (err) {
      setError(err?.message ?? 'Request failed')
    }
  }

  function startEditingAddress(order) {
    setEditingAddressOrderId(order.id)
    setPendingAddressId(null)
    setAddressError(null)
  }

  function cancelEditingAddress() {
    setEditingAddressOrderId(null)
    setPendingAddressId(null)
    setAddressError(null)
  }

  async function saveAddress(orderId) {
    if (!pendingAddressId) {
      setAddressError('Pick an address first.')
      return
    }
    setAddressSaving(true)
    setAddressError(null)
    try {
      const updated = await updateOrderAddress(authedFetch, orderId, pendingAddressId)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)))
      setEditingAddressOrderId(null)
      setPendingAddressId(null)
    } catch (err) {
      setAddressError(err?.message ?? 'Could not update address.')
    } finally {
      setAddressSaving(false)
    }
  }

  if (!user) return <Navigate to="/" replace />

  return (
    <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
      <div className="w-full animate-checkout-rise motion-reduce:animate-none">
        <OrderHeader />

        <div className="mb-6 flex justify-start">
          <button className={BACK_BTN} onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>

        {loading ? (
          <div className="bg-surface border border-line rounded-xl px-8 py-12 text-center text-muted">
            Loading order history...
          </div>
        ) : error ? (
          <div className="bg-surface border border-line rounded-xl px-8 py-12 text-center text-danger">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl px-8 py-12 text-center text-muted">
            You have not placed any orders yet.
          </div>
        ) : (
          <div className="grid gap-5">
            {orders.map((order) => (
              <article key={order.id} className="bg-surface border border-line rounded-xl p-6">
                <div className="flex items-start justify-between gap-4 border-b border-line pb-4 max-sm:flex-col">
                  <div>
                    <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-muted">Order</p>
                    <h3 className="mt-2 mb-1 text-xl text-ink">#{order.id.slice(-8)}</h3>
                    <p className="m-0 text-sm text-muted">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right max-sm:text-left">
                    <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-muted">Total</p>
                    <p className="mt-2 mb-1 text-lg font-semibold text-accent-dark">{order.total} pts</p>
                    <div className="mt-1"><StatusBadge status={order.status} /></div>
                  </div>
                </div>

                <ul className="mt-4 grid gap-3 list-none p-0 m-0">
                  {order.items.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-4 rounded-xl border border-line bg-cream/30 p-3 max-sm:items-start"
                    >
                      <img
                        src={entry.product.imageUrl}
                        alt={entry.product.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-base text-ink">{entry.product.name}</p>
                        <p className="mt-1 mb-0 text-sm text-muted">
                          Qty {entry.quantity} at {entry.unitPrice} pts each
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4">
                  <p className="m-0 mb-2 text-[11px] uppercase tracking-[0.18em] text-muted">Ship to</p>
                  {editingAddressOrderId === order.id ? (
                    <div className="space-y-2">
                      <AddressSelector
                        selectedId={pendingAddressId}
                        onSelect={setPendingAddressId}
                      />
                      {addressError && (
                        <p className="text-danger text-xs m-0">{addressError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={addressSaving}
                          onClick={() => saveAddress(order.id)}
                          className="text-sm px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-dark disabled:opacity-50 transition-colors"
                        >
                          {addressSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          disabled={addressSaving}
                          onClick={cancelEditingAddress}
                          className="text-sm px-3 py-1.5 rounded border border-line text-ink hover:bg-cream disabled:opacity-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      {order.shippingLine1 ? (
                        <div className="text-sm text-ink leading-relaxed">
                          <div>{order.shippingLine1}</div>
                          {order.shippingLine2 && <div>{order.shippingLine2}</div>}
                          <div>{order.shippingCity}, {order.shippingState} {order.shippingPostalCode}</div>
                          <div>{order.shippingCountry}</div>
                        </div>
                      ) : (
                        <p className="m-0 text-sm text-muted">No address on file</p>
                      )}
                      {order.status === 'confirmed' && (
                        <button
                          type="button"
                          onClick={() => startEditingAddress(order)}
                          className="text-sm px-3 py-1.5 rounded border border-line text-ink hover:bg-cream transition-colors shrink-0"
                        >
                          Change
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {(order.requestReason || order.decisionReason) && (
                  <div className="mt-4 space-y-1 text-sm">
                    {order.requestReason && (
                      <div className="text-muted"><span className="text-ink">Your reason:</span> {order.requestReason}</div>
                    )}
                    {order.decisionReason && (
                      <div className="text-muted"><span className="text-ink">Reason:</span> {order.decisionReason}</div>
                    )}
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  {order.status === 'confirmed' && (
                    <button
                      type="button"
                      onClick={() => handleCancel(order)}
                      className="text-sm px-3 py-1.5 rounded border border-line text-ink hover:bg-cream transition-colors"
                    >
                      Cancel order
                    </button>
                  )}
                  {order.status === 'processing' && !order.decisionReason && (
                    <button
                      type="button"
                      onClick={() => handleCancel(order)}
                      className="text-sm px-3 py-1.5 rounded border border-line text-ink hover:bg-cream transition-colors"
                    >
                      Request cancellation
                    </button>
                  )}
                  {order.status === 'delivered' && !order.decisionReason && (
                    <button
                      type="button"
                      disabled={!canReturn(order)}
                      title={!canReturn(order) ? 'Return period expired' : undefined}
                      onClick={() => handleReturn(order)}
                      className="text-sm px-3 py-1.5 rounded border border-line text-ink hover:bg-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      Request return
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <ReasonPromptModal
          open
          title={modal.kind === 'cancel' ? 'Request cancellation' : 'Request return'}
          placeholder="Tell us why (optional)"
          submitLabel="Send request"
          onClose={() => setModal(null)}
          onSubmit={submitReason}
        />
      )}
    </main>
  )
}
