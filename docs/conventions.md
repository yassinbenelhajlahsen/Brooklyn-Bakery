# Conventions

## Backend

- **ESM.** `backend/package.json` sets `"type": "module"`. Relative imports must include the `.js` extension (e.g. `import { prisma } from '../lib/prisma.js'`).
- **Layering.** `routes/` defines thin routers; `controllers/` handle HTTP (parse request, call service/Prisma, shape response, map errors); `services/` host multi-step business logic — anything wrapped in a `$transaction` or orchestrating more than one Prisma call belongs here; `lib/` holds pure helpers and shared clients. No repository layer — services call Prisma directly. Single-call endpoints (e.g. `listMyOrders`, `getCart`, `upsertCartItem`) stay in the controller; promote to a service only when there's real orchestration to extract.
- **Errors.** Throw `httpError(status, msg)` from `backend/lib/httpError.js` inside services and controllers. Translate with `sendHttpError(res, err)` at the controller catch boundary. Unexpected errors fall through to a 500 with a generic message; the real error is `console.error`'d.
- **Prisma selects.** Keep response shapes stable by defining `PRODUCT_SELECT` (or similar) constants at the top of the module that owns the query and reusing them across endpoints — see `backend/controllers/cartController.js` and `backend/services/cartService.js`.
- **Prisma client.** Always import the singleton from `backend/lib/prisma.js`. Do not call `new PrismaClient()` anywhere else; the singleton attaches to `globalThis` in development to survive nodemon reloads.
- **Enums.** Use Prisma's generated enums (`OrderStatus`, `UserRole`, `ProductType`) via `import { OrderStatus } from '@prisma/client'` rather than string literals.
- **DB naming.** The DB is snake_case (`user_id`, `image_url`, `created_at`); JS is camelCase. Prisma bridges with `@map`/`@@map` — respect the existing mappings when adding fields.

## Tests

- Backend uses Node's built-in `node:test` + `node:assert/strict`. No Jest or Vitest.
- One test file per lib module: `backend/tests/<name>.test.js`. Pure functions first — see `backend/tests/cart.test.js` for the style.
- Run everything: `npm test` (from `backend/`). Run one file: `node --test backend/tests/cart.test.js`.

## Money

- `price`, `balance`, `total`, and `unit_price` are all `INT` — integer "points". Do not introduce `Decimal`, `Number`-as-float, or currency strings.
- `order_items.unit_price` is a snapshot captured at order time. Do not derive totals from `products.price` when reading historical orders.

## Frontend

- React 19 + Vite, ESM, function components only.
- ESLint is flat-config (`frontend/eslint.config.js`) with `no-unused-vars` set to ignore variables matching `^[A-Z_]` (e.g., unused constants and React internals).
- `AuthProvider.jsx` has a top-of-file `/* eslint-disable react-refresh/only-export-components */` because it exports both a component and context. When adding similar providers, prefer splitting the hook into its own file (`useAuth.js` pattern) over disabling the rule.
- Vite dev server is pinned to `127.0.0.1:5173` (`frontend/vite.config.js`); the backend CORS allowlist matches. Change both together.
- **Styling.** Tailwind CSS utility classes are used throughout. Shared class strings live in `src/lib/styles.js` (e.g. `ICON_BTN`) — add to that file when the same combination is needed in 2+ places. There is no `App.css`; base resets and CSS custom properties (tokens like `--color-ink`, `--color-cream`) are defined in `src/index.css`.

### Frontend layering

- **`services/`** — pure async API functions. Signature: `(authedFetch, ...args) => Promise<T>`. No React, no context, no module-level fetch client. Errors either return `null` (best-effort) or throw a typed error (e.g. `PlaceOrderError` in `orderService.js`).
- **`hooks/`** — stateful wrappers. A hook reads `authedFetch` from `useAuth()` on each render and passes it into services at call time — don't snapshot `authedFetch` into a ref or closure, or token refresh breaks.
- **`lib/`** — pure helpers (math, transforms, constants). No React imports. Mirror backend helper names where parallel (`computeCartSubtotal` ↔ `computeCartTotal`).
- **Components** consume hooks; they don't import from `services/` directly.
- **Subdirectories for large feature surfaces.** When a feature adds three or more service/hook files, nest them under a subdirectory (`services/admin/`, `hooks/admin/`). Small features stay flat. `components/admin/` and `components/icons/` follow the same rule. The default is still flat — only nest when the feature has its own vocabulary.

### Admin mutation pattern (in-place list updates)

Admin hooks don't refetch the full list after a mutation — the backend returns the updated entity and the hook splices it into local state. If an active filter would exclude the updated item (e.g. status filter on orders, `includeArchived=false` on a newly-archived product), drop it from the list instead. Initial loads and explicit "Refresh" clicks still call the list endpoint. Pattern lives in `hooks/admin/useAdminOrders.js`, `useAdminProducts.js`, `useAdminUsers.js` — copy the shape when adding new admin mutations.

## Environment variables

- `VITE_*` → frontend only, and public (they ship in the bundle).
- Bare names → backend only; may be secret. `SUPABASE_SECRET_KEY` must never reach the frontend.
- `.env` files are gitignored (`!.env.example`). Commit `.env.example` when adding a new variable.

## Git / commits

Observed commit style on recent history:

```
feat(<scope>): <lowercase summary>
```

Scopes in use: `backend`, `frontend`, `db`. Keep summaries short and lowercase.

Per `docs/superpowers/`-driven work, design specs and the matching implementation plan are committed together in a single bundled commit — not as two separate docs commits.
