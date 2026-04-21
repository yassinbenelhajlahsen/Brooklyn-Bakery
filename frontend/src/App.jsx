import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import CategoryNav from './components/CategoryNav.jsx'
import HomePage from './pages/HomePage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import Footer from './components/Footer.jsx'
import CartDrawer from './components/CartDrawer.jsx'
import LoginModal from './components/LoginModal.jsx'
import CookieClicker from './components/CookieClicker.jsx'
import { useCart } from './hooks/useCart.js'
import { CATEGORIES } from './lib/categories.js'

const MAIN_CLS = "flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5"

export default function App() {
  const [activeCategory, setActiveCategory] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const { cart, itemCount, increment, decrement, removeItem, clearCart } = useCart()

  return (
    <div className="flex flex-col min-h-screen">
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
              <div className="flex flex-1">
                <aside className="w-[22%] bg-cream border-r border-line flex items-center justify-center p-8">
                  <CookieClicker />
                </aside>
                <main className={MAIN_CLS}>
                  <HomePage
                    category={activeCategory}
                    cart={cart}
                    onIncrement={increment}
                    onDecrement={decrement}
                  />
                </main>
              </div>
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
            <main className={MAIN_CLS}>
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
