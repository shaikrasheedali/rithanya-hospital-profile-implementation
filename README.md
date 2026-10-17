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

The server maps these into the Prisma `mariadb` driver adapter (or into a `DATABASE_URL` when only that variable exists — both are supported). **The app provisions its own schema at boot**: every table is created with idempotent `CREATE TABLE IF NOT EXISTS` statements (`server/src/schemaBootstrap.ts`) and first-install seed accounts/content are created only when missing — no `prisma migrate deploy` step is required on the host, and existing data is never modified or dropped.

### Resilience on shared hosting

- **Sign-in works while the database is briefly unavailable.** The users cache (`server/uploads/users-cache.json`, AES-256-GCM encrypted) keeps the last-known password hashes, so the documented admin accounts can always sign in; portal reads fall back to the same encrypted caches and admin writes are queued in the durable outbox (`server/uploads/outbox.json`) and replayed automatically on reconnect.
- **MySQL 8's `caching_sha2_password` works on the very first connection** — public-key retrieval is enabled, so a fresh deploy or a database restart (when the server's fast-auth cache is empty) can authenticate immediately instead of failing with `ER_CANNOT_RETRIEVE_RSA_KEY`.
- **Transient database failures are retried** (`withDbRetry`) before anything is reported, pooled connections are recycled every 10s so a shared server that closes idle connections cannot poison the pool, and warm-up/cooldown handshake problems self-heal.
- `GET /api/health` always returns 200 while the app is serving and reports `db.connected` plus the sanitized failure reason — the deployment dashboard logs also show `[db] Target …`, the connectivity probe result and cooldown reasons.

Optional environment overrides (sensible defaults, normally not needed):

| Variable | Default | Purpose |
|---|---|---|
| `DB_SOCKET` | – | Unix socket path (only used when explicitly set) |
| `DB_SSL` | off | `true` encrypts the MySQL connection (certificate checking via `DB_SSL_VERIFY=true`) |
| `DB_POOL_LIMIT` | `5` | Pool connection limit (shared hosting friendly) |
| `DB_CONNECT_TIMEOUT_MS` | `15000` | Per-connection connect timeout |
| `DB_ACQUIRE_TIMEOUT_MS` | `15000` | Pool acquire timeout |
| `DB_IDLE_TIMEOUT_MS` | `10000` | Idle connection recycling |
| `DB_READ_TIMEOUT_MS` / `DB_WRITE_TIMEOUT_MS` | `8000` / `15000` | App-level query budgets |

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
