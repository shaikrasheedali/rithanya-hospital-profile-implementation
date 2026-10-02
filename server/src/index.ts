import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { prisma, withDbTimeout } from "./db.js";
import { ensureBaseData, ensureSeed } from "./seed.js";
import { runRetentionPurge } from "./retention.js";
import authRoutes from "./routes/auth.js";
import publicRoutes from "./routes/public.js";
import portalRoutes from "./routes/portal.js";
import mediaRoutes, { getSeedDir } from "./routes/media.js";
import { IMAGE_DIR, VIDEO_DIR } from "./media.js";

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT ?? 4000);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 10 } });

// ---------- API ----------
app.get("/api/health", async (_req, res) => {
  try {
    await withDbTimeout(prisma.$queryRaw`SELECT 1`, 2500);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: "Database unavailable" });
  }
});

// Basic abuse protection for public write endpoints.
const publicWriteLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use("/api/public/appointments", publicWriteLimiter);
app.use("/api/public/orders", publicWriteLimiter);
app.use("/api/public/dpdp", publicWriteLimiter);

app.use("/api/auth", authRoutes);
// DPDP proof upload needs multer single-file parsing
app.use("/api/public", (req, res, next) => {
  if (req.path === "/dpdp" && req.method === "POST") {
    upload.single("identityProof")(req, res, next);
    return;
  }
  next();
}, publicRoutes);
app.use("/api/portal/media", upload.array("files", 10));
app.use("/api/portal", portalRoutes);

// ---------- Public media files (uploaded images/videos) ----------
app.use("/api/media", mediaRoutes);

// ---------- Seed / static assets (seed assets with fallback) ----------
const seedDir = getSeedDir();
if (seedDir) {
  app.use("/seed", express.static(seedDir, { maxAge: "7d", immutable: false }));
  // Missing seed assets are asset URLs, not app routes — 404 instead of SPA fallback.
  app.use("/seed", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
}

// ---------- Built Vite frontend (client/dist → served by backend) ----------
const candidates = [
  path.join(process.cwd(), "public"), // copied build output (server/public)
  path.join(process.cwd(), "..", "client", "dist"),
  path.join(process.cwd(), "client", "dist"),
  path.resolve(__dirname, "../../client/dist"),
  path.resolve(__dirname, "../client/dist"),
  path.resolve(__dirname, "../../../client/dist"),
];
let frontendDir: string | null = null;
for (const c of candidates) {
  if (fs.existsSync(path.join(c, "index.html"))) {
    frontendDir = c;
    break;
  }
}
if (frontendDir) {
  console.log(`[static] Serving frontend from ${frontendDir}`);
  app.use(express.static(frontendDir, { maxAge: "1h", index: false }));
  // SPA fallback: everything that is not /api/* returns index.html (app.use works in Express 4 & 5)
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(path.join(frontendDir as string, "index.html"));
  });
} else {
  console.log("[static] No built frontend found (run `npm run build` from the monorepo root). API-only mode.");
  app.get("/", (_req, res) => {
    res.json({ ok: true, service: "rithanya-hospital-api", frontend: "not-built" });
  });
}

// ---------- API error handling (must be after routes, before boot) ----------
// Unknown /api/* routes return JSON (not the SPA HTML fallback).
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Multer + central error handler: always JSON for /api/*, never HTML stack traces.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[api] unhandled error:", err instanceof Error ? err.message : err);
  if (req.path.startsWith("/api/")) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "File too large — max 10MB per file." });
        return;
      }
      res.status(400).json({ error: "Upload failed — please try again." });
      return;
    }
    const msg = err instanceof Error ? err.message : "Something went wrong";
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Something went wrong — please try again." : msg });
    return;
  }
  res.status(500).send("Something went wrong");
});

// ---------- Boot ----------
async function boot() {
  const server = app.listen(PORT, () => {
    console.log(`[server] Rithanya Hospital API + frontend listening on http://localhost:${PORT}`);
  });

  try {
    await ensureSeed();
    console.log("[server] Database base data and demo collections verified.");
  } catch (e) {
    console.warn("[server] Notice: Could not connect to database on boot:", e instanceof Error ? e.message : e);
  }

  // Retention purge on boot + every 24h (never touches EMR/vitals)
  runRetentionPurge().catch((e) => console.error(e));
  const timer = setInterval(() => runRetentionPurge().catch((e) => console.error(e)), 24 * 3600 * 1000);
  (timer as unknown as { unref?: () => void }).unref?.();
}

boot().catch((e) => {
  console.error("[boot] unexpected error:", e);
});
