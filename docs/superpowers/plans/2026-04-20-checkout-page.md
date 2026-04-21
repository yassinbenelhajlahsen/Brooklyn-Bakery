# Checkout Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/checkout` review page backed by a new `GET /me` endpoint, moving order creation out of the cart drawer into an explicit review + commit flow.

**Architecture:** Introduce `react-router-dom` for a real `/checkout` URL. Add `GET /me` returning the authenticated user's profile (including balance). Hoist profile state to `AuthProvider`. Build `CheckoutPage` that reads cart + profile, lets users adjust quantities, and commits via `POST /orders`.

**Tech Stack:** Node 20+ ESM backend, Express 5, Prisma, React 19, Vite 8, Supabase Auth, react-router-dom (new).

---

## Commit Strategy

This plan diverges from the typical one-commit-per-task model:

- **No per-task commits.** Accumulate all changes across tasks.
- **Single final commit at the end** (Task 11) bundling the spec, plan, all code, and docs.
- Rationale: user explicitly requested a single commit with a good message for this feature.

Spec reference: `docs/superpowers/specs/2026-04-20-checkout-page-design.md` (already written, currently uncommitted — will be included in the final commit per stored project convention on bundling design + plan docs).

---

### Task 1: Backend `GET /me` endpoint

**Files:**
- Create: `backend/controllers/meController.js`
- Create: `backend/routes/meRoutes.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Create the controller**

Create `backend/controllers/meController.js`. Note: `email` is NOT a column on `public.users` (it lives on Supabase's `auth.users`). Read email from `req.user.email`, which `requireAuth` attaches, and merge it into the response:

```js
import { prisma } from '../lib/prisma.js';
import { httpError, sendHttpError } from '../lib/httpError.js';

export async function getMe(req, res) {
    try {
        const profile = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                displayName: true,
                balance: true,
                role: true,
            },
        });
        if (!profile) return sendHttpError(res, httpError(404, 'Profile not found'));
        res.json({ user: { ...profile, email: req.user.email } });
    } catch (err) {
        console.error('getMe failed:', err);
        res.status(500).json({ error: 'Failed to load profile' });
    }
}
```

- [ ] **Step 2: Create the route**

Create `backend/routes/meRoutes.js`:

```js
import express from 'express';
import { getMe } from '../controllers/meController.js';

const router = express.Router();

router.get('/', getMe);

export default router;
```

- [ ] **Step 3: Mount in `server.js`**

Modify `backend/server.js`. Add the import near the other route imports and mount it behind `requireAuth`:

```js
import meRoutes from './routes/meRoutes.js';
```

```js
app.use('/me', requireAuth, meRoutes);
```

Place the mount next to the other authenticated routes (between `/orders` and `/cart` is fine — order doesn't matter functionally, but keep grouped with other authed routes).

- [ ] **Step 4: Manual verification**

Start the backend (`cd backend && npm run dev`). In another terminal, grab a real Supabase access token (easiest: log in via the frontend, `localStorage.getItem('sb-<project-ref>-auth-token')` → parse, take `access_token`). Then:

```bash
curl -s http://127.0.0.1:3000/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>" | jq
```

Expected: `{ "user": { "id": "...", "email": "...", "displayName": "...", "balance": N, "role": "customer" } }`.

Also verify: no auth header → 401.

---

### Task 2: Install `react-router-dom` and wrap with `<BrowserRouter>`

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Install the dep**

```bash
cd frontend && npm install react-router-dom
```

Expected: `react-router-dom` appears under `dependencies` in `frontend/package.json`. The lockfile updates.

- [ ] **Step 2: Wrap with `<BrowserRouter>` outside `<AuthProvider>`**

Modify `frontend/src/main.jsx`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

`BrowserRouter` must wrap `AuthProvider` because `AuthProvider` will use `useNavigate` in Task 3.

- [ ] **Step 3: Smoke test**

`cd frontend && npm run dev` and load `http://127.0.0.1:5173`. Expected: page loads normally, no console errors. The existing app still works because no routes are defined yet — `App` renders as before.

---

### Task 3: `AuthProvider` — profile state, `refreshProfile`, navigation-only `requestCheckout`

**Files:**
- Modify: `frontend/src/auth/AuthProvider.jsx`

- [ ] **Step 1: Add imports and profile state**

At the top of the file, add the `useNavigate` import:

```jsx
import { useNavigate } from 'react-router-dom';
```

Inside `AuthProvider`, below the existing `user` / `loginOpen` / `loginReason` state, add:

```jsx
const [profile, setProfile] = useState(null);
const navigate = useNavigate();
```

- [ ] **Step 2: Add `refreshProfile` callback**

Place it after `authedFetch` is defined (it depends on `authedFetch`). Use a `useCallback`:

```jsx
const refreshProfile = useCallback(async () => {
    if (!session?.access_token) return null;
    try {
        const res = await authedFetch('/me');
        if (!res.ok) return null;
        const body = await res.json();
        setProfile(body.user ?? null);
        return body.user ?? null;
    } catch {
        return null;
    }
}, [authedFetch, session?.access_token]);
```

- [ ] **Step 3: Fetch profile on session changes**

Leave the existing `onAuthStateChange` effect as-is (no need to touch — the dedicated profile effect below covers sign-in/sign-out via session changes).

Add a new effect below `authedFetch` and `refreshProfile` (it depends on `refreshProfile`):

```jsx
useEffect(() => {
    if (!session?.access_token) {
        setProfile(null);
        return;
    }
    refreshProfile();
}, [session?.access_token, refreshProfile]);
```

This fires on `INITIAL_SESSION` (page load with an existing session), `SIGNED_IN`, and `TOKEN_REFRESHED` (new access token), and resets `profile` to `null` on sign-out. Using a dedicated effect avoids stale closure issues that arise from calling `refreshProfile` directly inside the `onAuthStateChange` callback.

- [ ] **Step 4: Rewrite `requestCheckout` to navigate**

Replace the existing `requestCheckout` (currently does `POST /orders` directly):

```jsx
const requestCheckout = useCallback(() => {
    if (!user || !session?.access_token) {
        setLoginReason('checkout');
        setLoginOpen(true);
        return;
    }
    navigate('/checkout');
}, [user, session?.access_token, navigate]);
```

- [ ] **Step 5: Expose `profile`, `refreshProfile`, AND `authedFetch` on the context value**

`authedFetch` exists today but is only used internally by AuthProvider; it is NOT on the context value. `CheckoutPage` consumes it via `useAuth()`, so it must be added here alongside the new profile pieces. Update the `useMemo` that builds `value` to include all three in both the object and the deps array:

```jsx
const value = useMemo(() => ({
    user,
    session,
    profile,
    loginOpen,
    loginReason,
    openLogin,
    closeLogin,
    signIn,
    signUp,
    signOut,
    requestCheckout,
    authedFetch,
    refreshProfile,
    mergeAndHydrateCart,
    fetchServerCart,
    syncCartItem,
    clearServerCart,
}), [
    user,
    session,
    profile,
    loginOpen,
    loginReason,
    openLogin,
    closeLogin,
    signIn,
    signUp,
    signOut,
    requestCheckout,
    authedFetch,
    refreshProfile,
    mergeAndHydrateCart,
    fetchServerCart,
    syncCartItem,
    clearServerCart,
]);
```

- [ ] **Step 6: Manual verification**

- Open the app, log in. In React DevTools, inspect `AuthProvider` — `profile` should populate with `{ id, email, displayName, balance, role }`.
- Reload the page with a live session — profile should re-populate (via `INITIAL_SESSION`).
- Sign out — profile should reset to `null`.
- Click the Checkout button in the cart drawer (while signed out) — login modal should open with `reason='checkout'`. (While signed in, it'll navigate to `/checkout`, which renders nothing yet — expect a blank main area. That's fine until Task 6.)

---

### Task 4: `useCart` — `removeItem` helper

**Files:**
- Modify: `frontend/src/hooks/useCart.js`

- [ ] **Step 1: Add `removeItem`**

After `decrement` is defined, add:

```js
const removeItem = (item) => setQty(item, 0);
```

- [ ] **Step 2: Include `removeItem` in the return**

Update the return object:

```js
return { cart, itemCount, increment, decrement, removeItem, clearCart }
```

- [ ] **Step 3: Smoke**

No behavior change user-facing yet. Lint should stay clean:

```bash
cd frontend && npm run lint
```

Expected: no new errors.

---

### Task 5: Create `CheckoutPage`

**Files:**
- Create: `frontend/src/pages/CheckoutPage.jsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/pages/CheckoutPage.jsx`:

```jsx
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';

export default function CheckoutPage({ cart, increment, decrement, removeItem, clearCart }) {
    const { user, profile, refreshProfile, authedFetch } = useAuth();
    const navigate = useNavigate();

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [order, setOrder] = useState(null);

    if (!user) return <Navigate to="/" replace />;

    const entries = Object.values(cart);
    const subtotal = entries.reduce((sum, { item, qty }) => sum + item.price * qty, 0);
    const balance = profile?.balance ?? null;
    const balanceAfter = balance == null ? null : balance - subtotal;
    const insufficient = balance != null && balance < subtotal;
    const profileLoading = profile == null;

    if (order) {
        const shortId = order.id.slice(-8);
        return (
            <div className="checkout-page">
                <h2>Order placed</h2>
                <div className="checkout-success">
                    <p>Order <code>{shortId}</code></p>
                    <p>Total: {order.total} pts</p>
                    <p>Remaining balance: {profile?.balance ?? '—'} pts</p>
                    <button className="checkout-btn" onClick={() => navigate('/')}>
                        Continue shopping
                    </button>
                </div>
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="checkout-page">
                <h2>Checkout</h2>
                <p>Your cart is empty.</p>
                <button className="checkout-btn" onClick={() => navigate('/')}>
                    Back to shop
                </button>
            </div>
        );
    }

    const placeOrder = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await authedFetch('/orders', { method: 'POST' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                const msg =
                    res.status === 402 ? 'Not enough points to complete this order.'
                    : res.status === 400 ? 'Your cart is empty.'
                    : (body.error ?? 'Something went wrong. Please try again.');
                setError(msg);
                setSubmitting(false);
                return;
            }
            const created = await res.json();
            clearCart();
            await refreshProfile();
            setOrder({ id: created.id, total: created.total });
            setSubmitting(false);
        } catch {
            setError('Could not reach the server. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <div className="checkout-page">
            <h2>Checkout</h2>

            <ul className="cart-list">
                {entries.map(({ item, qty }) => (
                    <li key={item.id} className="cart-item">
                        <img className="cart-item-img" src={item.imageUrl} alt={item.description} />
                        <div className="cart-item-info">
                            <div className="cart-item-title">{item.name}</div>
                            <div className="cart-item-price">{item.price} pts</div>
                            <div className="qty-controls">
                                <button className="qty-btn" onClick={() => decrement(item)} aria-label="Decrease">−</button>
                                <span className="qty-value">{qty}</span>
                                <button className="qty-btn" onClick={() => increment(item)} aria-label="Increase">+</button>
                            </div>
                            <button className="clear-btn" onClick={() => removeItem(item)}>Remove</button>
                        </div>
                        <div className="cart-item-total">{item.price * qty} pts</div>
                    </li>
                ))}
            </ul>

            <div className="checkout-summary">
                <div className="cart-subtotal">
                    <span>Subtotal</span>
                    <span>{subtotal} pts</span>
                </div>
                <div className="cart-subtotal">
                    <span>Current balance</span>
                    <span>{profileLoading ? 'Loading…' : `${balance} pts`}</span>
                </div>
                <div className={`cart-subtotal ${insufficient ? 'checkout-warning' : ''}`}>
                    <span>Balance after</span>
                    <span>
                        {profileLoading
                            ? 'Loading…'
                            : insufficient
                                ? `${balanceAfter} pts — Not enough points`
                                : `${balanceAfter} pts`}
                    </span>
                </div>
            </div>

            {error && <p className="checkout-error" role="alert">{error}</p>}

            <div className="checkout-actions">
                <button
                    className="checkout-btn"
                    onClick={placeOrder}
                    disabled={entries.length === 0 || submitting || profileLoading || insufficient}
                >
                    {submitting ? 'Placing order…' : 'Place order'}
                </button>
                <button className="clear-btn" onClick={() => navigate('/')}>
                    Back to shop
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Add minimal styles**

Append to `frontend/src/App.css` (or wherever app styles live — existing `.cart-*` classes are in `App.css`):

```css
.checkout-page {
    max-width: 720px;
    margin: 2rem auto;
    padding: 1rem;
}

.checkout-summary {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.checkout-warning {
    color: #b00020;
}

.checkout-error {
    color: #b00020;
    margin-top: 0.5rem;
}

.checkout-actions {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.checkout-success {
    margin-top: 1rem;
}
```

- [ ] **Step 3: Verify compile + lint**

```bash
cd frontend && npm run lint
```

Expected: no errors. (This file isn't routed yet — Task 6 wires it up.)

---

### Task 6: `App.jsx` — routes + conditional layout

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Wire routes**

Replace `App.jsx` contents:

```jsx
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
```

Key changes:
- `CategoryNav` and `CartDrawer` move inside the `/` route (only mounted on home).
- `CheckoutPage` mounts on `/checkout`.
- `Header`, `Footer`, and `LoginModal` remain always-mounted.
- `removeItem` is destructured from `useCart` and passed to `CheckoutPage`.

- [ ] **Step 2: Lint**

```bash
cd frontend && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Smoke test both routes**

With `npm run dev` running:
- Load `/` — home page renders normally with products + cart drawer accessible.
- Load `/checkout` directly while signed out — redirects to `/`.
- Load `/checkout` while signed in with items in cart — renders the review page.

---

### Task 7: `Header` — hide cart button on `/checkout`

**Files:**
- Modify: `frontend/src/components/Header.jsx`

- [ ] **Step 1: Use `useLocation` and conditionally render**

Replace file contents:

```jsx
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';

export default function Header({ cartCount = 0, onCartClick }) {
  const { user, openLogin, signOut } = useAuth();
  const { pathname } = useLocation();
  const showCart = pathname !== '/checkout';

  return (
    <header className="site-header">
      <div className="header-left">
        <button className="icon-btn" aria-label="Open menu">
          <span className="hamburger" />
        </button>
        <div className="logo" aria-hidden="true">BB</div>
      </div>

      <h1 className="site-title">Brooklyn Bakery</h1>

      <div className="header-right">
        <button
          className="login-btn"
          onClick={user ? signOut : openLogin}
          title={user?.email}
        >
          <span>{user ? 'Log out' : 'Log in'}</span>
        </button>
        {showCart && (
          <button
            className="icon-btn cart-btn"
            aria-label={`Open cart (${cartCount} items)`}
            onClick={onCartClick}
          >
            <span className="cart-icon" aria-hidden="true">🛒</span>
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        )}
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Verify**

Navigate to `/checkout` — cart icon disappears from the header. Navigate back — it reappears.

---

### Task 8: `CartDrawer` — close on checkout click

**Files:**
- Modify: `frontend/src/components/CartDrawer.jsx`

- [ ] **Step 1: Wrap the checkout click**

In `CartDrawer.jsx`, add a small handler and use it on the checkout button. Insert after `const { requestCheckout } = useAuth();`:

```jsx
const handleCheckout = () => {
  onClose();
  requestCheckout();
};
```

Change the button's `onClick`:

```jsx
<button className="checkout-btn" onClick={handleCheckout}>
  Checkout
</button>
```

Rationale: `cartOpen` state lives in `App.jsx` and persists across navigation. Without closing, returning to `/` would re-open the drawer.

- [ ] **Step 2: Verify**

- Signed in, items in cart → open drawer → click Checkout → navigates to `/checkout`.
- Click "Back to shop" → lands on `/` with drawer closed.

---

### Task 9: Docs updates

**Files:**
- Modify: `docs/data-and-api.md`
- Modify: `docs/architecture.md`
- Modify: `docs/file-map.md`

- [ ] **Step 1: `docs/data-and-api.md` — add `GET /me`**

In the API table (around line 82-92), add a new row for `GET /me`. Insert after the `GET /products` row:

```markdown
| GET | `/me` | user | `meController.getMe` | `{ user: { id, email, displayName, balance, role } }` |
```

Also update the `server.js` snippet block near the bottom of the file to include the new mount:

```js
app.use('/products', productsRoutes);
app.use('/me', requireAuth, meRoutes);
app.use('/orders', requireAuth, orderRoutes);
app.use('/cart', requireAuth, cartRoutes);
app.use('/admin', requireAuth, requireAdmin, adminRoutes);
```

- [ ] **Step 2: `docs/architecture.md` — checkout flow + profile source**

Append a new "Checkout flow" subsection after the "Order creation" section:

```markdown
## Checkout flow

The cart drawer's Checkout button calls `AuthProvider.requestCheckout`, which either opens the login modal (signed-out) or navigates to `/checkout`. `CheckoutPage` (`frontend/src/pages/CheckoutPage.jsx`) renders the review state: line items with qty controls, subtotal, current balance, and balance-after-purchase. The "Place order" button is disabled when the cart is empty, submitting, profile is still loading, or the balance is insufficient. On click it calls `POST /orders`, then clears the local cart, refreshes the profile, and swaps to a success state. Errors render inline (no `alert`).

The current balance is sourced from `GET /me`, which returns the authenticated user's profile. `AuthProvider` fetches it whenever the session's access token changes (initial load, sign-in, token refresh) and exposes `profile` + `refreshProfile()` on the context.
```

Also update the AuthProvider bullet in the "Auth" section (line 23) — it currently lists exported functions. Add `refreshProfile` to that list and add `profile` to the state mentioned:

```markdown
- `frontend/src/auth/AuthProvider.jsx` owns `session` / `user` / `profile`, subscribes to `supabase.auth.onAuthStateChange`, and exposes `signIn`, `signUp`, `signOut`, `openLogin`, `requestCheckout`, `refreshProfile`, plus cart-sync helpers (`mergeAndHydrateCart`, `fetchServerCart`, `syncCartItem`, `clearServerCart`).
```

- [ ] **Step 3: `docs/file-map.md` — add new files**

In the `backend/` table, add:

```markdown
| `routes/meRoutes.js` | `GET /` |
| `controllers/meController.js` | Authenticated profile fetch (`GET /me`) |
```

Place them alphabetically (mRoutes near the other routes, meController near the other controllers).

In the `frontend/` table, add:

```markdown
| `src/pages/CheckoutPage.jsx` | Checkout review page: line items with qty controls, balance, balance-after, place-order |
```

Place it next to `HomePage.jsx`.

Also update the `src/App.jsx` row — its current description says "owns cart drawer + category nav state". Change to reflect routing:

```markdown
| `src/App.jsx` | Top-level layout + routes (`/`, `/checkout`); owns cart state and cart-drawer/category-nav visibility on `/` |
```

And `src/main.jsx`:

```markdown
| `src/main.jsx` | React root; wraps `<App />` in `<BrowserRouter>` and `<AuthProvider>` |
```

- [ ] **Step 4: Skim**

Re-read each modified doc top-to-bottom to catch any remaining stale references (e.g., claims that checkout happens in the drawer).

---

### Task 10: Full manual verification

No code changes in this task — walk through every scenario before committing.

- [ ] **Signed out:**
  - Load `/checkout` directly → redirects to `/`.
  - Open drawer, click Checkout → login modal opens with "checkout" reason.

- [ ] **Signed in, empty cart:**
  - `/checkout` direct URL → "Your cart is empty" + "Back to shop" button works.

- [ ] **Signed in, items in cart, sufficient balance:**
  - Drawer Checkout → navigates to `/checkout`, drawer closed, cart icon hidden from header.
  - Items render with qty controls and Remove.
  - Subtotal, current balance, balance-after correct.
  - Click `+` → subtotal + balance-after update. Server cart updates (check network tab for `PUT /cart/items/...`).
  - Click Remove → item disappears. If last item, empty-cart state renders.
  - Click "Place order" → success state shows order id + new balance. Nav back to `/` → cart empty, balance updated.

- [ ] **Signed in, insufficient balance:**
  - Balance-after shows warning ("Not enough points").
  - "Place order" button disabled.

- [ ] **Error paths:**
  - Stop the backend (`Ctrl-C`) → click Place order → "Could not reach the server." inline; cart intact.
  - Restart backend, race an admin cancel or manual DB balance decrement to trigger 402, click Place order → "Not enough points…" inline; cart intact.

- [ ] **Profile loading:**
  - Hard-reload `/checkout` with a live session → summary shows "Loading…" briefly, then balance.

- [ ] **Lint + build:**

```bash
cd frontend && npm run lint && npm run build
```

Expected: no lint errors, build succeeds.

---

### Task 11: Single commit (spec + plan + code + docs)

**Files:** everything modified or created across tasks 1-9, plus:
- `docs/superpowers/specs/2026-04-20-checkout-page-design.md` (already written, uncommitted)
- `docs/superpowers/plans/2026-04-20-checkout-page.md` (this file)

- [ ] **Step 1: Review `git status`**

```bash
git status
```

Expected untracked:
- `docs/superpowers/specs/2026-04-20-checkout-page-design.md`
- `docs/superpowers/plans/2026-04-20-checkout-page.md`
- `backend/controllers/meController.js`
- `backend/routes/meRoutes.js`
- `frontend/src/pages/CheckoutPage.jsx`

Expected modified:
- `backend/server.js`
- `frontend/package.json`, `frontend/package-lock.json`
- `frontend/src/App.jsx`
- `frontend/src/App.css`
- `frontend/src/auth/AuthProvider.jsx`
- `frontend/src/hooks/useCart.js`
- `frontend/src/main.jsx`
- `frontend/src/components/Header.jsx`
- `frontend/src/components/CartDrawer.jsx`
- `docs/data-and-api.md`
- `docs/architecture.md`
- `docs/file-map.md`

- [ ] **Step 2: Stage explicitly**

```bash
git add \
  docs/superpowers/specs/2026-04-20-checkout-page-design.md \
  docs/superpowers/plans/2026-04-20-checkout-page.md \
  backend/controllers/meController.js \
  backend/routes/meRoutes.js \
  backend/server.js \
  frontend/package.json \
  frontend/package-lock.json \
  frontend/src/main.jsx \
  frontend/src/App.jsx \
  frontend/src/App.css \
  frontend/src/auth/AuthProvider.jsx \
  frontend/src/hooks/useCart.js \
  frontend/src/pages/CheckoutPage.jsx \
  frontend/src/components/Header.jsx \
  frontend/src/components/CartDrawer.jsx \
  docs/data-and-api.md \
  docs/architecture.md \
  docs/file-map.md
```

Avoid `git add -A` per project convention.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(checkout): add /checkout review page with balance-aware place order

Adds GET /me for profile + balance, introduces react-router with a
dedicated /checkout review page (item edits, balance, balance-after,
place-order → success state), and moves order creation out of the
cart drawer's requestCheckout into the page.
EOF
)"
```

- [ ] **Step 4: Verify**

```bash
git status && git log -1 --stat
```

Expected: working tree clean; single new commit showing all the files above.

Do NOT push. User will decide when to push.

---

## Self-review notes

- Spec coverage: every section of the spec maps to a task (GET /me → 1; router → 2, 6; AuthProvider → 3; useCart → 4; CheckoutPage → 5; Header → 7; CartDrawer close → 8; docs → 9; commit → 11).
- No per-task commits per user directive; final commit bundles spec + plan + code + docs.
- No tests per user directive; manual verification in Task 10.
- `refreshProfile` lifecycle handled via a dedicated effect on `session?.access_token`, not inside the `onAuthStateChange` callback (avoids stale closures).
- `Place order` disabled state covers: empty cart, submitting, profile still loading, insufficient balance — matches spec update.
