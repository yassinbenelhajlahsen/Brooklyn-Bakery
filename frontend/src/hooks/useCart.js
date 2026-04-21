import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../auth/useAuth.js'
import { computeCartItemCount } from '../lib/cart.js'
import {
  mergeAndHydrateCart,
  fetchServerCart,
  syncCartItem,
  clearServerCart,
} from '../services/cartService.js'

export function useCart() {
  const { user, session, authedFetch } = useAuth()

  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem('cart')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart))
    } catch {
      // private browsing / storage blocked — silently skip
    }
  }, [cart])

  const prevUserId = useRef(null)
  useEffect(() => {
    const currentId = user?.id ?? null
    if (prevUserId.current === currentId) return

    if (!currentId) {
      if (prevUserId.current !== null) {
        setCart({})
        try {
          localStorage.removeItem('cart')
          localStorage.removeItem('cartOwner')
        } catch { /* storage blocked */ }
      }
      prevUserId.current = null
      return
    }

    const owner = (() => { try { return localStorage.getItem('cartOwner') } catch { return null } })()
    const hasLocalItems = Object.keys(cart).length > 0
    const needsMerge = owner !== currentId && hasLocalItems

    ;(async () => {
      const hydrated = needsMerge
        ? await mergeAndHydrateCart(authedFetch, cart)
        : await fetchServerCart(authedFetch)
      if (hydrated) {
        setCart(hydrated)
        try { localStorage.setItem('cartOwner', currentId) } catch { /* storage blocked */ }
      }
    })()

    prevUserId.current = currentId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authedFetch])

  const setQty = (item, qty) => {
    const clamped = Math.max(0, qty)
    setCart((prev) => {
      const next = { ...prev }
      if (clamped <= 0) {
        delete next[item.id]
      } else {
        next[item.id] = { item, qty: clamped }
      }
      return next
    })
    if (session?.access_token) {
      syncCartItem(authedFetch, item.id, clamped)
    }
  }

  const increment = (item) => setQty(item, (cart[item.id]?.qty ?? 0) + 1)
  const decrement = (item) => setQty(item, (cart[item.id]?.qty ?? 0) - 1)
  const removeItem = (item) => setQty(item, 0)
  const clearCart = () => {
    setCart({})
    if (session?.access_token) {
      clearServerCart(authedFetch)
    }
  }

  const itemCount = useMemo(() => computeCartItemCount(cart), [cart])

  return { cart, itemCount, increment, decrement, removeItem, clearCart }
}
