import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import { prisma } from "./db.js";
import { ensureBaseData } from "./seed.js";
import { runRetentionPurge } from "./retention.js";
import authRoutes from "./routes/auth.js";
import publicRoutes from "./routes/public.js";
import portalRoutes from "./routes/portal.js";
import { IMAGE_DIR, VIDEO_DIR } from "./media.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 130 * 1024 * 1024, files: 10 } });

// ---------- API ----------
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

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
app.get("/api/media/:filename", async (req, res) => {
  const raw = req.params.filename;
  const filename = path.basename(Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? ""));
  const ext = path.extname(filename).toLowerCase();
  const dir = [".webp"].includes(ext) ? IMAGE_DIR : [".mp4", ".webm", ".mov", ".ogv"].includes(ext) ? VIDEO_DIR : null;
  if (!dir) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const full = path.join(dir, filename);
  if (!fs.existsSync(full)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const stat = fs.statSync(full);
  const mime = ext === ".webp" ? "image/webp" : ext === ".mp4" ? "video/mp4" : ext === ".webm" ? "video/webm" : ext === ".mov" ? "video/quicktime" : "video/ogg";
  const range = req.headers.range;
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (!m) {
      res.status(416).end();
      return;
    }
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= stat.size || end < start) {
      res.status(416).setHeader("Content-Range", `bytes */${stat.size}`).end();
      return;
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    res.setHeader("Content-Length", String(end - start + 1));
    res.setHeader("Content-Type", mime);
    fs.createReadStream(full, { start, end }).pipe(res);
    return;
  }
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Length", String(stat.size));
  fs.createReadStream(full).pipe(res);
});

// ---------- Seed / static assets (copied from original public/seed or generated placeholders) ----------
const seedCandidates = [
  path.join(process.cwd(), "public", "seed"),
  path.join(process.cwd(), "server", "public", "seed"),
  path.resolve(__dirname, "..", "public", "seed"),
  path.resolve(__dirname, "../..", "public", "seed"),
];
let seedStaticDir: string | null = null;
for (const s of seedCandidates) {
  if (fs.existsSync(s)) {
    seedStaticDir = s;
    break;
  }
}
if (seedStaticDir) {
  app.use("/seed", express.static(seedStaticDir, { maxAge: "7d", immutable: false }));
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

// ---------- Boot ----------
async function boot() {
  await ensureBaseData();
  // Retention purge on boot + every 24h (never touches EMR/vitals)
  runRetentionPurge().catch((e) => console.error(e));
  const timer = setInterval(() => runRetentionPurge().catch((e) => console.error(e)), 24 * 3600 * 1000);
  (timer as unknown as { unref?: () => void }).unref?.();

  app.listen(PORT, () => {
    console.log(`[server] Rithanya Hospital API + frontend listening on http://localhost:${PORT}`);
  });
}

boot().catch((e) => {
  console.error("[boot] failed", e);
  process.exit(1);
});
