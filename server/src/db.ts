import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import fs from "node:fs";

export function resolveSocketPath(): string | undefined {
  if (process.env.DB_SOCKET) return process.env.DB_SOCKET;
  const commonSockets = [
    "/var/lib/mysql/mysql.sock",
    "/tmp/mysql.sock",
    "/var/run/mysqld/mysqld.sock",
  ];
  for (const s of commonSockets) {
    try {
      if (fs.existsSync(s)) return s;
    } catch {
      // ignore
    }
  }
  return undefined;
}

export function getDbConfig() {
  const rawHost = process.env.DB_HOST || "127.0.0.1";
  // Crucial: normalize 'localhost' to '127.0.0.1' so Node.js does not attempt IPv6 (::1) which hangs and times out on Linux/cPanel/GoDaddy
  const host = rawHost === "localhost" ? "127.0.0.1" : rawHost;
  const port = Number(process.env.DB_PORT || "3306");
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "rithanya";
  const socketPath = resolveSocketPath();

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:")) {
    const encUser = encodeURIComponent(user);
    const encPw = encodeURIComponent(password);
    process.env.DATABASE_URL = `mysql://${encUser}:${encPw}@${host}:${port}/${database}`;
  }

  return { host, port, user, password, database, socketPath };
}

function createClient(): PrismaClient {
  const config = getDbConfig();
  const poolConfig: Record<string, unknown> = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectTimeout: 10000,
    acquireTimeout: 10000,
    idleTimeout: 30000,
    connectionLimit: 10,
  };
  // If socket path exists and host is local, prefer unix socket on Linux
  if (config.socketPath && (config.host === "127.0.0.1" || config.host === "localhost")) {
    poolConfig.socketPath = config.socketPath;
  }
  const adapter = new PrismaMariaDb(poolConfig as any);
  return new PrismaClient({ adapter });
}

const g = globalThis as typeof globalThis & { __rhPrisma?: PrismaClient };

let dbCooldownUntil = 0;

export function isDbOnCooldown(): boolean {
  return Date.now() < dbCooldownUntil;
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
  // Prisma driver/init/pool errors
  if (/^P10\d\d$/.test(code)) return true; // P1001..P1099 adapter errors
  if (code === "P2024") return true; // pool timeout
  if (code === "P2025") return false; // record not found — data logic, DB is fine
  if (code === "P2002") return false; // unique constraint — data logic
  if (code === "P2003") return true; // FK constraint can be data logic, but treat write as retryable
  if (/^P3\d\d\d$/.test(code)) return true; // adapter/driver family
  const name = String(e.name ?? "");
  if (/ maria/i.test(name)) return true;
  const msg = String(e.message ?? "");
  if (
    /timed out|timeout|ECONNREFUSED|ECONNRESET|EPIPE|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|socket|connection|connect|too many connections|busy|lock wait/i.test(
      msg,
    )
  ) {
    return true;
  }
  return false;
}

export function reportDbError(err?: unknown): void {
  const wasOnCooldown = Date.now() < dbCooldownUntil;
  // Cooldown for 45 seconds to protect performance from hanging pool timeouts.
  // Only connectivity-style failures should trigger it; data-logic errors are
  // handled where they occur and must not mark the whole DB as "down".
  if (err !== undefined && !isTransientDbError(err)) return;
  dbCooldownUntil = Date.now() + 45_000;
  if (err && !wasOnCooldown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[db] Entered cooldown for 45s due to DB error: ${msg.slice(0, 160)}`);
  }
}

export function reportDbSuccess(): void {
  dbCooldownUntil = 0;
}

/** Conservative default timeouts for awaited DB calls (share MySQL on cPanel can be slow). */
export const DB_READ_MS = Number(process.env.DB_READ_TIMEOUT_MS ?? "5000");
export const DB_WRITE_MS = Number(process.env.DB_WRITE_TIMEOUT_MS ?? "10000");

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

export const prisma: PrismaClient = g.__rhPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") g.__rhPrisma = prisma;

