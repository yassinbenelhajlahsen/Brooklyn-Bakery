import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import ShopEarnShell from './components/ShopEarnShell.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import Footer from './components/Footer.jsx'
import CartDrawer from './components/CartDrawer.jsx'
import LoginModal from './components/LoginModal.jsx'
import { useCart } from './hooks/useCart.js'

const MAIN_CLS = "flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5"

export default function App() {
  const [cartOpen, setCartOpen] = useState(false)
  const { cart, itemCount, increment, decrement, removeItem, clearCart } = useCart()

  const shellLayout = (
    <>
      <ShopEarnShell cart={cart} onIncrement={increment} onDecrement={decrement} />
      <CartDrawer
        open={cartOpen}
        cart={cart}
        onClose={() => setCartOpen(false)}
        onIncrement={increment}
        onDecrement={decrement}
        onClear={clearCart}
      />
    </>
  )

  return (
    <div className="flex flex-col min-h-screen">
      <Header cartCount={itemCount} onCartClick={() => setCartOpen(true)} />
      <Routes>
        <Route element={shellLayout}>
          <Route index element={null} />
          <Route path="earn" element={null} />
        </Route>
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
