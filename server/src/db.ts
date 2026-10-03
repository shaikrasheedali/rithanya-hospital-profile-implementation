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

export { createDbConnection, withConnection, executeQuery, mysql } from "./mysql.js";

let dbCooldownUntil = 0;

export function isDbOnCooldown(): boolean {
  return Date.now() < dbCooldownUntil;
}

export function reportDbError(err?: unknown): void {
  const wasOnCooldown = Date.now() < dbCooldownUntil;
  // Cooldown for 45 seconds to protect performance from hanging pool timeouts
  dbCooldownUntil = Date.now() + 45_000;
  if (err && !wasOnCooldown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[db] Entered cooldown for 45s due to DB error: ${msg.slice(0, 160)}`);
  }
}

export function reportDbSuccess(): void {
  dbCooldownUntil = 0;
}

/** Guard any raw DB promise with a strict timeout so it never blocks the event loop or request threads */
export async function withDbTimeout<T>(p: Promise<T>, ms = 2000): Promise<T> {
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

