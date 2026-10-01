# Rithanya Hospital — Full-Stack Monorepo

React 19.3 (Vite) client + Node.js Express backend + SQLite via Prisma ORM.
No Next.js. The Express server serves the built Vite frontend as well as all API requests.

```
rithanya-full-stack/
  package.json          # monorepo orchestration (install / dev / build / start once here)
  client/               # React 19.3 + Vite + React Router + Tailwind v4 (exact same design as original Next.js app)
  server/               # Express + Prisma + SQLite (better-sqlite3), serves ../client/dist + /api/*
```

## Prerequisites

- Node.js >= 20
- npm >= 10

## Quick start (run once from `rithanya-full-stack/`)

```bash
npm run install:all   # install client + server deps
npm run db:setup      # prisma generate + migrate + seed (creates SQLite + demo data)
npm run build         # builds frontend (client/dist) + backend (server/dist)
npm start             # serves API + built frontend on http://localhost:4000
```

| Command | What it does |
|---|---|
| `npm run install:all` | installs `client` and `server` dependencies |
| `npm run dev` | runs Vite (5173, proxies `/api` → 4000) + Express (4000) concurrently |
| `npm run build` | `client: vite build` → `server: tsc build` (frontend output is served by backend) |
| `npm start` | starts Express which serves `client/dist` + `/api/*` |
| `npm run db:setup` | `prisma generate && prisma migrate deploy/create + seed` |
| `npm test` | server smoke tests (health, public reads, auth guard, validation) |
| `npm run test:e2e` | exhaustive API E2E — 185 assertions over every endpoint × method × valid/invalid/edge inputs, against a throwaway DB copy |
| `seed:images` (`server`) | regenerates real WebP seed images via sharp (`server/public/seed/`) |

## Ports / env

- Server: `PORT` (default `4000`), `DATABASE_URL` (default `file:./prisma/dev.db`, resolved against `server/`), `JWT_SECRET`, `ENCRYPTION_MASTER_KEY` (64 hex, optional — deterministic fallback for local dev). Prisma 7 reads the URL from `server/prisma.config.ts`; the client passes it to `@prisma/adapter-better-sqlite3`.
- Client dev: Vite `5173` with proxy `/api` + `/seed` → `http://localhost:4000`.

See `server/.env.example` and `client/.env.example`.

## Design fidelity

- `client/src/index.css` is a verbatim copy of the original `src/app/globals.css` (Tailwind v4 `@theme`, navy/royal/alert/gold/canvas/ink/line, Poppins/Open Sans/Noto Sans Telugu, marquee/float/pulse-ring, bg-mesh/bg-grid, hero-halo, reveal, prose-rh, print styles).
- All site + portal components were ported 1:1 from the Next.js codebase (`Navbar`, `Footer`, `Hero`, `BloodStockCards`, `ClinicalHub`, `GalleryHub`, `ProductGrid`, `CartProvider`, `BookingProvider`, `PortalShell`, `PatientsManager`, `OrdersDesk`, `PayrollDesk`, etc.) with only router/data-fetching adaptations (`next/link` → `react-router`, server components → `fetch('/api/...')`).
- SQLite schema is a 1:1 port of `drizzle` `schema.ts` (26 tables) into Prisma models; seed data mirrors `src/lib/seed.ts` (users, specialties, treatments, services, doctors, insurance, gallery, testimonials, blogs, products, EMR demo, HR/finance demo).

## Dependency versions (latest stable)

| Package | Version | Notes |
|---|---|---|
| `react` / `react-dom` | 19.3.0 | pinned as required |
| `react-router-dom` | ^7.18.4 | |
| `lucide-react` | ^1.49.0 | |
| `vite` / `@vitejs/plugin-react` | ^8.3.2 / ^6.1.1 | config uses `import.meta.dirname` |
| `express` | ^5.2.1 | SPA fallback via `app.use()`; params normalized with a `param()` helper (v5 types) |
| `multer` | ^2.4.0 | same memory-storage API |
| `sharp` | ^0.35.5 | fixes the high-severity libvips/libheif advisories |
| `better-sqlite3` | ^13.0.3 | |
| `@prisma/client` / `prisma` | ^7.10.0 | Prisma 7: URL in `prisma.config.ts`, client uses `@prisma/adapter-better-sqlite3` |
| `typescript` | ^5.9.3 | kept on v5 (v7 is the Go-native preview, not a drop-in upgrade) |

Security: `client` audits 0 vulnerabilities and the original sharp high-severity advisory is resolved. `npm audit` still flags 4 highs strictly inside the `prisma@7.10.0` CLI's own tree (`@prisma/config → deepmerge-ts`, `mysql2` driver) — dev-tooling only, never imported at runtime (SQLite path uses the better-sqlite3 adapter), with no newer stable Prisma available.

## Demo logins (seeded)

- Superadmin: `superadmin` / `Rithanya@2026`
- Admin: `admin` / `Admin@2026`
- Staff: `staff` / `Staff@2026`

## Production deploy

1. `npm run build`
2. `npm start` (single process serves both frontend + API; set `PORT`, `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_MASTER_KEY` in env)
3. SQLite file lives at `server/prisma/dev.db` (or `DATABASE_URL`). Uploads live under `server/uploads/`.

## API overview

- `GET /api/health`
- Public: `GET /api/public/settings|clinical|flagship|doctors|insurance|gallery|testimonials|blogs|products|blood-stock`, `POST /api/public/appointments|orders|dpdp`, `GET /api/public/dpdp?code&phone`, `GET /api/media/:filename`
- Auth: `POST /api/auth/login|logout`, `GET /api/auth/me`
- Portal (cookie session + module RBAC): `GET|POST /api/portal/cms/:collection`, `PUT|DELETE /api/portal/cms/:collection/:id`, `GET|POST /api/portal/media`, `DELETE /api/portal/media/:id|purge`, `* /api/portal/r/:resource[/:id]`, page-data `GET /api/portal/*` (dashboard, patients, appointments, orders, employees, payroll, payslip, ledger, expense-categories, dpdp-requests, users, permissions, settings, audit-logs, finance-overview), `GET /api/portal/consent/:file`, `GET /api/portal/dpdp-proof/:file`
