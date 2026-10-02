import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

export function getDbConfig() {
  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || "3306");
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "rithanya";

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:")) {
    const encUser = encodeURIComponent(user);
    const encPw = encodeURIComponent(password);
    process.env.DATABASE_URL = `mysql://${encUser}:${encPw}@${host}:${port}/${database}`;
  }

  return { host, port, user, password, database };
}

function createClient(): PrismaClient {
  const config = getDbConfig();
  const adapter = new PrismaMariaDb({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });
  return new PrismaClient({ adapter });
}

const g = globalThis as typeof globalThis & { __rhPrisma?: PrismaClient };

export { createDbConnection, withConnection, executeQuery, mysql } from "./mysql.js";

export const prisma: PrismaClient = g.__rhPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") g.__rhPrisma = prisma;
