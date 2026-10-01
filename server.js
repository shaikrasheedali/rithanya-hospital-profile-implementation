// Production entrypoint for GoDaddy / cPanel Node.js Hosting
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Verify .prisma/client/default exists; if missing, auto-generate it
const p1 = path.join(__dirname, "node_modules", ".prisma", "client", "default.js");
const p2 = path.join(__dirname, "server", "node_modules", ".prisma", "client", "default.js");

if (!fs.existsSync(p1) && !fs.existsSync(p2)) {
  console.log("[startup] Generating Prisma client (.prisma/client/default)...");
  try {
    execSync("npx prisma generate --schema=server/prisma/schema.prisma", {
      cwd: __dirname,
      stdio: "inherit",
    });
  } catch (e) {
    console.error("[startup] Failed to auto-generate Prisma client:", e);
  }
}

// Start the production server
require("./server/dist/src/index.js");
