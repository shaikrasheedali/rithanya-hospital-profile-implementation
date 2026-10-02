// Production entrypoint for GoDaddy / cPanel / PaaS Node.js Hosting
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Automatically assemble DATABASE_URL from GoDaddy environment variables if not already provided
if (!process.env.DATABASE_URL && process.env.DB_HOST) {
  const rawHost = process.env.DB_HOST || "127.0.0.1";
  const host = rawHost === "localhost" ? "127.0.0.1" : rawHost;
  const port = process.env.DB_PORT || "3306";
  const user = encodeURIComponent(process.env.DB_USER || "root");
  const password = encodeURIComponent(process.env.DB_PASSWORD || "");
  const database = process.env.DB_NAME || "rithanya";
  process.env.DATABASE_URL = `mysql://${user}:${password}@${host}:${port}/${database}`;
}

const serverDir = path.join(__dirname, "server");
const rootPrismaClient = path.join(__dirname, "node_modules", ".prisma", "client");
const serverPrismaClient = path.join(serverDir, "node_modules", ".prisma", "client");

function ensurePrismaClient() {
  const p1 = path.join(rootPrismaClient, "default.js");
  const p2 = path.join(serverPrismaClient, "default.js");

  if (!fs.existsSync(p1) && !fs.existsSync(p2)) {
    console.log("[startup] Generating Prisma client (.prisma/client/default)...");
    try {
      execSync("npx prisma generate", {
        cwd: serverDir,
        stdio: "inherit",
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL || "mysql://root:@localhost:3306/rithanya",
        },
      });
    } catch (e) {
      console.error("[startup] Failed to auto-generate Prisma client:", e);
    }
  }

  // Run sync script to ensure both root and server have .prisma/client
  try {
    const syncScript = path.join(serverDir, "scripts", "sync-prisma-client.cjs");
    if (fs.existsSync(syncScript)) {
      require(syncScript);
    }
  } catch (e) {
    console.warn("[startup] sync-prisma-client warning:", e.message);
  }

  // Ensure default.js is present in both client folders
  for (const clientDir of [rootPrismaClient, serverPrismaClient]) {
    if (fs.existsSync(clientDir)) {
      const def = path.join(clientDir, "default.js");
      if (!fs.existsSync(def)) {
        fs.writeFileSync(def, "module.exports = { ...require('./index.js') };\n");
      }
    }
  }
}

ensurePrismaClient();

// Start the production server
require("./server/dist/src/index.js");
