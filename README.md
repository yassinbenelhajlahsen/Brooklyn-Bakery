# Brooklyn Bakery

A small e-commerce app where signed-in users buy baked goods with integer "points" from their account balance.

- **Frontend:** React 19 + Vite (`frontend/`)
- **Backend:** Express 5 + Prisma (`backend/`)
- **Data & Auth:** Supabase (Postgres + Auth)

## Prerequisites

- Node.js (ESM; version that supports `node --test` — Node 20+ is fine)
- A Supabase project (Auth enabled; email provider with "Confirm email" disabled for the demo flow)

## Setup

```bash
# From repo root
npm install
cd backend  && npm install
cd ../frontend && npm install
```

Environment files:

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
```

Fill them in:

- `backend/.env` — `PORT`, `DATABASE_URL` (pooled, `?pgbouncer=true&connection_limit=1`), `DIRECT_URL` (non-pooled, for `prisma migrate`), `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (the new `sb_secret_…` key — never ship to the browser).
- `frontend/.env` — `VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (the new `sb_publishable_…` key).

Migrate and seed the database:

```bash
cd backend
npm run db:migrate
npm run db:seed
```

## Run

From the repo root:

```bash
npm run dev
```

That runs backend (`http://127.0.0.1:3000`) and frontend (`http://127.0.0.1:5173`) together via `concurrently`.

## Scripts

| Location | Command | Purpose |
| --- | --- | --- |
| root | `npm run dev` | Run backend + frontend concurrently |
| `backend/` | `npm run dev` | nodemon on `server.js` |
| `backend/` | `npm test` | Run all backend tests (`node:test`) |
| `backend/` | `npm run db:migrate` | Apply Prisma migrations (dev) |
| `backend/` | `npm run db:migrate:deploy` | Apply Prisma migrations (prod) |
| `backend/` | `npm run db:seed` | Seed products (idempotent) |
| `backend/` | `npm run db:studio` | Open Prisma Studio |
| `backend/` | `npm run db:generate` | Regenerate Prisma client |
| `frontend/` | `npm run dev` | Vite dev server |
| `frontend/` | `npm run build` | Production build |
| `frontend/` | `npm run lint` | ESLint |
| `frontend/` | `npm run preview` | Preview production build |

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system architecture, auth flow, cart lifecycle, order transaction
- [`docs/conventions.md`](docs/conventions.md) — code conventions (ESM, Prisma singleton, integer pricing, commit style)
- [`docs/file-map.md`](docs/file-map.md) — annotated tree of backend and frontend
- [`docs/data-and-api.md`](docs/data-and-api.md) — schema summary and API endpoint reference
- [`docs/superpowers/`](docs/superpowers) — design specs and historical implementation plans
- [`CLAUDE.md`](CLAUDE.md) — guidance for Claude Code sessions
