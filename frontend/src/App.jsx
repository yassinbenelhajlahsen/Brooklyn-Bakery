import { useState, useMemo, useEffect } from 'react'
import Header from './components/Header.jsx'
import CategoryNav from './components/CategoryNav.jsx'
import HomePage from './pages/HomePage.jsx'
import Footer from './components/Footer.jsx'
import CartDrawer from './components/CartDrawer.jsx'
import LoginModal from './components/LoginModal.jsx'
import { useAuth } from './auth/useAuth.js'
import './App.css'

const CATEGORIES = ['muffin', 'cookies', 'drinks']

export default function App() {
  const [activeCategory, setActiveCategory] = useState(null)
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem('cart');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })
  const [cartOpen, setCartOpen] = useState(false)

  const { lastOrderResult, clearOrderResult } = useAuth();

  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch {
      // private browsing / storage blocked — silently skip
    }
  }, [cart]);

  const setQty = (item, qty) => {
    setCart((prev) => {
      const next = { ...prev }
      if (qty <= 0) {
        delete next[item.id]
      } else {
        next[item.id] = { item, qty }
      }
      return next
    })
  }

  const increment = (item) => setQty(item, (cart[item.id]?.qty ?? 0) + 1)
  const decrement = (item) => setQty(item, (cart[item.id]?.qty ?? 0) - 1)
  const clearCart = () => setCart({})

  const itemCount = useMemo(
    () => Object.values(cart).reduce((n, { qty }) => n + qty, 0),
    [cart]
  )

  return (
    <div className="app">
      <Header cartCount={itemCount} onCartClick={() => setCartOpen(true)} />
      <CategoryNav
        categories={CATEGORIES}
        active={activeCategory}
        onSelect={setActiveCategory}
      />
      <main className="app-main">
        <HomePage
          category={activeCategory}
          cart={cart}
          onIncrement={increment}
          onDecrement={decrement}
        />
      </main>
      <Footer />
      <CartDrawer
        open={cartOpen}
        cart={cart}
        onClose={() => setCartOpen(false)}
        onIncrement={increment}
        onDecrement={decrement}
        onClear={clearCart}
      />
      {lastOrderResult && (
        <div className="order-banner" role="status" onClick={clearOrderResult}>
          {lastOrderResult.error ? (
            <span>⚠ {lastOrderResult.error}</span>
          ) : (
            <span>✓ Order received ({Object.keys(lastOrderResult.received ?? {}).length} line items). Click to dismiss.</span>
          )}
        </div>
      )}
      <LoginModal />
    </div>
  )
}
