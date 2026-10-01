import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

function adapterUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!raw.startsWith("file:")) return raw;
  const p = raw.slice("file:".length);
  if (path.isAbsolute(p)) return raw;
  // better-sqlite3 resolves relative paths against process.cwd().
  // Normalise to the server directory so dev (tsx) and prod (dist/) share one file,
  // whether launched from monorepo root or server directory.
  const serverDir = process.cwd().endsWith("dist") || path.basename(process.cwd()) === "src"
    ? path.resolve(process.cwd(), "..")
    : process.cwd();

  const candidates = [
    path.join(serverDir, p),
    path.join(serverDir, "server", p),
    path.resolve(__dirname, "..", p),
    path.resolve(__dirname, "../..", p),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return `file:${c}`;
    }
  }

  const defaultDir = fs.existsSync(path.join(serverDir, "server")) ? path.join(serverDir, "server") : serverDir;
  const pr = path.join(defaultDir, p);
  return `file:${pr}`;
}

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: adapterUrl() });
  return new PrismaClient({ adapter });
}

const g = globalThis as typeof globalThis & { __rhPrisma?: PrismaClient };

export { createDbConnection, withConnection, executeQuery, mysql } from "./mysql.js";

export const prisma: PrismaClient = g.__rhPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") g.__rhPrisma = prisma;
