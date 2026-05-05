import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import Ornament from '../components/Ornament.jsx'
import ReasonPromptModal from '../components/ReasonPromptModal.jsx'
import LoadMoreFooter from '../components/LoadMoreFooter.jsx'
import { fetchMyOrders, userCancelOrder, userReturnOrder, updateOrderAddress } from '../services/orderService.js'
import OrderCard from '../components/cards/OrderCard.jsx'
import OrderCardSkeleton from '../components/cards/OrderCardSkeleton.jsx'

const PAGE_SIZE = 10

const BACK_BTN = clsx(
  "bg-transparent text-muted border border-line rounded-lg p-3",
  "font-sans font-medium text-[12px] leading-[1] tracking-[0.1em] uppercase",
  "[transition:color_180ms_ease,border-color_180ms_ease]",
  "hover:text-accent hover:border-accent",
  "motion-reduce:transition-none",
)

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

export default function OrderHistoryPage({ addItem }) {
  const { user, ready, authedFetch } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [editingAddressOrderId, setEditingAddressOrderId] = useState(null)
  const [pendingAddressId, setPendingAddressId] = useState(null)
  const [addressSaving, setAddressSaving] = useState(false)
  const [addressError, setAddressError] = useState(null)
  const [productMap, setProductMap] = useState(null)
  const [productsError, setProductsError] = useState(null)
  const [skippedByOrderId, setSkippedByOrderId] = useState({})
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!user) return
    const reqId = ++requestIdRef.current
    setLoading(true)
    setLoadingMore(false)
    setError(null)
    try {
      const data = await fetchMyOrders(authedFetch, { take: PAGE_SIZE, skip: 0 })
      if (requestIdRef.current !== reqId) return
      setItems(data.items)
      setTotal(data.total)
      setHasMore(data.hasMore)
    } catch (err) {
      if (requestIdRef.current !== reqId) return
      console.error('Failed to load order history', err)
      setError(err?.message ?? 'Could not load your order history.')
    } finally {
      if (requestIdRef.current === reqId) setLoading(false)
    }
  }, [user, authedFetch])

  useEffect(() => { refresh() }, [refresh])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return
    const reqId = requestIdRef.current
    setLoadingMore(true)
    try {
      const data = await fetchMyOrders(authedFetch, { take: PAGE_SIZE, skip: items.length })
      if (requestIdRef.current !== reqId) return
      setItems((prev) => [...prev, ...data.items])
      setTotal(data.total)
      setHasMore(data.hasMore)
    } catch (err) {
      if (requestIdRef.current !== reqId) return
      setError(err?.message ?? 'Could not load more orders.')
    } finally {
      if (requestIdRef.current === reqId) setLoadingMore(false)
    }
  }, [authedFetch, hasMore, loadingMore, items.length])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/products`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (cancelled) return
        const map = new Map((data.items ?? []).map((p) => [p.id, p]))
        setProductMap(map)
        setProductsError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load products for reorder', err)
        setProductsError(err?.message ?? 'Could not load products.')
      }
    })()
    return () => { cancelled = true }
  }, [])

  function patchOrder(updated) {
    setItems((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
  }

  function handleReorder(order) {
    if (!productMap) return
    let skipped = 0
    let added = 0
    for (const entry of order.items) {
      const product = productMap.get(entry.productId)
      if (product) {
        addItem(product, entry.quantity)
        added += 1
      } else {
        skipped += 1
      }
    }
    if (skipped > 0) {
      setSkippedByOrderId((prev) => ({ ...prev, [order.id]: skipped }))
    } else {
      setSkippedByOrderId((prev) => {
        if (!(order.id in prev)) return prev
        const next = { ...prev }
        delete next[order.id]
        return next
      })
    }
    if (added > 0) {
      navigate('/checkout')
    }
  }

  async function handleCancel(order) {
    if (order.status === 'confirmed') {
      try {
        const updated = await userCancelOrder(authedFetch, order.id, '')
        patchOrder(updated)
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
      const updated = kind === 'cancel'
        ? await userCancelOrder(authedFetch, orderId, reason)
        : await userReturnOrder(authedFetch, orderId, reason)
      patchOrder(updated)
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
      setItems((prev) => prev.map((o) => (o.id === orderId ? updated : o)))
      setEditingAddressOrderId(null)
      setPendingAddressId(null)
    } catch (err) {
      setAddressError(err?.message ?? 'Could not update address.')
    } finally {
      setAddressSaving(false)
    }
  }

  if (!ready) return <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5" />
  if (!user) return <Navigate to="/" replace />

  return (
    <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
      <div className="w-full">
        <OrderHeader />

        <div className="mb-6 flex justify-start">
          <button className={BACK_BTN} onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <OrderCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="bg-surface border border-line rounded-xl px-8 py-12 text-center text-danger">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl px-8 py-12 text-center text-muted">
            You have not placed any orders yet.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  editingAddressOrderId={editingAddressOrderId}
                  pendingAddressId={pendingAddressId}
                  addressSaving={addressSaving}
                  addressError={addressError}
                  onPendingAddressChange={setPendingAddressId}
                  onStartEditAddress={startEditingAddress}
                  onCancelEditAddress={cancelEditingAddress}
                  onSaveAddress={saveAddress}
                  onCancel={handleCancel}
                  onReturn={handleReturn}
                  onReorder={handleReorder}
                  reorderDisabledReason={
                    productsError
                      ? 'Could not load products — refresh to try again.'
                      : !productMap
                        ? 'Loading products…'
                        : null
                  }
                  skippedCount={skippedByOrderId[order.id] ?? 0}
                />
              ))}
            </div>

            <div className="mt-6">
              <LoadMoreFooter
                shown={items.length}
                total={total}
                hasMore={hasMore}
                loading={loading}
                loadingMore={loadingMore}
                onLoadMore={loadMore}
              />
            </div>
          </>
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
