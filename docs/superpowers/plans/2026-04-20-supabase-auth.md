# Supabase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase email/password authentication with a login modal, gate `/orders` on the backend, and make checkout the frontend gate — while keeping cart client-side and persisted in `localStorage`.

**Architecture:** Frontend wraps the app in an `AuthProvider` (React Context) exposing `user`, `session`, `signIn`, `signUp`, `signOut`, `openLogin`, `requestCheckout`. Supabase JS SDK handles session storage and token refresh. Backend adds a `requireAuth` middleware that verifies user JWTs via `supabase.auth.getUser(token)` and protects a stub `POST /orders`. Cart is lazy-initialized from and written to `localStorage`.

**Tech Stack:** React 19, Vite, Express 5, `@supabase/supabase-js` v2, Supabase Auth (new API key format: `sb_publishable_*` / `sb_secret_*`).

**Spec:** `docs/superpowers/specs/2026-04-20-supabase-auth-design.md`

**Note on testing:** This project has no test framework. Per the spec, we don't introduce one. Each task has an explicit manual verification step (curl, browser action, or node script). The TDD structure is replaced by a verify-then-commit rhythm.

---

## File Map

**Created**
- `frontend/src/lib/supabase.js` — Supabase client singleton (publishable key)
- `frontend/src/auth/AuthProvider.jsx` — React Context + session management
- `frontend/src/auth/useAuth.js` — hook reading the context
- `frontend/src/components/LoginModal.jsx` — modal with Log in / Sign up tabs
- `frontend/.env.example` — env template
- `backend/lib/supabase.js` — admin client (secret key)
- `backend/middleware/requireAuth.js` — JWT verifier
- `backend/routes/orderRoutes.js` — `POST /`
- `backend/controllers/orderController.js` — stub order handler

**Modified**
- `frontend/package.json` — add `@supabase/supabase-js`
- `frontend/src/main.jsx` — wrap in `<AuthProvider>`
- `frontend/src/App.jsx` — cart localStorage persistence + render `<LoginModal>`
- `frontend/src/components/Header.jsx` — login/logout control
- `frontend/src/components/CartDrawer.jsx` — `handleCheckout` calls `requestCheckout`
- `frontend/src/App.css` — styles for modal + login/logout button (minimal additions)
- `backend/package.json` — add `@supabase/supabase-js`
- `backend/.env.example` — add `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- `backend/server.js` — mount `/orders` with `requireAuth`

**Already covered (no change)**
- Root `.gitignore` — already ignores `.env`/`.env.*` at any depth with `!.env.example`

---

## Task 1: Create Supabase project and record keys (manual, out-of-code)

**Files:** none (manual dashboard work)

- [ ] **Step 1: Create the project**

In the Supabase dashboard (https://supabase.com/dashboard), create a new project. Wait for provisioning to complete.

- [ ] **Step 2: Configure email auth**

Go to **Authentication → Providers → Email**. Ensure **Enable** is ON. Turn **Confirm email** OFF. Save.

- [ ] **Step 3: Record three values**

Go to **Project Settings → API Keys** and copy:
- **Project URL** (format: `https://xxxx.supabase.co`)
- **Publishable key** (starts with `sb_publishable_`)
- **Secret key** (starts with `sb_secret_`) — create one if none exists

**Do not use legacy `anon` / `service_role` JWT keys.** They are deprecated.

Keep these three values in a scratch file for the next tasks. They will go in `.env` files — never committed.

- [ ] **Step 4: Verify**

Supabase dashboard shows the Email provider enabled, Confirm email disabled, and at least one publishable + one secret key exists.

No commit (no repo changes).

---

## Task 2: Install Supabase SDK in frontend and backend

**Files:**
- Modify: `frontend/package.json`
- Modify: `backend/package.json`

- [ ] **Step 1: Install in frontend**

Run: `npm install @supabase/supabase-js --prefix frontend`

Expected: `@supabase/supabase-js` added to `frontend/package.json` dependencies at ^2.x.

- [ ] **Step 2: Install in backend**

Run: `npm install @supabase/supabase-js --prefix backend`

Expected: same package appears in `backend/package.json`.

- [ ] **Step 3: Verify**

Run: `grep '"@supabase/supabase-js"' frontend/package.json backend/package.json`

Expected: both files show the dependency.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json backend/package.json backend/package-lock.json
git commit -m "chore: add @supabase/supabase-js to frontend and backend"
```

---

## Task 3: Backend env template

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Extend the example file**

Replace `backend/.env.example` contents with:

```
PORT=3000
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

- [ ] **Step 2: Create your local .env**

Run: `cp backend/.env.example backend/.env`, then fill in the real values from Task 1. `backend/.env` is gitignored (root `.gitignore` already handles it).

- [ ] **Step 3: Verify**

Run: `cat backend/.env.example` — confirm the three variables are listed.
Run: `git status --ignored backend/.env` — confirm it shows as ignored, not tracked.

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example
git commit -m "chore: document Supabase env vars in backend/.env.example"
```

---

## Task 4: Backend Supabase admin client

**Files:**
- Create: `backend/lib/supabase.js`

- [ ] **Step 1: Create `backend/lib/supabase.js`**

```javascript
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment');
}

export const supabaseAdmin = createClient(url, secretKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
```

The `auth` options disable session state on the server — the backend never "logs in" as a user; it just verifies tokens.

- [ ] **Step 2: Verify it loads**

Run: `node --input-type=module -e "import('./backend/lib/supabase.js').then(m => console.log('ok', !!m.supabaseAdmin))"` from the repo root.

Expected: prints `ok true`.

If it prints an error about missing env vars, confirm `backend/.env` exists with real values. (`dotenv/config` reads from the current working directory — run from inside `backend/`: `cd backend && node --input-type=module -e "import('./lib/supabase.js').then(m => console.log('ok', !!m.supabaseAdmin))"`.)

- [ ] **Step 3: Commit**

```bash
git add backend/lib/supabase.js
git commit -m "feat(backend): add Supabase admin client"
```

---

## Task 5: Backend `requireAuth` middleware

**Files:**
- Create: `backend/middleware/requireAuth.js`

- [ ] **Step 1: Create the middleware**

```javascript
import { supabaseAdmin } from '../lib/supabase.js';

export async function requireAuth(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({ error: 'Missing token' });
    }

    if (!header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Invalid auth header' });
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
        return res.status(401).json({ error: 'Missing token' });
    }

    let data, error;
    try {
        ({ data, error } = await supabaseAdmin.auth.getUser(token));
    } catch (err) {
        console.error('Supabase getUser failed:', err.message);
        return res.status(503).json({ error: 'Auth service unavailable' });
    }

    if (error || !data?.user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = { id: data.user.id, email: data.user.email };
    next();
}
```

- [ ] **Step 2: Verify it imports cleanly**

Run from `backend/`:
```bash
node --input-type=module -e "import('./middleware/requireAuth.js').then(m => console.log('ok', typeof m.requireAuth))"
```

Expected: prints `ok function`.

- [ ] **Step 3: Commit**

```bash
git add backend/middleware/requireAuth.js
git commit -m "feat(backend): add requireAuth middleware verifying Supabase JWTs"
```

---

## Task 6: Backend orders controller and route

**Files:**
- Create: `backend/controllers/orderController.js`
- Create: `backend/routes/orderRoutes.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Create the controller**

```javascript
// backend/controllers/orderController.js
export async function createOrder(req, res) {
    console.log(`[orders] user=${req.user.id} items=${JSON.stringify(req.body)}`);
    res.status(200).json({ ok: true, received: req.body });
}
```

- [ ] **Step 2: Create the route file**

```javascript
// backend/routes/orderRoutes.js
import express from 'express';
import { createOrder } from '../controllers/orderController.js';

const router = express.Router();

router.post('/', createOrder);

export default router;
```

- [ ] **Step 3: Wire into `server.js`**

In `backend/server.js`, add the import alongside existing imports:

```javascript
import orderRoutes from './routes/orderRoutes.js';
import { requireAuth } from './middleware/requireAuth.js';
```

And register the route after the existing `app.use('/products', ...)` line:

```javascript
app.use('/orders', requireAuth, orderRoutes);
```

- [ ] **Step 4: Run the backend**

Run: `npm run dev --prefix backend`

Expected: `Server is running on http://127.0.0.1:3000` with no errors.

- [ ] **Step 5: Verify anonymous access is blocked**

In another terminal:
```bash
curl -i -X POST http://127.0.0.1:3000/orders -H "Content-Type: application/json" -d '{"test":true}'
```

Expected: `HTTP/1.1 401 Unauthorized` with body `{"error":"Missing token"}`.

Also try:
```bash
curl -i -X POST http://127.0.0.1:3000/orders -H "Authorization: Bearer garbage" -H "Content-Type: application/json" -d '{"test":true}'
```

Expected: `HTTP/1.1 401 Unauthorized` with body `{"error":"Invalid token"}`.

- [ ] **Step 6: Stop the backend and commit**

Ctrl-C the server.

```bash
git add backend/controllers/orderController.js backend/routes/orderRoutes.js backend/server.js
git commit -m "feat(backend): add protected POST /orders stub"
```

---

## Task 7: Frontend env template

**Files:**
- Create: `frontend/.env.example`

- [ ] **Step 1: Create the file**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

- [ ] **Step 2: Create your local .env**

Run: `cp frontend/.env.example frontend/.env`, then fill in the URL and **publishable** key (`sb_publishable_...`) from Task 1. Not the secret key — never put the secret key in frontend.

- [ ] **Step 3: Verify**

Run: `git status --ignored frontend/.env` — confirm it's ignored.

- [ ] **Step 4: Commit**

```bash
git add frontend/.env.example
git commit -m "chore: add frontend/.env.example for Supabase vars"
```

---

## Task 8: Frontend Supabase client

**Files:**
- Create: `frontend/src/lib/supabase.js`

- [ ] **Step 1: Create the file**

```javascript
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
}

export const supabase = createClient(url, publishableKey);
```

- [ ] **Step 2: Verify Vite can load it**

Run: `npm run dev --prefix frontend`

Expected: Vite starts cleanly on http://localhost:5173. Open the browser to http://localhost:5173 — the existing app renders normally (we haven't imported the client anywhere yet, so it isn't bundled).

- [ ] **Step 3: Stop Vite and commit**

Ctrl-C Vite.

```bash
git add frontend/src/lib/supabase.js
git commit -m "feat(frontend): add Supabase client singleton"
```

---

## Task 9: AuthProvider + useAuth hook

**Files:**
- Create: `frontend/src/auth/AuthProvider.jsx`
- Create: `frontend/src/auth/useAuth.js`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Create `AuthProvider.jsx`**

```jsx
import { createContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000';

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [loginOpen, setLoginOpen] = useState(false);
    const [pendingCheckout, setPendingCheckout] = useState(null);
    const [lastOrderResult, setLastOrderResult] = useState(null);
    const inFlight = useRef(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setUser(data.session?.user ?? null);
        });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
            setSession(next);
            setUser(next?.user ?? null);
            if (!next) setPendingCheckout(null);
        });

        return () => listener.subscription.unsubscribe();
    }, []);

    const signIn = (email, password) =>
        supabase.auth.signInWithPassword({ email, password });

    const signUp = (email, password) =>
        supabase.auth.signUp({ email, password });

    const signOut = () => supabase.auth.signOut();

    const openLogin = () => setLoginOpen(true);
    const closeLogin = () => {
        setLoginOpen(false);
        setPendingCheckout(null);
    };

    const submitOrder = async (cart, accessToken) => {
        inFlight.current = true;
        try {
            const res = await fetch(`${API_BASE}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(cart),
            });
            if (res.status === 401) {
                await supabase.auth.signOut();
                setLoginOpen(true);
                setLastOrderResult({ error: 'Session expired, please log in again.' });
                return;
            }
            const body = await res.json();
            setLastOrderResult(body);
        } catch (err) {
            setLastOrderResult({ error: `Checkout failed: ${err.message}` });
        } finally {
            inFlight.current = false;
        }
    };

    const requestCheckout = (cart) => {
        if (user && session?.access_token) {
            submitOrder(cart, session.access_token);
        } else {
            setPendingCheckout(cart);
            setLoginOpen(true);
        }
    };

    useEffect(() => {
        if (user && session?.access_token && pendingCheckout && !inFlight.current) {
            const cart = pendingCheckout;
            setPendingCheckout(null);
            setLoginOpen(false);
            submitOrder(cart, session.access_token);
        }
    }, [user, session, pendingCheckout]);

    const value = {
        user,
        session,
        loginOpen,
        openLogin,
        closeLogin,
        signIn,
        signUp,
        signOut,
        requestCheckout,
        lastOrderResult,
        clearOrderResult: () => setLastOrderResult(null),
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 2: Create `useAuth.js`**

```javascript
import { useContext } from 'react';
import { AuthContext } from './AuthProvider.jsx';

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
```

- [ ] **Step 3: Wrap the app**

Modify `frontend/src/main.jsx`. It currently imports `App` and renders it. Wrap `<App />` in `<AuthProvider>`. For example, if the current file is:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Change to:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
```

(If the current `main.jsx` differs, apply the same two edits: add the import, wrap `<App />`.)

- [ ] **Step 4: Verify in browser**

Run: `npm run dev --prefix frontend`. Open http://localhost:5173. The homepage renders as before. Open devtools console — no errors. The provider should be initializing; no visible change yet.

- [ ] **Step 5: Stop Vite and commit**

```bash
git add frontend/src/auth/AuthProvider.jsx frontend/src/auth/useAuth.js frontend/src/main.jsx
git commit -m "feat(frontend): add AuthProvider and useAuth hook"
```

---

## Task 10: LoginModal component

**Files:**
- Create: `frontend/src/components/LoginModal.jsx`
- Modify: `frontend/src/App.jsx` (render the modal)
- Modify: `frontend/src/App.css` (minimal modal styles)

- [ ] **Step 1: Create `LoginModal.jsx`**

```jsx
import { useState } from 'react';
import { useAuth } from '../auth/useAuth.js';

export default function LoginModal() {
    const { loginOpen, closeLogin, signIn, signUp } = useAuth();
    const [tab, setTab] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    if (!loginOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const { error } = tab === 'login'
                ? await signIn(email, password)
                : await signUp(email, password);
            if (error) setError(error.message);
            // On success, onAuthStateChange will update user and the
            // pendingCheckout effect (if any) will close this modal.
        } catch (err) {
            setError('Could not reach auth server, please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="login-overlay" onClick={closeLogin} role="presentation">
            <div
                className="login-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={tab === 'login' ? 'Log in' : 'Sign up'}
            >
                <button className="icon-btn login-close" onClick={closeLogin} aria-label="Close">×</button>
                <div className="login-tabs">
                    <button
                        className={`login-tab ${tab === 'login' ? 'is-active' : ''}`}
                        onClick={() => { setTab('login'); setError(null); }}
                    >
                        Log in
                    </button>
                    <button
                        className={`login-tab ${tab === 'signup' ? 'is-active' : ''}`}
                        onClick={() => { setTab('signup'); setError(null); }}
                    >
                        Sign up
                    </button>
                </div>
                <form className="login-form" onSubmit={handleSubmit}>
                    <label>
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </label>
                    <label>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                            minLength={6}
                        />
                    </label>
                    {error && <div className="login-error">{error}</div>}
                    <button type="submit" className="login-submit" disabled={busy}>
                        {busy ? '...' : (tab === 'login' ? 'Log in' : 'Create account')}
                    </button>
                </form>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Render the modal in App**

Modify `frontend/src/App.jsx`. Add the import at the top:

```jsx
import LoginModal from './components/LoginModal.jsx'
```

And render `<LoginModal />` at the end of the `<div className="app">` block, after `<CartDrawer />`:

```jsx
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
```

- [ ] **Step 3: Add minimal styles**

Append to `frontend/src/App.css`:

```css
.login-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}
.login-modal {
    position: relative;
    background: #fff;
    border-radius: 10px;
    padding: 24px 28px;
    min-width: 320px;
    max-width: 90vw;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}
.login-close {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 22px;
    background: none;
    border: none;
    cursor: pointer;
}
.login-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    border-bottom: 1px solid #eee;
}
.login-tab {
    background: none;
    border: none;
    padding: 8px 12px;
    cursor: pointer;
    color: #666;
    border-bottom: 2px solid transparent;
}
.login-tab.is-active {
    color: #000;
    border-bottom-color: #000;
}
.login-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.login-form label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
}
.login-form input {
    padding: 8px 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 14px;
}
.login-error {
    color: #b00020;
    font-size: 13px;
}
.login-submit {
    margin-top: 4px;
    padding: 10px;
    background: #222;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
}
.login-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
```

- [ ] **Step 4: Build-clean check**

No UI yet calls `openLogin()` — that's wired up in Task 11. For this task, just confirm the build is clean.

Run: `npm run dev --prefix frontend`. Expected: no build errors in the Vite terminal, no errors in the browser console at http://localhost:5173. The page looks the same as before (modal hidden because `loginOpen === false`).

- [ ] **Step 5: Stop Vite and commit**

```bash
git add frontend/src/components/LoginModal.jsx frontend/src/App.jsx frontend/src/App.css
git commit -m "feat(frontend): add LoginModal with Log in / Sign up tabs"
```

---

## Task 11: Header login/logout control

**Files:**
- Modify: `frontend/src/components/Header.jsx`

Note: `Header.jsx` already has a non-functional `<button className="login-btn">Login</button>`. We're replacing that with a real, auth-aware control. No `App.css` changes needed — we reuse the existing `.login-btn` class.

- [ ] **Step 1: Rewrite Header.jsx**

Replace the entire file contents with:

```jsx
import { useAuth } from '../auth/useAuth.js';

export default function Header({ cartCount = 0, onCartClick }) {
  const { user, openLogin, signOut } = useAuth();

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
        {user ? (
          <button
            className="login-btn"
            onClick={() => signOut()}
            title={user.email}
          >
            <span className="avatar" aria-hidden="true" />
            <span>Log out</span>
          </button>
        ) : (
          <button className="login-btn" onClick={openLogin}>
            <span className="avatar" aria-hidden="true" />
            <span>Log in</span>
          </button>
        )}
        <button
          className="icon-btn cart-btn"
          aria-label={`Open cart (${cartCount} items)`}
          onClick={onCartClick}
        >
          <span className="cart-icon" aria-hidden="true">🛒</span>
          {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Verify signup + login in browser**

Run: `npm run dev` from the repo root (runs frontend + backend together via `concurrently`).

In the browser:
1. Click **Log in** in the header → modal opens.
2. Switch to **Sign up** tab, enter a fresh email + password (≥6 chars), submit.
3. Expected: modal closes automatically, header now shows **Log out**.
4. Click **Log out**. Expected: header shows **Log in** again.
5. Click **Log in**, enter the same credentials, submit. Expected: modal closes, header shows **Log out**.
6. Refresh the browser. Expected: still logged in (session survives via localStorage).
7. Log out, then refresh. Expected: still logged out.

If any step fails, fix before committing. Common failure: missing env vars (`Missing VITE_SUPABASE_URL...` in console) — re-check `frontend/.env`.

- [ ] **Step 3: Stop and commit**

```bash
git add frontend/src/components/Header.jsx
git commit -m "feat(frontend): wire header login button to auth state"
```

---

## Task 12: Cart localStorage persistence

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Replace cart initialization**

In `frontend/src/App.jsx`, find:

```jsx
const [cart, setCart] = useState({})
```

Replace with:

```jsx
const [cart, setCart] = useState(() => {
    try {
        const raw = localStorage.getItem('cart');
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
});
```

- [ ] **Step 2: Add a write-on-change effect**

Add this `useEffect` near the other state handlers (and add `useEffect` to the React import if not already there):

```jsx
useEffect(() => {
    try {
        localStorage.setItem('cart', JSON.stringify(cart));
    } catch {
        // private browsing / storage blocked — silently skip
    }
}, [cart]);
```

Update the import line from:

```jsx
import { useState, useMemo } from 'react'
```

to:

```jsx
import { useState, useMemo, useEffect } from 'react'
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev` from repo root. In the browser:
1. Add a few items to cart.
2. Refresh the page.
3. Expected: cart is preserved (counts and items still there).
4. Open devtools → Application → Local Storage → `http://localhost:5173` → should show a `cart` key with a JSON payload.
5. Click **Clear cart** in the drawer. Refresh. Cart is empty.

- [ ] **Step 4: Stop and commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): persist cart to localStorage"
```

---

## Task 13: Checkout gate + pending replay

**Files:**
- Modify: `frontend/src/components/CartDrawer.jsx`
- Modify: `frontend/src/App.jsx` (display order result)

- [ ] **Step 1: Wire CartDrawer checkout to `requestCheckout`**

In `frontend/src/components/CartDrawer.jsx`, add the hook import at the top:

```jsx
import { useAuth } from '../auth/useAuth.js';
```

Inside the component, replace:

```jsx
const handleCheckout = () => {
    alert(`Checkout: ${totalItems} item(s), $${subtotal.toFixed(2)}`)
}
```

With:

```jsx
const { requestCheckout } = useAuth();
const [submitting, setSubmitting] = useState(false);
const handleCheckout = async () => {
    setSubmitting(true);
    try {
        await requestCheckout(cart);
    } finally {
        setSubmitting(false);
    }
};
```

Import `useState` at the top of the file if it isn't already:

```jsx
import { useState } from 'react';
```

And update the checkout button to disable during submission:

```jsx
<button className="checkout-btn" onClick={handleCheckout} disabled={submitting}>
    {submitting ? 'Submitting...' : 'Checkout'}
</button>
```

- [ ] **Step 2: Display the last order result**

In `frontend/src/App.jsx`, import the hook and render a small banner when `lastOrderResult` is set. Near the top:

```jsx
import { useAuth } from './auth/useAuth.js'
```

Inside `App`, just after existing hooks:

```jsx
const { lastOrderResult, clearOrderResult } = useAuth();
```

Just before `<LoginModal />` (or wherever makes sense within the app `<div>`):

```jsx
{lastOrderResult && (
    <div className="order-banner" role="status" onClick={clearOrderResult}>
        {lastOrderResult.error ? (
            <span>⚠ {lastOrderResult.error}</span>
        ) : (
            <span>✓ Order received ({Object.keys(lastOrderResult.received ?? {}).length} line items). Click to dismiss.</span>
        )}
    </div>
)}
```

Append CSS to `frontend/src/App.css`:

```css
.order-banner {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: #222;
    color: #fff;
    padding: 10px 16px;
    border-radius: 8px;
    cursor: pointer;
    z-index: 900;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}
```

(The emoji in the order banner is intentional user-facing UX copy, not a comment in code.)

- [ ] **Step 3: Manual end-to-end test**

Run `npm run dev` from repo root. In the browser:

**Flow A — logged-out checkout:**
1. Sign out if logged in.
2. Add items to cart.
3. Click **Checkout**. Expected: login modal opens.
4. Log in with existing account.
5. Expected: modal closes, a confirmation banner appears ("Order received (N line items)").
6. Check the backend terminal — expected: a log line `[orders] user=<uuid> items={...}`.

**Flow B — logged-in checkout:**
1. Already logged in. Add items to cart.
2. Click **Checkout**. Expected: banner appears immediately, no modal.
3. Backend logs the order.

**Flow C — dismiss modal without logging in:**
1. Sign out. Add items to cart.
2. Click **Checkout** → modal opens.
3. Click the × or the overlay. Expected: modal closes, no order submitted, cart unchanged.

**Flow D — curl blocked:**
```bash
curl -i -X POST http://127.0.0.1:3000/orders -H "Content-Type: application/json" -d '{}'
```
Expected: 401.

**Flow E — expired/invalid token:**
1. Logged in, open devtools → Application → Local Storage → find the Supabase session key (looks like `sb-<project>-auth-token`).
2. Edit one character inside the JWT.
3. Add items and click Checkout. Expected: banner shows "Session expired, please log in again." Login modal reopens.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/CartDrawer.jsx frontend/src/App.jsx frontend/src/App.css
git commit -m "feat(frontend): gate checkout on auth with pending-intent replay"
```

---

## Task 14: Final manual test sweep and docs

**Files:** none (or `devLog.txt` if you'd like to add a version entry)

- [ ] **Step 1: Run the full manual checklist from the spec**

Work through each step in the spec's **Testing (manual)** section:

1. `curl -X POST http://localhost:3000/orders ...` → 401 ✓
2. Sign up fresh email → immediate login ✓
3. Log out → refresh → still logged out ✓
4. Log in → refresh → still logged in ✓
5. Logged-out checkout replay works ✓
6. Logged-in checkout submits directly ✓
7. Tampered token → 401 → modal reopens ✓
8. Two tabs, logout in one → other reflects logout ✓
9. Add items → refresh → cart survives ✓
10. Private browsing → app works, cart doesn't persist (manually verify by opening an incognito window) ✓

Fix any discovered issues before moving on.

- [ ] **Step 2 (optional): Update devLog.txt**

Append a v0.2.0 entry describing the login/auth addition. Style should match the existing entry.

- [ ] **Step 3: Commit if changes made**

```bash
git add devLog.txt
git commit -m "docs: log v0.2.0 Supabase auth additions"
```

If no devLog changes, skip the commit.

- [ ] **Step 4: Review branch state**

Run: `git log --oneline main..HEAD`

Expected: a clean sequence of focused commits covering each task.

---

## Done

Auth gate is live. Unauthenticated curl can't hit `/orders`. The login modal opens when guests click Checkout, and their intent replays automatically after login. When Postgres is introduced later, new protected endpoints just mount `requireAuth`; the frontend already carries the bearer token.
