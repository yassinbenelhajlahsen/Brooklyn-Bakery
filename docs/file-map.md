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
| `routes/orderRoutes.js` | `GET /`, `POST /` |
| `routes/adminRoutes.js` | `GET /orders`, `PATCH /orders/:id/cancel` |
| `controllers/productsController.js` | Product listing (public) |
| `controllers/cartController.js` | Cart CRUD + `mergeCart` |
| `controllers/orderController.js` | `createOrder` (atomic transaction), `listMyOrders` |
| `controllers/adminOrdersController.js` | `listAllOrders`, `cancelOrder` |
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
| `tests/cart.test.js` | Tests for pure cart helpers (node:test) |
| `db/` | (Empty placeholder) |

## `frontend/`

| Path | Purpose |
| --- | --- |
| `.env.example` | Frontend env template (`VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) |
| `vite.config.js` | Vite config; dev server pinned to `127.0.0.1:5173` |
| `eslint.config.js` | ESLint flat config with React hooks + refresh rules |
| `index.html` | Vite HTML entry |
| `src/main.jsx` | React root; wraps `<App />` in `<AuthProvider>` |
| `src/App.jsx` | Top-level layout; owns cart drawer + category nav state |
| `src/App.css`, `src/index.css` | Global styles |
| `src/auth/AuthProvider.jsx` | Context provider: session, login modal, `authedFetch`, cart sync helpers |
| `src/auth/useAuth.js` | `useAuth` hook (separate file for react-refresh compliance) |
| `src/hooks/useCart.js` | Cart state, localStorage persistence, login-time merge/hydrate |
| `src/lib/supabase.js` | Browser Supabase client (publishable key) |
| `src/pages/HomePage.jsx` | Product grid; fetches `GET /products` on mount |
| `src/components/Header.jsx` | Site header; login/logout button, cart button |
| `src/components/CategoryNav.jsx` | Category filter buttons |
| `src/components/Footer.jsx` | Static footer |
| `src/components/CartDrawer.jsx` | Slide-out cart; subtotal + checkout + clear |
| `src/components/LoginModal.jsx` | Login / sign-up modal with animated tab underline |
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
