# Brooklyn Bakery

A small e-commerce app where signed-in users buy baked goods with integer "points" from their account balance.

**Visit:** https://brooklyn-bakery.pages.dev

- **Frontend:** React 19 + Vite (`frontend/`)
- **Backend:** Express 5 + Prisma (`backend/`)
- **Data & Auth:** Supabase (Postgres + Auth)

## Team

- Yassin Benelhajlahsen
- Anthony Huang
- Yusuf Doria
- Kevin Cadet
- Simon Tang
- Edwin Alonso

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

## Deployment

- **Frontend:** Cloudflare Pages (Vite static build, root directory: `frontend/`)
- **Backend:** Railway (Express, root directory: `backend/`)

Environment variables are set in each platform's dashboard. The frontend requires `VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY` at build time. The backend requires `PORT`, `NODE_ENV`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY` at runtime.

## Known issues

- **CORS errors during deployment.** The biggest source of broken-in-prod-but-fine-locally bugs. The backend allowlists `https://brooklyn-bakery.pages.dev` exactly; preview deploys (`*.brooklyn-bakery.pages.dev`) and any URL with a trailing slash get rejected. Add new origins to `allowedOrigins` in `backend/server.js`.
- **Gmail SMTP is blocked on Railway.** Railway's egress blocks outbound SMTP on the standard ports, so order confirmation emails never leave the box in production. We chose not to spin up a custom SMTP relay or a paid email provider just for the demo, so emails are effectively disabled in prod. The send path is fire-and-forget: orders still succeed and the failure is swallowed. Local dev with Gmail app passwords works fine.
- **School/campus networks block the database.** Brooklyn College's network filters outbound traffic to Supabase's Postgres ports, which makes on-campus development painful — the backend can't reach the DB and most things break. Workarounds: develop off-campus, tether to mobile data, or use a VPN.
- **Supabase email confirmation must be disabled.** The demo signup flow relies on a Postgres trigger that inserts a `public.users` row on `auth.users` insert. With email confirmation enabled, the trigger doesn't fire until the user clicks the confirmation link, so newly signed-up users have no profile row.
- **No real payment integration.** Orders are paid for with an integer "points" balance per user. There is no Stripe / card flow.
- **Authorization is enforced at the Express layer only.** RLS is intentionally not used — the backend connects with the Supabase service role and bypasses RLS. Never expose `SUPABASE_SECRET_KEY` to the browser.
- **Guest cart is local-only.** Cart items added before login live in `localStorage` and are merged into the server cart on first authenticated request.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system architecture, auth flow, cart lifecycle, order transaction
- [`docs/conventions.md`](docs/conventions.md) — code conventions (ESM, Prisma singleton, integer pricing, commit style)
- [`docs/file-map.md`](docs/file-map.md) — annotated tree of backend and frontend
- [`docs/data-and-api.md`](docs/data-and-api.md) — schema summary and API endpoint reference
- [`docs/superpowers/`](docs/superpowers) — design specs and historical implementation plans
- [`CLAUDE.md`](CLAUDE.md) — guidance for Claude Code sessions
