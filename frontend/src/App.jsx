import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header.jsx'
import ShopEarnShell from './components/ShopEarnShell.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import OrderHistoryPage from './pages/OrderHistoryPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import ProductDetailPage from './pages/ProductDetailPage.jsx'
import Footer from './components/Footer.jsx'
import CartDrawer from './components/CartDrawer.jsx'
import LoginModal from './components/LoginModal.jsx'
import PageTransition from './components/PageTransition.jsx'
import { useCart } from './hooks/useCart.js'

import AboutPage from './pages/AboutUsPage.jsx';
import StoryPage from './pages/StoryPage.jsx';
import ContactPage from './pages/ContactUsPage.jsx';
import FaqPage from './pages/FAQPage.jsx';
import HelpPage from './pages/HelpPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AdminRoute from './components/admin/AdminRoute.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

const MAIN_CLS = "flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5"

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  const [cartOpen, setCartOpen] = useState(false)
  const { cart, itemCount, increment, decrement, removeItem, addItem, clearCart } = useCart()

  const shellLayout = (
    <ShopEarnShell cart={cart} onIncrement={increment} onDecrement={decrement} />
  )

  return (
    <div className="flex flex-col min-h-screen">
      <ScrollToTop />
      <Header cartCount={itemCount} onCartClick={() => setCartOpen(true)} />
      <PageTransition>
        <Routes>

          <Route element={shellLayout}>
            <Route index element={null} />
            <Route path="earn" element={null} />
          </Route>

          <Route
            path="/product/:slug"
            element={
              <ProductDetailPage
                cart={cart}
                onIncrement={increment}
                onDecrement={decrement}
              />
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
          <Route path="/about" element={<main className={MAIN_CLS}><AboutPage /></main>} />
          <Route path="/story" element={<main className={MAIN_CLS}><StoryPage /></main>} />
          <Route path="/contact" element={<main className={MAIN_CLS}><ContactPage /></main>} />
          <Route path="/faq" element={<main className={MAIN_CLS}><FaqPage /></main>} />
          <Route path="/help" element={<main className={MAIN_CLS}><HelpPage /></main>} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/orders" element={<OrderHistoryPage addItem={addItem} />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <main className={MAIN_CLS}>
                  <AdminPage />
                </main>
              </AdminRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </PageTransition>
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
