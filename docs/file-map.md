# File map

Annotated tree of the code and docs that matter. `node_modules/`, `dist/`, and lockfiles are omitted.

## Root

| Path | Purpose |
| --- | --- |
| `package.json` | Root manifest; only exists to run backend + frontend concurrently via `npm run dev` |
| `devLog.txt` | Informal changelog (manually maintained) |
| `CLAUDE.md` | Guidance for Claude Code; points into `docs/` |
| `README.md` | Project overview, setup, scripts |

## `backend/`

| Path | Purpose |
| --- | --- |
| `server.js` | Express app, middleware, route mounts |
| `.env.example` | Backend env template (`PORT`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`) |
| `routes/productsRoutes.js` | `GET /products` |
| `routes/cartRoutes.js` | `GET`, `DELETE`, `POST /merge`, `PUT /items/:productId` |
| `routes/meRoutes.js` | `GET /` |
| `routes/orderRoutes.js` | `GET /`, `POST /` |
| `routes/adminRoutes.js` | `GET /orders`, `PATCH /orders/:id/cancel` |
| `controllers/productsController.js` | Product listing (public) |
| `controllers/cartController.js` | Cart CRUD; `mergeCart` delegates to `services/cartService` |
| `controllers/meController.js` | Authenticated profile fetch (`GET /me`) |
| `controllers/orderController.js` | `createOrder` (delegates to `services/orderService.placeOrder`), `listMyOrders` |
| `controllers/adminOrdersController.js` | `listAllOrders`; `cancelOrder` (delegates to `services/orderService.cancelOrderById`) |
| `services/orderService.js` | `placeOrder(userId)` and `cancelOrderById(orderId)` — the two atomic Prisma transactions (balance row-lock, stock guard, order create/cancel) |
| `services/cartService.js` | `mergeGuestCart(userId, incoming)` — load, additive-merge via `lib/cart`, validate against products, transactional replace, hydrate |
| `middleware/requireAuth.js` | JWT verification via Supabase admin client |
| `middleware/requireAdmin.js` | Admin role check (loads `users.role` via Prisma) |
| `lib/prisma.js` | PrismaClient singleton (survives nodemon reload in dev) |
| `lib/supabase.js` | Admin Supabase client (uses `SUPABASE_SECRET_KEY`) |
| `lib/cart.js` | Pure functions: `mergeCartItems`, `computeCartTotal` |
| `lib/httpError.js` | `httpError(status, msg)` and `sendHttpError(res, err)` helpers |
| `prisma/schema.prisma` | Data model (User, Product, CartItem, Order, OrderItem) + enums |
| `prisma/seed.js` | Idempotent product seeding (upsert by name) |
| `prisma/migrations/20260420192006_init/` | Initial schema migration |
| `prisma/migrations/20260420192213_supabase_integration/` | Cross-schema FK to `auth.users` + trigger that creates `public.users` on signup |
| `prisma/migrations/20260421045352_add_product_stock/` | Adds `products.stock` column + nonneg check constraint |
| `tests/cart.test.js` | Tests for pure cart helpers (node:test) |
| `db/` | (Empty placeholder) |

## `frontend/`

| Path | Purpose |
| --- | --- |
| `.env.example` | Frontend env template (`VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) |
| `vite.config.js` | Vite config; dev server pinned to `127.0.0.1:5173` |
| `eslint.config.js` | ESLint flat config with React hooks + refresh rules |
| `index.html` | Vite HTML entry |
| `src/main.jsx` | React root; wraps `<App />` in `<BrowserRouter>` and `<AuthProvider>` |
| `src/App.jsx` | Top-level layout + routes (`/`, `/checkout`); owns cart state and cart-drawer/category-nav visibility on `/` |
| `src/App.css`, `src/index.css` | Global styles |
| `src/auth/AuthProvider.jsx` | Context provider: session, user profile (via `GET /me`), login modal, `authedFetch`, `requestCheckout` (navigates to `/checkout`), `refreshProfile` |
| `src/auth/useAuth.js` | `useAuth` hook (separate file for react-refresh compliance) |
| `src/hooks/useCart.js` | Cart state, localStorage persistence, login-time merge/hydrate (calls `services/cartService`) |
| `src/hooks/useLoginForm.js` | Login / signup form state + submit, wraps `signIn` / `signUp` |
| `src/hooks/useTabUnderline.js` | Animated tab-underline measurement; returns `parentRef`, `registerTab(key)`, `underlineStyle` |
| `src/hooks/usePlaceOrder.js` | Place-order flow; calls `orderService.placeOrder`, refreshes profile, fires `onSuccess` |
| `src/services/cartService.js` | Cart API calls (`mergeAndHydrateCart`, `fetchServerCart`, `syncCartItem`, `clearServerCart`) — take `authedFetch` as first arg |
| `src/services/profileService.js` | `fetchProfile` — returns `body.user` or `null` |
| `src/services/orderService.js` | `placeOrder`; throws `PlaceOrderError` on non-2xx |
| `src/lib/supabase.js` | Browser Supabase client (publishable key) |
| `src/lib/cart.js` | Pure helpers: `computeCartSubtotal`, `computeCartItemCount`, `toHydratedCart` |
| `src/lib/categories.js` | `CATEGORIES` constant |
| `src/pages/HomePage.jsx` | Product grid; fetches `GET /products` on mount |
| `src/pages/CheckoutPage.jsx` | Checkout review page: line items with qty controls, balance, balance-after, place-order |
| `src/components/Header.jsx` | Site header; login/logout button, cart button |
| `src/components/CategoryNav.jsx` | Category filter buttons |
| `src/components/Footer.jsx` | Static footer |
| `src/components/CartDrawer.jsx` | Slide-out cart; subtotal + checkout + clear |
| `src/components/CartItemRow.jsx` | Shared cart row; `variant="drawer"` or `"checkout"` |
| `src/components/QuantityControl.jsx` | Shared `−` / qty / `+` control used in cards, drawer, checkout |
| `src/components/LoginModal.jsx` | Login / sign-up modal with animated tab underline |
| `src/components/loginModal.copy.js` | Copy constants for `LoginModal` (headlines/subcopy per mode+reason) |
| `src/components/cards/BakedGoodCard.jsx` | Product card with qty controls |

## `docs/`

| Path | Purpose |
| --- | --- |
| `architecture.md` | System architecture + auth, cart, order flows |
| `conventions.md` | Code conventions |
| `file-map.md` | This file |
| `data-and-api.md` | Schema summary + API endpoint reference |
| `superpowers/specs/` | Design specs (authoritative for *why* decisions were made) |
| `superpowers/plans/` | Implementation plans produced by the superpowers skill |
