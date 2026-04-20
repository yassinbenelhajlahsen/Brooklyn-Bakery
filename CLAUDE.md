# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Brooklyn Bakery is a small e-commerce demo: a React/Vite frontend and an Express/Prisma backend backed by Supabase (Postgres + Auth). Users buy baked goods by spending integer points from their account balance.

## Commands

From repo root:
- `npm run dev` — run frontend and backend concurrently

From `backend/`:
- `npm run dev` — nodemon on `server.js`
- `npm test` — all tests (`node --test 'tests/**/*.test.js'`)
- Single test file: `node --test backend/tests/cart.test.js`
- `npm run db:migrate` — apply Prisma migrations (dev)
- `npm run db:migrate:deploy` — apply migrations (prod)
- `npm run db:seed` — run `prisma/seed.js` (idempotent; upserts products by name)
- `npm run db:studio` — open Prisma Studio
- `npm run db:generate` — regenerate the Prisma client after schema changes

From `frontend/`:
- `npm run dev` — Vite dev server on `127.0.0.1:5173`
- `npm run build` — production build
- `npm run lint` — ESLint (no root-level lint command)
- `npm run preview` — preview the build

The backend has tests (`node:test`); the frontend has none. There is no root-level `test` script.

## Documentation routing

Keep this file terse. Deeper documentation lives in `docs/`:

- **Big-picture architecture** (auth flow, cart lifecycle, order transaction): `docs/architecture.md`
- **Code conventions** (ESM, Prisma singleton, integer prices, commit style): `docs/conventions.md`
- **Annotated file map**: `docs/file-map.md`
- **Schema + API endpoint reference**: `docs/data-and-api.md`
- **Design specs / historical implementation plans**: `docs/superpowers/specs/` and `docs/superpowers/plans/` (source of truth for *why* the schema and auth look the way they do)

## Gotchas worth knowing before editing

- Backend is ESM (`"type": "module"` in `backend/package.json`). Relative imports must include the `.js` extension.
- The Prisma client is a module-level singleton at `backend/lib/prisma.js`. Import from there; do not instantiate `new PrismaClient()` elsewhere.
- Prices, balances, order totals, and unit prices are **integers** (points). Do not introduce `Decimal` or floats.
- Middleware order matters: `requireAuth` must run before `requireAdmin`. See `backend/server.js`.
- `createOrder` (`backend/controllers/orderController.js`) locks the user balance row with a raw `SELECT … FOR UPDATE` inside a transaction to serialize concurrent orders. Do not remove that lock if you refactor order creation.
- `public.users` rows are created by a Postgres trigger on `auth.users` insert (see the `supabase_integration` migration). Do not add API code that creates profile rows.
- Authorization is enforced at the Express layer only. RLS is intentionally not used — the backend connects as the Supabase service role and bypasses RLS.
- `VITE_*` env vars are public (frontend). Bare names in `backend/.env` may be secret; `SUPABASE_SECRET_KEY` must never reach the browser.
