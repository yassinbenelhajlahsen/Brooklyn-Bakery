import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useLocation, matchPath } from 'react-router-dom'
import Header from './components/Header.jsx'
import ShopEarnShell from './components/ShopEarnShell.jsx'
import Footer from './components/Footer.jsx'
import CartDrawer from './components/CartDrawer.jsx'
import LoginModal from './components/LoginModal.jsx'
import PageTransition from './components/PageTransition.jsx'
import { useCart } from './hooks/useCart.js'
import { JarProvider } from './contexts/JarContext.jsx'
import ChatbotWidget from './components/chatbot/ChatbotWidget.jsx';
import AdminRoute from './components/admin/AdminRoute.jsx';

const CheckoutPage = lazy(() => import('./pages/CheckoutPage.jsx'))
const OrderHistoryPage = lazy(() => import('./pages/OrderHistoryPage.jsx'))
const WishlistPage = lazy(() => import('./pages/WishlistPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage.jsx'))
const StoryPage = lazy(() => import('./pages/StoryPage.jsx'))
const ContactPage = lazy(() => import('./pages/ContactUsPage.jsx'))
const FaqPage = lazy(() => import('./pages/FAQPage.jsx'))
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))
const SharePage = lazy(() => import('./pages/SharePage.jsx'))

const MAIN_CLS = "flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5"

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  const [cartOpen, setCartOpen] = useState(false)
  const { cart, itemCount, increment, decrement, removeItem, addItem, clearCart } = useCart()
  const { pathname } = useLocation()
  const isAdminRoute = matchPath('/admin/*', pathname) || pathname === '/admin'

  const shellLayout = (
    <ShopEarnShell cart={cart} onIncrement={increment} onDecrement={decrement} />
  )

  return (
    <JarProvider>
    <div className="flex flex-col min-h-screen">
      <ScrollToTop />
      <Header cartCount={itemCount} onCartClick={() => setCartOpen(true)} />
      <PageTransition>
        <Suspense fallback={null}>
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
          <Route path="/story" element={<main className={MAIN_CLS}><StoryPage /></main>} />
          <Route path="/contact" element={<main className={MAIN_CLS}><ContactPage /></main>} />
          <Route path="/faq" element={<main className={MAIN_CLS}><FaqPage /></main>} />
          <Route path="/share" element={<main className={MAIN_CLS}><SharePage /></main>} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/orders" element={<OrderHistoryPage addItem={addItem} />} />
          <Route
            path="/wishlist"
            element={
              <WishlistPage
                cart={cart}
                onIncrement={increment}
                onDecrement={decrement}
              />
            }
          />
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
        </Suspense>
      </PageTransition>
      <Footer />
      {cartOpen && (
        <CartDrawer
          cart={cart}
          onClose={() => setCartOpen(false)}
          onIncrement={increment}
          onDecrement={decrement}
          onClear={clearCart}
        />
      )}
      <LoginModal />
      {!isAdminRoute && <ChatbotWidget cart={cart} />}
    </div>
    </JarProvider>
  )
}
