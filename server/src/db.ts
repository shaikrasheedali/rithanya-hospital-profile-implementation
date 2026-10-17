import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Parse a `mysql://…` / `mariadb://…` connection URL into discrete settings.
 * Used when DATABASE_URL is provided but the hosting platform's DB_* variables
 * are not (the GoDaddy runtime injects DB_*, other environments may only set
 * DATABASE_URL — both must connect correctly).
 */
function parseMysqlUrl(
  url: string,
): { host: string; port: number; user: string; password: string; database: string } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "mysql:" && u.protocol !== "mariadb:") return null;
    const host = decodeURIComponent(u.hostname || "127.0.0.1");
    return {
      // Crucial: normalize 'localhost' to '127.0.0.1' so Node.js does not attempt
      // IPv6 (::1), which hangs and times out on Linux/cPanel/GoDaddy containers.
      host: host === "localhost" ? "127.0.0.1" : host,
      port: Number(u.port || "3306") || 3306,
      user: decodeURIComponent(u.username || "root"),
      password: decodeURIComponent(u.password || ""),
      database: decodeURIComponent((u.pathname || "").replace(/^\//, "")) || "rithanya",
    };
  } catch {
    return null;
  }
}

/**
 * Unix sockets are only used when DB_SOCKET is explicitly provided. The old
 * filesystem probe (scanning /tmp/mysql.sock, /var/run/mysqld/mysqld.sock, …)
 * could pick up a stale socket file inside a container and break the TCP
 * connection that would otherwise succeed against the platform's managed DB.
 */
export function resolveSocketPath(): string | undefined {
  return process.env.DB_SOCKET || undefined;
}

export function getDbConfig() {
  const dbUrl = process.env.DATABASE_URL;
  const fromUrl = dbUrl && !dbUrl.startsWith("file:") ? parseMysqlUrl(dbUrl) : null;

  // Platform-provided DB_* variables always win (GoDaddy injects them per
  // runtime; Preview and Published share the same database).
  const rawHost = process.env.DB_HOST || fromUrl?.host || "127.0.0.1";
  const host = rawHost === "localhost" ? "127.0.0.1" : rawHost;
  const port = Number(process.env.DB_PORT || fromUrl?.port || "3306") || 3306;
  const user = process.env.DB_USER || fromUrl?.user || "root";
  const password = process.env.DB_PASSWORD ?? fromUrl?.password ?? "";
  const database = process.env.DB_NAME || fromUrl?.database || "rithanya";
  const socketPath = resolveSocketPath();

  // Managed MySQL instances may require TLS. DB_SSL=true encrypts the
  // connection (certificate validation only when DB_SSL_VERIFY=true).
  const sslEnv = String(process.env.DB_SSL ?? "").toLowerCase();
  const ssl =
    sslEnv === "true" || sslEnv === "1" || sslEnv === "required"
      ? process.env.DB_SSL_VERIFY === "true"
        ? true
        : { rejectUnauthorized: false }
      : undefined;

  // Keep DATABASE_URL in sync for Prisma CLI/seed scripts and for deriving
  // stable JWT/encryption secrets on hosts that only inject DB_* variables.
  if (!dbUrl || dbUrl.startsWith("file:")) {
    const encUser = encodeURIComponent(user);
    const encPw = encodeURIComponent(password);
    process.env.DATABASE_URL = `mysql://${encUser}:${encPw}@${host}:${port}/${database}`;
  }

  return { host, port, user, password, database, socketPath, ssl };
}

function createClient(): PrismaClient {
  const config = getDbConfig();
  const poolConfig: Record<string, unknown> = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    // Shared/hosted MySQL (GoDaddy & similar) can be slow on cold connects and
    // may close idle pooled connections server-side. Conservative pool sizing,
    // short idle recycling and generous connect timeouts keep every acquired
    // connection fresh; stale connections are additionally retried by
    // withDbRetry() before a failure reaches the user.
    // NOTE: do NOT set minimumIdle (0 breaks the mariadb 3.4.x pool shipped
    // inside @prisma/adapter-mariadb 7.10.0 — the pool can then never acquire
    // a connection even when the server is healthy).
    // MySQL 8's default caching_sha2_password needs RSA public-key retrieval
    // on the first (cache-cold) connection — after a fresh deploy, a DB restart
    // or a server-side cache eviction. Without this option the mariadb driver
    // refuses with ER_CANNOT_RETRIEVE_RSA_KEY and the pool can never establish
    // a connection (all queries fail, sign-in 503s forever).
    allowPublicKeyRetrieval: true,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? "15000"),
    acquireTimeout: Number(process.env.DB_ACQUIRE_TIMEOUT_MS ?? "15000"),
    idleTimeout: Number(process.env.DB_IDLE_TIMEOUT_MS ?? "10000"),
    connectionLimit: Number(process.env.DB_POOL_LIMIT ?? "5"),
  };
  if (config.ssl !== undefined) poolConfig.ssl = config.ssl;
  if (config.socketPath) poolConfig.socketPath = config.socketPath;
  const adapter = new PrismaMariaDb(poolConfig as any);
  return new PrismaClient({ adapter });
}

const g = globalThis as typeof globalThis & { __rhPrisma?: PrismaClient };

let dbCooldownUntil = 0;
let lastDbFailure: { at: number; code: string; message: string } | null = null;
let lastDbSuccessAt = 0;

export function isDbOnCooldown(): boolean {
  return Date.now() < dbCooldownUntil;
}

/** Sanitized DB health snapshot for /api/health and boot logs (no secrets). */
export function dbDiagnostics(): {
  onCooldown: boolean;
  cooldownRemainingMs: number;
  lastFailure: { at: number; code: string; message: string } | null;
  lastSuccessAt: number | null;
} {
  return {
    onCooldown: isDbOnCooldown(),
    cooldownRemainingMs: Math.max(0, dbCooldownUntil - Date.now()),
    lastFailure: lastDbFailure,
    lastSuccessAt: lastDbSuccessAt || null,
  };
}

/**
 * Classify a DB failure:
 *  - transient  → connectivity / pool / driver / timeout problems (error ≈ "DB down")
 *  - !transient → Prisma request errors caused by our data logic (P2002 dup, P2025 missing, …)
 * Cooldown (skipping DB calls) should only ever be entered for transient errors.
 */
export function isTransientDbError(err?: unknown): boolean {
  if (!err) return true; // unknown → assume transient
  const e = err as { code?: string; name?: string; message?: string };
  const code = String(e.code ?? "");
  const name = String(e.name ?? "");
  // Client-side argument validation fails identically on every retry — the DB
  // was never contacted. Deterministic; safe to drop queued ops for it.
  if (/validation/i.test(name)) return false;
  // Prisma driver/init/pool errors
  if (/^P10\d\d$/.test(code)) return true; // P1001..P1099 adapter errors
  if (code === "P2024") return true; // pool timeout
  if (code === "P2028") return true; // transaction start timeout (DB unreachable/slow)
  if (code === "P2034") return true; // write conflict / deadlock — retryable
  if (code === "P2025") return false; // record not found — data logic, DB is fine
  if (code === "P2002") return false; // unique constraint — data logic
  if (code === "P2003") return true; // FK constraint can be data logic, but treat write as retryable
  if (/^P3\d\d\d$/.test(code)) return true; // adapter/driver family
  if (/adapt|maria/i.test(name)) return true; // DriverAdapterError / PrismaMariaDb*
  const msg = String(e.message ?? "");
  if (
    /timed out|timeout|ECONNREFUSED|ECONNRESET|EPIPE|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|socket|connection|connect|too many connections|busy|lock wait|transaction api error|unable to start a transaction|in the given time|pool is closed|pool closed|i\/o error/i.test(
      msg,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Short, credential-free classification of the last DB failure for the public
 * /api/health payload. The full driver message stays in the server logs.
 */
export function dbFailureReason(): string {
  const f = lastDbFailure;
  if (!f) return "unavailable";
  const text = `${f.code} ${f.message}`;
  if (/P2024|pool timeout|pool connections/i.test(text)) return "pool-timeout";
  if (/P2028|transaction api error|unable to start a transaction/i.test(text)) return "transaction-timeout";
  if (/ECONNREFUSED|connection refused/i.test(text)) return "connection-refused";
  if (/EHOSTUNREACH|ENETUNREACH|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) return "host-unreachable";
  if (/ETIMEDOUT|timed out|timeout/i.test(text)) return "timeout";
  if (/access denied|authentication|ER_ACCESS_DENIED/i.test(text)) return "auth-failed";
  if (/unknown database|ER_BAD_DB_ERROR/i.test(text)) return "database-missing";
  if (/does not exist|unknown table|P2021/i.test(text)) return "schema-missing";
  if (/too many connections/i.test(text)) return "connections-exhausted";
  return f.code || "error";
}

export function reportDbError(err?: unknown): void {
  const wasOnCooldown = Date.now() < dbCooldownUntil;
  // Cooldown for 45 seconds to protect performance from hanging pool timeouts.
  // Only connectivity-style failures should trigger it; data-logic errors are
  // handled where they occur and must not mark the whole DB as "down".
  if (err !== undefined && !isTransientDbError(err)) return;
  const e = err as { code?: string; name?: string; message?: string } | undefined;
  const message = err instanceof Error ? err.message : err !== undefined ? String(err) : "unknown";
  const rawCode = String(e?.code ?? "").trim();
  const rawName = String(e?.name ?? "").trim();
  lastDbFailure = {
    at: Date.now(),
    code: rawCode || (rawName && rawName !== "Error" ? rawName : ""),
    message: message.split("\n")[0].slice(0, 300),
  };
  dbCooldownUntil = Date.now() + 45_000;
  if (err && !wasOnCooldown) {
    console.warn(
      `[db] Entered cooldown for 45s due to DB error${lastDbFailure.code ? ` (${lastDbFailure.code})` : ""}: ${lastDbFailure.message.slice(0, 160)}`,
    );
  }
}

export function reportDbSuccess(): void {
  dbCooldownUntil = 0;
  lastDbSuccessAt = Date.now();
}

/**
 * Conservative default timeouts for awaited DB calls (shared MySQL on hosting
 * platforms can be slow on cold connects; too-tight budgets turn a hiccup into
 * a visible 503).
 */
export const DB_READ_MS = Number(process.env.DB_READ_TIMEOUT_MS ?? "8000");
export const DB_WRITE_MS = Number(process.env.DB_WRITE_TIMEOUT_MS ?? "15000");

/** Guard any raw DB promise with a strict timeout so it never blocks the event loop or request threads */
export async function withDbTimeout<T>(p: Promise<T>, ms: number = DB_READ_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Database call timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Run a DB operation as a FACTORY (so a *fresh* query — and therefore a fresh
 * pooled connection — is issued on retry) with a hard app-level timeout.
 * Transient failures, including pooled connections the shared server closed
 * while idle, are retried before the error is surfaced to callers.
 */
export async function withDbRetry<T>(
  factory: () => Promise<T>,
  ms: number = DB_READ_MS,
  attempts = 2,
  budgetMs?: number,
): Promise<T> {
  const total = Math.max(1, attempts);
  // Optional cap on the TOTAL time spent across all attempts (user-facing
  // callers such as sign-in must fall back to the offline cache quickly
  // instead of burning the full ms × attempts budget on a dead database).
  const deadline = budgetMs && budgetMs > 0 ? Date.now() + budgetMs : Number.POSITIVE_INFINITY;
  let lastErr: unknown;
  for (let i = 0; i < total; i += 1) {
    const remaining = deadline - Date.now();
    if (i > 0 && remaining <= 0) break;
    const attemptMs = Number.isFinite(remaining) ? Math.max(1000, Math.min(ms, remaining)) : ms;
    try {
      return await withDbTimeout(factory(), attemptMs);
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || i === total - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastErr;
}

export const prisma: PrismaClient = g.__rhPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") g.__rhPrisma = prisma;
