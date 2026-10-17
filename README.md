# Rithanya Hospital — Full-Stack Monorepo

React 19.3 (Vite) client + Node.js Express backend + MySQL via Prisma ORM & mysql2 driver.
No Next.js. The Express server serves the built Vite frontend as well as all API requests.

```
rithanya-full-stack/
  package.json          # monorepo orchestration (install / dev / build / start once here)
  index.js              # Production startup entrypoint for GoDaddy / cPanel / PaaS hosting
  server.js             # Alternative GoDaddy hosting entrypoint
  app.js                # Alternative GoDaddy hosting entrypoint
  client/               # React 19.3 + Vite + React Router + Tailwind v4
  server/               # Express + Prisma + MySQL (mysql2 & @prisma/adapter-mariadb), serves ../client/dist + /api/*
```

## Prerequisites

- Node.js >= 20
- npm >= 10
- MySQL >= 8 (provided automatically on hosted platforms like GoDaddy Node.js Hosting)

## Quick start (run once from `rithanya-full-stack/`)

```bash
npm run install:all   # install client + server deps
npm run prisma:generate # generate Prisma client
npm run build         # builds frontend (client/dist) + backend (server/dist)
npm start             # serves API + built frontend on http://localhost:4000
```

| Command | What it does |
|---|---|
| `npm run install:all` | installs `client` and `server` dependencies |
| `npm run dev` | runs Vite (5173, proxies `/api` → 4000) + Express (4000) concurrently |
| `npm run build` | `client: vite build` → `server: tsc build` (frontend output is served by backend) |
| `npm start` | starts Express which serves `client/dist` + `/api/*` |
| `npm run prisma:generate` | generates Prisma client and synchronizes client modules |
| `npm test` | server smoke tests |

## GoDaddy Node.js Hosting & Database Configuration

When deploying on GoDaddy Node.js hosting, database secrets are injected automatically:
- `DB_HOST`
- `DB_PORT` (default: `3306`)
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

The server automatically maps these into the database connection string and utilizes Prisma driver adapters (`mariadb` adapter for MySQL/MariaDB). Writes are durable: when the database is briefly unreachable, operations are queued in an encrypted on-disk outbox (`server/uploads/outbox.json`) and replayed automatically after reconnection — admin edits are permanent until changed again.

## Login accounts (seeded on first install)

- Superadmin: `superadmin` / `Hameed@2026`
- Admin: `admin` / `Rithanya@2026`

Staff accounts have no seeded password — create them from the admin portal
(**Access → Users → New user**, role `STAFF`). Passwords are change-policy
friendly: superadmin and admin can reset any password from the same screen.
Please change these first-install passwords before going live, and set strong
`JWT_SECRET` / `ENCRYPTION_MASTER_KEY` values in production (64 hex chars).

## Production deploy

1. `npm run build`
2. `npm start` (single process serves both frontend + API; uses `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` or `DATABASE_URL`)
3. Static frontend is served directly from `client/dist`. Uploads live under `server/uploads/`.
