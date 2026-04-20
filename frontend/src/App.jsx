import { useState, useMemo } from 'react'
import Header from './components/Header.jsx'
import CategoryNav from './components/CategoryNav.jsx'
import HomePage from './pages/HomePage.jsx'
import Footer from './components/Footer.jsx'
import CartDrawer from './components/CartDrawer.jsx'
import './App.css'

const CATEGORIES = ['muffin', 'cookies', 'drinks']

export default function App() {
  const [activeCategory, setActiveCategory] = useState(null)
  const [cart, setCart] = useState({})
  const [cartOpen, setCartOpen] = useState(false)

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
    </div>
  )
}
