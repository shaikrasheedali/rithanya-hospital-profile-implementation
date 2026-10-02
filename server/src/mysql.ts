import mysql from "mysql2/promise";
import fs from "node:fs";

function resolveSocketPath(): string | undefined {
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

/**
 * Creates and returns a connection to the hosted MySQL database.
 * Uses environment variables set automatically by hosted database environments:
 * DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */
export async function createDbConnection(): Promise<mysql.Connection> {
  const rawHost = process.env.DB_HOST || "127.0.0.1";
  const host = rawHost === "localhost" ? "127.0.0.1" : rawHost;
  const socketPath = resolveSocketPath();
  const opts: mysql.ConnectionOptions = {
    host,
    port: Number(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "rithanya",
    connectTimeout: 5000,
  };
  if (socketPath && (host === "127.0.0.1" || host === "localhost")) {
    opts.socketPath = socketPath;
  }
  const connection = await mysql.createConnection(opts);
  return connection;
}

/**
 * Recommended execution pattern:
 * Prefer short-lived connections per request in server code, and always close the connection in a finally block.
 */
export async function withConnection<T>(fn: (connection: mysql.Connection) => Promise<T>): Promise<T> {
  const connection = await createDbConnection();
  try {
    return await fn(connection);
  } finally {
    await connection.end();
  }
}

/**
 * Execute a query with parameters using a short-lived connection, safely closed in finally block.
 */
export async function executeQuery<T = any>(sql: string, params: any[] = []): Promise<T> {
  return withConnection(async (conn) => {
    const [results] = await conn.execute(sql, params);
    return results as T;
  });
}

export { mysql };
