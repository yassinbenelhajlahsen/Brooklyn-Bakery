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
| `routes/productsRoutes.js` | `GET /`, `GET /:slug`, plus per-product review endpoints (`GET /:slug/reviews` public; `POST` / `PATCH` / `DELETE /:slug/reviews` authed) |
| `routes/addressesRoutes.js` | `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id` — mounted at `/me/addresses` |
| `routes/cartRoutes.js` | `GET`, `DELETE`, `POST /merge`, `PUT /items/:productId` |
| `routes/meRoutes.js` | `GET /`, `POST /clicks` |
| `routes/orderRoutes.js` | `GET /`, `POST /`, `PATCH /:id/address`, `POST /:id/cancel`, `POST /:id/return` |
| `routes/adminRoutes.js` | Order routes inline (`GET /orders`, `GET /orders/:id`, `POST /orders/:id/transition`) and mounts `/products` + `/users` sub-routers |
| `routes/adminProductsRoutes.js` | `GET /`, `POST /`, `PATCH /:id`, `POST /:id/archive`, `POST /:id/unarchive` |
| `routes/adminUsersRoutes.js` | `GET /`, `GET /:id`, `PATCH /:id/role`, `POST /:id/balance` |
| `controllers/productsController.js` | Public product listing + detail (`getProducts`, `getProduct`); filters `archived_at IS NULL`; attaches `avgRating` + `reviewCount` via a single `review.groupBy`; `getProduct` resolves the slug to a product via `findProductBySlug` |
| `controllers/reviewsController.js` | `getProductReviews` (public), `createReview` / `updateReview` / `deleteReview` (authed, one review per product per user, enforced by unique index); all handlers resolve the slug param to a `productId` via an internal `resolveProductId` helper |
| `controllers/addressesController.js` | `listAddresses`, `createAddress`, `updateAddress`, `deleteAddress` — ownership enforced via `userId` from `req.user` |
| `lib/address.js` | Pure helpers: `normalizeAddressInput` (trim + validate required fields) and `snapshotAddress` (copies the 6 shipping fields onto an order-update payload) |
| `controllers/cartController.js` | Cart CRUD; `mergeCart` delegates to `services/cartService` |
| `controllers/meController.js` | Authenticated profile fetch (`GET /me`) and click-credit flush (`POST /me/clicks`) |
| `controllers/orderController.js` | `createOrder` (delegates to `services/orderService.placeOrder`; requires `addressId`, snapshots address inside the tx), `listMyOrders`, `updateOrderAddress` (re-snapshots while order is `confirmed`), `userCancel`, `userReturn` — cancel/return route to `services/orderStateMachine.transition` with `actor: 'user'` |
| `controllers/adminOrdersController.js` | `listAllOrders` (filterable), `getOrder` (detail), `transitionOrder` (admin dispatch to state machine with whitelisted actions) |
| `controllers/adminProductsController.js` | Product CRUD + archive/unarchive + payload validation |
| `controllers/adminUsersController.js` | `listUsers` (with `orderCount`), `getUser` (+ nested orders), `updateRole` (self-demotion + last-admin guards inside tx), `adjustBalance` (row-locked, negative-balance guard) |
| `services/orderStateMachine.js` | `transitions` table, `resolveTransition` (pure), `checkReturnWindow` (pure), and `transition({ orderId, action, actor, reason })` — the single atomic path for all order status changes |
| `services/orderService.js` | `placeOrder(userId)` — atomic checkout transaction (balance row-lock, stock guard, order create). `cancelOrderById` is gone; all cancel/return flows now go through the state machine. |
| `services/cartService.js` | `mergeGuestCart(userId, incoming)` — load, additive-merge via `lib/cart`, validate against products, transactional replace, hydrate |
| `services/clickService.js` | `creditClicks({ userId, delta, elapsedMs })` — row-locked balance credit with server-side rate cap, updates `lastClickFlushAt` |
| `services/mailerService.js` | Email helper (nodemailer); currently unused by controllers — scaffolding for future order notifications |
| `middleware/requireAuth.js` | JWT verification via Supabase admin client |
| `middleware/requireAdmin.js` | Admin role check (loads `users.role` via Prisma) |
| `lib/prisma.js` | PrismaClient singleton (survives nodemon reload in dev) |
| `lib/supabase.js` | Admin Supabase client (uses `SUPABASE_SECRET_KEY`) |
| `lib/cart.js` | Pure functions: `mergeCartItems`, `computeCartTotal` |
| `lib/slugUtils.js` | `toNameSlug(name)` (kebab-case helper) and `findProductBySlug(slug, products)` — resolves a slug to a product object by name match first, then 8-char UUID prefix fallback |
| `lib/clickCredit.js` | Pure rate-cap math: `computeCredit({ delta, elapsedMs, lastClickFlushAt, now })` + constants (`RATE_PER_SEC`, `BURST_BONUS`, `MAX_FIRST_WINDOW_MS`, `MAX_DELTA`, `MAX_ELAPSED_MS`) |
| `lib/httpError.js` | `httpError(status, msg)` and `sendHttpError(res, err)` helpers |
| `prisma/schema.prisma` | Data model (User, Product, CartItem, Order, OrderItem, Review, Address) + enums (`OrderStatus`, `ProductType`, `UserRole`) |
| `prisma/seed.js` | Idempotent product seeding (upsert by name) |
| `prisma/migrations/20260420192006_init/` | Initial schema migration |
| `prisma/migrations/20260420192213_supabase_integration/` | Cross-schema FK to `auth.users` + trigger that creates `public.users` on signup |
| `prisma/migrations/20260421045352_add_product_stock/` | Adds `products.stock` + nonneg check |
| `prisma/migrations/20260421203012_add_user_last_click_flush_at/` | Adds `users.last_click_flush_at` (nullable) for click-credit rate cap |
| `prisma/migrations/20260422000000_admin_order_lifecycle_and_product_archive/` | Expands `order_status` enum (6 new values), adds `orders.delivered_at` / `request_reason` / `decision_reason`, adds `products.archived_at`. Applied via `prisma migrate deploy` (sidesteps the shadow-DB issue caused by the earlier cross-schema FK to `auth.users`). |
| `prisma/migrations/20260424053144_add_reviews/` | Creates `reviews` table with `(product_id, user_id)` unique index |
| `prisma/migrations/20260424000001_make_review_text_optional/` | Makes `reviews.text` nullable (rating-only reviews) |
| `prisma/migrations/20260424120000_add_addresses_and_order_shipping/` | Creates `addresses` table; adds six nullable `shipping_*` snapshot columns to `orders` |
| `tests/slugUtils.test.js` | Tests for `toNameSlug` and `findProductBySlug` (node:test) |
| `tests/cart.test.js` | Tests for pure cart helpers (node:test) |
| `tests/clickCredit.test.js` | Tests for `computeCredit` rate-cap math |
| `tests/orderStateMachine.test.js` | Tests for `resolveTransition` + `checkReturnWindow` — the pure pieces of the state machine. The I/O wrapper (`transition`) is covered by manual QA per project test conventions. |
| `tests/address.test.js` | Tests for `lib/address.js` (`normalizeAddressInput`, `snapshotAddress`) |

## `frontend/`

### Top-level

| Path | Purpose |
| --- | --- |
| `.env.example` | Frontend env template (`VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) |
| `vite.config.js` | Vite config; dev server pinned to `127.0.0.1:5173` |
| `eslint.config.js` | ESLint flat config with React hooks + refresh rules |
| `index.html` | Vite HTML entry |
| `src/main.jsx` | React root; wraps `<App />` in `<BrowserRouter>` and `<AuthProvider>` |
| `src/App.jsx` | Top-level layout + routes (`/`, `/earn`, `/checkout`, `/product/:slug`, `/about`, `/story`, `/contact`, `/faq`, `/help`, `/orders`, `/admin`); owns cart state and cart-drawer visibility for the shop shell |
| `src/index.css` | Base resets and CSS custom properties (color tokens: `--color-ink`, `--color-cream`, etc.) |

### Auth + hooks + services + lib

| Path | Purpose |
| --- | --- |
| `src/auth/AuthProvider.jsx` | Context provider: session, user profile (via `GET /me`), login modal, `authedFetch`, `requestCheckout` (navigates to `/checkout`), `refreshProfile` |
| `src/auth/useAuth.js` | `useAuth` hook (separate file for react-refresh compliance) |
| `src/hooks/useCart.js` | Cart state, localStorage persistence, login-time merge/hydrate (calls `services/cartService`) |
| `src/hooks/useLoginForm.js` | Login / signup form state + submit, wraps `signIn` / `signUp` |
| `src/hooks/useTabUnderline.js` | Animated tab-underline measurement; returns `parentRef`, `registerTab(key)`, `underlineStyle` |
| `src/hooks/usePlaceOrder.js` | Place-order flow; calls `orderService.placeOrder`, refreshes profile, fires `onSuccess` |
| `src/hooks/useCookieClicker.js` | Click accumulator + 10/sec client throttle; batched flush via `POST /me/clicks` on 5s interval / 50-click threshold / page-hide / logout; guest clicks persisted to `localStorage.bb:guestClicks` and migrated on login |
| `src/hooks/useAddresses.js` | List + create + update + delete against `/me/addresses`; splices returned address into local state (no refetch) |
| `src/hooks/admin/useAdminOrders.js` | List + filter + transition. After `transition`, splices the returned order into local state; drops it if the active status filter would now exclude it. |
| `src/hooks/admin/useAdminProducts.js` | List + CRUD + archive/unarchive. Mutations splice the returned product into state; archives dropped when `includeArchived=false`. |
| `src/hooks/admin/useAdminUsers.js` | List + `getOne(id)` detail fetch + role change + balance delta. Role/balance mutations merge the returned fields into the list row (preserves `orderCount` and `createdAt`). |
| `src/services/cartService.js` | Cart API calls (`mergeAndHydrateCart`, `fetchServerCart`, `syncCartItem`, `clearServerCart`) — take `authedFetch` as first arg |
| `src/services/profileService.js` | `fetchProfile` — returns `body.user` or `null` |
| `src/services/orderService.js` | `placeOrder` (takes `{ addressId }`; throws `PlaceOrderError` on non-2xx), `fetchMyOrders`, `updateOrderAddress`, `userCancelOrder`, `userReturnOrder` |
| `src/services/addressesService.js` | `listAddresses`, `createAddress`, `updateAddress`, `deleteAddress` — takes `authedFetch` as first arg |
| `src/services/admin/adminOrdersService.js` | `listOrders({ status? })`, `getOrder(id)`, `transitionOrder(id, action, reason)` |
| `src/services/admin/adminProductsService.js` | `listProducts({ includeArchived })`, `createProduct`, `updateProduct`, `archiveProduct`, `unarchiveProduct` |
| `src/services/admin/adminUsersService.js` | `listUsers`, `getUser(id)`, `updateRole(id, role)`, `adjustBalance(id, delta)` |
| `src/lib/supabase.js` | Browser Supabase client (publishable key) |
| `src/lib/cart.js` | Pure helpers: `computeCartSubtotal`, `computeCartItemCount`, `toHydratedCart` |
| `src/lib/slugUtils.js` | `toNameSlug(name)` (kebab-case) and `toProductSlug(name, id, allProducts)` — appends an 8-char UUID prefix only when another product in the list has the same name slug |
| `src/lib/categories.js` | `CATEGORIES` constant |
| `src/lib/styles.js` | Shared Tailwind class-string constants (e.g. `ICON_BTN`) |

### Pages

| Path | Purpose |
| --- | --- |
| `src/pages/ShopPage.jsx` | Product grid at `/`; fetches `GET /products` on mount; supports category filter + sort (name / price asc-desc / Top Rated — sorts by `avgRating`, tie-breaks on `reviewCount`); computes each product's slug via `toProductSlug` (accounting for duplicate names) and passes it to `BakedGoodCard` |
| `src/pages/ProductDetailPage.jsx` | `/product/:slug` — passes slug directly to `GET /products/:slug`, renders full description, qty control, and mounts `ReviewsSection` below |
| `src/pages/EarnPage.jsx` | `/earn` — hosts the `<CookieClicker />` |
| `src/pages/CheckoutPage.jsx` | Checkout review page: line items, balance, balance-after, `AddressSelector` (required before place-order), place-order |
| `src/pages/OrderHistoryPage.jsx` | `/orders` — customer order list with `StatusBadge`, shipping-address snapshot, "Change address" action while `confirmed` (uses `AddressSelector`), conditional Cancel / Request-cancellation / Request-return buttons per status, hides Request-* when `decisionReason` is set, enforces 48h return window, prompts for reason via `ReasonPromptModal` |
| `src/pages/AdminPage.jsx` | `/admin` shell — gated by `AdminRoute`. Tab state (`useState`), sliding accent underline indicator, mounts `OrdersTab` / `ProductsTab` / `UsersTab` |
| `src/pages/AboutUsPage.jsx`, `StoryPage.jsx`, `ContactUsPage.jsx`, `FAQPage.jsx`, `HelpPage.jsx` | Static company / informational pages |

### Components (shared)

| Path | Purpose |
| --- | --- |
| `src/components/Header.jsx` | Site header (sticky `z-20`); login button / `<ProfileMenu>`, cart button |
| `src/components/ProfileMenu.jsx` | Logged-in account dropdown; shows balance; conditional "Admin" link (admins only); "Order History" link to `/orders`; Sign out. Uses icons from `components/icons/`. |
| `src/components/BuyEarnTabs.jsx` | Top-of-home Shop / Earn tab nav with sliding underline indicator (same idiom as AdminPage) |
| `src/components/ShopEarnShell.jsx` | Wraps Shop / Earn routes and renders `<BuyEarnTabs />` + the active child |
| `src/components/CategoryNav.jsx` | Category filter buttons (used in `ShopPage`) |
| `src/components/Footer.jsx` | Static footer (dark `bg-ink`) |
| `src/components/Ornament.jsx` | Decorative horizontal rule with rotated diamond accent |
| `src/components/CartDrawer.jsx` | Slide-out cart; subtotal + checkout + clear |
| `src/components/CartItemRow.jsx` | Shared cart row; `variant="drawer"` or `"checkout"` |
| `src/components/QuantityControl.jsx` | Shared `−` / qty / `+` control used in cards, drawer, checkout |
| `src/components/LoginModal.jsx` | Login / sign-up modal with animated tab underline |
| `src/components/loginModal.copy.js` | Copy constants for `LoginModal` (headlines/subcopy per mode+reason) |
| `src/components/StatusBadge.jsx` | Colored pill for any `OrderStatus`; used by both customer (`OrderHistoryPage`) and admin surfaces |
| `src/components/ReasonPromptModal.jsx` | Fixed-overlay modal with a textarea + Cancel/Submit. `required` prop rejects empty submit with inline error. ESC closes. Used on customer side only for cancel/return prompts — admin uses an inline textarea inside the drawer. |
| `src/components/CookieClicker.jsx` | Cookie clicker UI; consumes `useCookieClicker`, renders the floating `+1` animation, shows "Log in to save your points" for guests |
| `src/components/cards/ProductCard.jsx` | Product card with qty controls; renders `avgRating` star row + review count; accepts a `slug` prop and navigates to `/product/:slug` on click |
| `src/components/cards/ProductCardSkeleton.jsx` | Loading skeleton matching `ProductCard` layout |
| `src/components/ReviewsSection.jsx` | Per-product reviews block: list + star-picker composer. Handles create / inline edit / delete of the caller's own review via `/products/:slug/reviews` endpoints; receives `productSlug` prop. |
| `src/components/ReviewCard.jsx` | Single review row (display name, stars, text, created date); owner sees inline edit + delete icon buttons |
| `src/components/AddressForm.jsx` | Address create / edit form (line1, line2?, city, state, postalCode, country) with trim + required-field validation; tolerates null `line2` on edit |
| `src/components/AddressSelector.jsx` | Radio list of the caller's saved addresses + "New address" button; embeds `AddressForm` for create / edit. Used by checkout and by order-history "change address". |
| `src/components/icons/PackageIcon.jsx` | SVG (orders icon); used by `ProfileMenu` and `AdminPage` |
| `src/components/icons/UserIcon.jsx` | SVG (user/admin icon); used by `ProfileMenu` and `AdminPage` |

### Components (admin)

| Path | Purpose |
| --- | --- |
| `src/components/admin/AdminRoute.jsx` | Role-gate wrapper: reads `useAuth().profile`; shows loading until profile resolves; redirects non-admins to `/` |
| `src/components/admin/OrdersTab.jsx` | Admin orders table + `StatusFilter` + Refresh; row click opens `OrderDetailDrawer` and rebinds to the updated order after a transition |
| `src/components/admin/StatusFilter.jsx` | `<select>` over all 8 statuses + "All statuses" |
| `src/components/admin/OrderDetailDrawer.jsx` | Right slide-in drawer (animated, ESC-closes, `h-dvh`). Shows snapshotted shipping address. Action footer renders buttons via `ACTIONS_BY_STATUS`; reason-required actions expand an inline textarea (Cancel / Confirm) rather than opening a modal. |
| `src/components/admin/ProductsTab.jsx` | Products table with "Include archived" toggle, sort (default / popularity via `avgRating` + `reviewCount`), rating column, "New product", row-level Edit / Archive / Unarchive / Reviews |
| `src/components/admin/ProductReviewsDrawer.jsx` | Right slide-in drawer listing all reviews for a product (admin-read only; uses public `GET /products/:id/reviews`) |
| `src/components/admin/ProductEditModal.jsx` | Create / edit form with client-side validation, server-error surface, ESC-closes |
| `src/components/admin/UsersTab.jsx` | Users table; row click opens `UserDetailDrawer` |
| `src/components/admin/UserDetailDrawer.jsx` | Right slide-in drawer (animated, ESC-closes, `h-dvh`). Identity + role toggle (disabled when target === acting admin) + balance delta form + user's orders with `StatusBadge` + user's reviews (product name, stars, text). Fetches own detail via `useAdminUsers.getOne(id)`. |

## `docs/`

| Path | Purpose |
| --- | --- |
| `architecture.md` | System architecture + auth, cart, order lifecycle, admin panel |
| `conventions.md` | Code conventions |
| `file-map.md` | This file |
| `data-and-api.md` | Schema summary + API endpoint reference |
| `superpowers/specs/` | Design specs (authoritative for *why* decisions were made) — includes `2026-04-24-reviews-design.md` and `2026-04-24-addresses-design.md` |
| `superpowers/plans/` | Implementation plans produced by the superpowers skill — includes `2026-04-24-reviews.md` and `2026-04-24-addresses.md` |
