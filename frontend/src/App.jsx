import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import CategoryNav from './components/CategoryNav.jsx'
import HomePage from './pages/HomePage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import Footer from './components/Footer.jsx'
import CartDrawer from './components/CartDrawer.jsx'
import LoginModal from './components/LoginModal.jsx'
import { useCart } from './hooks/useCart.js'
import './App.css'

const CATEGORIES = ['bread', 'cake', 'cookies', 'drinks', 'pastry']

export default function App() {
  const [activeCategory, setActiveCategory] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const { cart, itemCount, increment, decrement, removeItem, clearCart } = useCart()

  return (
    <div className="app">
      <Header cartCount={itemCount} onCartClick={() => setCartOpen(true)} />
      <Routes>
        <Route
          path="/"
          element={
            <>
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
              <CartDrawer
                open={cartOpen}
                cart={cart}
                onClose={() => setCartOpen(false)}
                onIncrement={increment}
                onDecrement={decrement}
                onClear={clearCart}
              />
            </>
          }
        />
        <Route
          path="/checkout"
          element={
            <main className="app-main">
              <CheckoutPage
                cart={cart}
                increment={increment}
                decrement={decrement}
                removeItem={removeItem}
                clearCart={clearCart}
              />
            </main>
          }
        />
      </Routes>
      <Footer />
      <LoginModal />
    </div>
  )
}
