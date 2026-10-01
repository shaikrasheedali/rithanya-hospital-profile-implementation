// Prisma 7 configuration: datasource URL lives here (not in schema.prisma).
import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

function sqliteUrl(): string {
  const raw = env("DATABASE_URL") || "file:./prisma/dev.db";
  if (!raw.startsWith("file:")) return raw;
  const p = raw.slice("file:".length);
  if (path.isAbsolute(p)) return raw;
  // Resolve relative SQLite paths against the server directory (this file's parent),
  // so dev (`tsx`) and prod (`node dist/...`, cwd = server/) use the same file.
  return `file:${path.join(__dirname, p)}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: sqliteUrl(),
  },
});
