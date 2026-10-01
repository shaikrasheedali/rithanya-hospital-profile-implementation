import mysql from "mysql2/promise";

/**
 * Creates and returns a connection to the hosted MySQL database.
 * Uses environment variables set automatically by hosted database environments:
 * DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */
export async function createDbConnection(): Promise<mysql.Connection> {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
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
