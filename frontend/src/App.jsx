import { useState } from 'react'
import Header from './components/Header.jsx'
import CategoryNav from './components/CategoryNav.jsx'
import HomePage from './pages/HomePage.jsx'
import Footer from './components/Footer.jsx'
import CartDrawer from './components/CartDrawer.jsx'
import LoginModal from './components/LoginModal.jsx'
import { useCart } from './hooks/useCart.js'
import './App.css'

const CATEGORIES = ['bread', 'cake', 'cookies', 'drinks', 'pastry']

export default function App() {
  const [activeCategory, setActiveCategory] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const { cart, itemCount, increment, decrement, clearCart } = useCart()

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
      <LoginModal />
    </div>
  )
}
