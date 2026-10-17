import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { upload, MAX_UPLOAD_MB } from "./upload.js";
import { prisma, withDbTimeout, withDbRetry, getDbConfig, dbDiagnostics, dbFailureReason, reportDbError, reportDbSuccess, isTransientDbError } from "./db.js";
import { ensureBaseData, ensureSeed, ensureColumns } from "./seed.js";
import { loadOutbox, startOutboxTimer, wakeOutbox, outboxPendingCount } from "./outbox.js";
import { warnIfProductionSecretsWeak } from "./auth.js";
import { runRetentionPurge } from "./retention.js";
import authRoutes from "./routes/auth.js";
import publicRoutes from "./routes/public.js";
import portalRoutes from "./routes/portal.js";
import mediaRoutes, { getSeedDir } from "./routes/media.js";
import { IMAGE_DIR, VIDEO_DIR } from "./media.js";

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT ?? 4000);
const bootState = { ready: false };

app.disable("x-powered-by");
// Full CSP: locked down to same-origin by default, with explicit allowances
// for the three external integrations the site actually uses —
// Google Fonts (styles + font files), Google Maps embeds, gallery embeds
// (YouTube/Facebook/Instagram/Vimeo) and — only for visitors who opt into
// translation — the Google Translate widget domains.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://translate.google.com", "https://translate.googleapis.com", "https://www.gstatic.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://www.gstatic.com", "https://translate.googleapis.com"],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com", "https://translate.googleapis.com"],
        "img-src": ["'self'", "data:", "blob:", "https://*.gstatic.com", "https://translate.googleapis.com", "https://translate.google.com"],
        "media-src": ["'self'", "blob:"],
        "connect-src": ["'self'", "https://translate.googleapis.com", "https://translate.google.com", "https://translate-pa.googleapis.com"],
        "frame-src": [
          "'self'",
          "https://www.google.com",
          "https://www.youtube.com",
          "https://www.youtube-nocookie.com",
          "https://www.facebook.com",
          "https://web.facebook.com",
          "https://www.instagram.com",
          "https://player.vimeo.com",
          "https://translate.google.com",
          "https://*.translate.goog",
        ],
        "worker-src": ["'self'", "blob:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'self'"],
        "upgrade-insecure-requests": [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
// gzip/deflate for all compressible responses (HTML, JS, CSS, JSON) — big
// transfer-time win on shared hosting; skips images/videos/ranges by default.
app.use(compression());
// Access logs must never capture DPDP tracking query strings (they carry the
// requester's phone number) — for that one route only the path is logged.
morgan.token("safe-url", (req) => {
  const raw = String((req as { originalUrl?: string | null }).originalUrl ?? req.url ?? "");
  const pathOnly = raw.split("?")[0];
  return pathOnly.startsWith("/api/public/dpdp") ? pathOnly : raw;
});
app.use(
  morgan(
    process.env.NODE_ENV === "production"
      ? ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
      : ":method :safe-url :status :res[content-length] - :response-time ms",
  ),
);
app.use(cookieParser());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------- API ----------
// The app is designed to keep serving (caches + durable outbox) while the
// shared database is briefly unreachable, so health never fails the whole
// process for a DB hiccup — the db block reports the live connection state,
// which is what the deployment dashboard shows in its logs.
app.get("/api/health", async (_req, res) => {
  let dbUp = false;
  try {
    await withDbTimeout(prisma.$queryRaw`SELECT 1`, 2500);
    reportDbSuccess();
    dbUp = true;
  } catch {
    // Stay healthy; /api/health must not cause platform restarts during a
    // transient database outage.
  }
  const diag = dbDiagnostics();
  res.json({
    ok: true,
    // Boot seeding has finished (schema + first-install accounts) — internal
    // readiness signal used by the test suites; platform checks only need ok.
    ready: bootState.ready,
    service: "rithanya-hospital-api",
    uptimeSeconds: Math.round(process.uptime()),
    db: dbUp
      ? { connected: true }
      : {
          connected: false,
          retryInMs: diag.cooldownRemainingMs,
          reason: dbFailureReason(),
        },
  });
});

// Basic abuse protection for public write endpoints.
const publicWriteLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
app.use("/api/public/appointments", publicWriteLimiter);
app.use("/api/public/orders", publicWriteLimiter);
app.use("/api/public/dpdp", publicWriteLimiter);

app.use("/api/auth", authRoutes);
// DPDP proof upload needs multer single-file parsing (runs after the public
// write rate limiter above; the route itself validates the payload).
app.use("/api/public", (req, res, next) => {
  if (req.path === "/dpdp" && req.method === "POST") {
    upload.single("identityProof")(req, res, next);
    return;
  }
  next();
}, publicRoutes);
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
  // Vite output filenames are content-hashed — safe to cache immutably for a
  // year; this removes the revalidation round-trip on every navigation.
  app.use("/assets", express.static(path.join(frontendDir, "assets"), { maxAge: "1y", immutable: true, index: false }));
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
        res.status(413).json({ error: `File too large — max ${MAX_UPLOAD_MB}MB per file.` });
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
  // Loud boot-time diagnostics for weak production secrets.
  warnIfProductionSecretsWeak();

  // Load any writes queued while the app was down BEFORE seeding/reading so
  // the durable outbox takes precedence over boot-time reconciliation.
  await loadOutbox();
  if (outboxPendingCount() > 0) {
    console.log(`[server] Outbox holds ${outboxPendingCount()} write(s) queued from before restart — will replay.`);
  }

  const server = app.listen(PORT, () => {
    console.log(`[server] Rithanya Hospital API + frontend listening on http://localhost:${PORT}`);
  });

  // Sanitized connection diagnostics (never logs the password) — invaluable
  // when the host injects DB_* variables that only exist inside the runtime.
  const cfg = getDbConfig();
  console.log(
    `[db] Target ${cfg.socketPath ? `socket ${cfg.socketPath}` : `tcp ${cfg.host}:${cfg.port}`} db=${cfg.database} user=${cfg.user} ssl=${cfg.ssl ? "on" : "off"}`,
  );

  try {
    const t0 = Date.now();
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`, 8000, 2);
    reportDbSuccess();
    console.log(`[db] Connectivity probe OK in ${Date.now() - t0}ms`);
  } catch (e) {
    if (isTransientDbError(e)) reportDbError(e);
    console.warn(`[db] Connectivity probe FAILED: ${e instanceof Error ? e.message : e}`);
  }

  try {
    // Ensure additive schema columns (vital_logs.time_slot) before seeding.
    await ensureColumns();
    await ensureSeed();
    console.log("[server] Database base data and collections verified.");
    // Drain anything the outbox collected while the DB was down.
    wakeOutbox();
  } catch (e) {
    console.warn("[server] Notice: Could not connect to database on boot:", e instanceof Error ? e.message : e);
  } finally {
    bootState.ready = true;
  }

  // Periodic drain: replays queued writes every 60s (also drained immediately
  // after any successful DB operation).
  startOutboxTimer();

  // Retention purge on boot + every 24h (never touches EMR/vitals)
  runRetentionPurge().catch((e) => console.error(e));
  const timer = setInterval(() => runRetentionPurge().catch((e) => console.error(e)), 24 * 3600 * 1000);
  (timer as unknown as { unref?: () => void }).unref?.();
  return server;
}

boot().catch((e) => {
  console.error("[boot] unexpected error:", e);
});
