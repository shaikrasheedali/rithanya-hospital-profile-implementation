import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import sharp from "sharp";
import { IMAGE_DIR, VIDEO_DIR, THUMB_DIR } from "../media.js";

const mediaRouter = Router();

const seedCandidates = [
  path.join(process.cwd(), "public", "seed"),
  path.join(process.cwd(), "server", "public", "seed"),
  path.resolve(__dirname, "..", "public", "seed"),
  path.resolve(__dirname, "../..", "public", "seed"),
  path.resolve(__dirname, "../../public/seed"),
  path.resolve(__dirname, "../../../public/seed"),
  path.resolve(__dirname, "../../../server/public/seed"),
  // Source-tree / built-client fallbacks. The shipped assets live in
  // client/public/seed (git-tracked) and are copied into client/dist and
  // server/public by `npm run build`, so at least one of these always exists.
  path.join(process.cwd(), "client", "public", "seed"),
  path.join(process.cwd(), "client", "dist", "seed"),
  path.resolve(__dirname, "../../../client/public/seed"),
  path.resolve(__dirname, "../../../client/dist/seed"),
];

let seedStaticDir: string | null = null;
for (const s of seedCandidates) {
  if (fs.existsSync(s)) {
    seedStaticDir = s;
    break;
  }
}

export function getSeedDir(): string | null {
  if (seedStaticDir && fs.existsSync(seedStaticDir)) return seedStaticDir;
  for (const s of seedCandidates) {
    if (fs.existsSync(s)) {
      seedStaticDir = s;
      return seedStaticDir;
    }
  }
  return null;
}

// ---------- Thumbnails ----------
// Portal grids request square tiles via `?thumb=<px>`. Generating (and caching)
// a small WebP avoids shipping a 1-5MB original per tile — a media library page
// with ~50 assets drops from tens of MB to well under 1MB of transfers.
const THUMB_MIN = 32;
const THUMB_MAX = 1024;
const THUMB_DEFAULT = 320;
const THUMB_MAX_CONCURRENCY = 4;

const thumbInflight = new Map<string, Promise<string>>();
let thumbActive = 0;
const thumbQueue: Array<() => void> = [];

function acquireThumbSlot(): Promise<void> {
  if (thumbActive < THUMB_MAX_CONCURRENCY) {
    thumbActive += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => thumbQueue.push(() => { thumbActive += 1; resolve(); }));
}

function releaseThumbSlot(): void {
  thumbActive -= 1;
  const next = thumbQueue.shift();
  if (next) next();
}

export function parseThumbSize(raw: unknown): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(n) || n <= 0) return THUMB_DEFAULT;
  return Math.min(THUMB_MAX, Math.max(THUMB_MIN, Math.round(n)));
}

/** Returns the cached thumbnail path, generating it on first use. */
async function ensureThumb(srcPath: string, size: number): Promise<string> {
  const base = path.basename(srcPath, path.extname(srcPath));
  const dest = path.join(THUMB_DIR, `t${size}-${base}.webp`);
  try {
    const st = await fsp.stat(dest);
    if (st.isFile() && st.size > 0) return dest;
  } catch {
    // not cached yet
  }
  const running = thumbInflight.get(dest);
  if (running) return running;
  const job = (async () => {
    await acquireThumbSlot();
    try {
      await fsp.mkdir(THUMB_DIR, { recursive: true });
      await sharp(srcPath)
        .rotate()
        .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 76, effort: 1 })
        .toFile(dest);
      return dest;
    } finally {
      releaseThumbSlot();
      thumbInflight.delete(dest);
    }
  })();
  thumbInflight.set(dest, job);
  return job;
}

export function resolveMediaFilePath(rawName: string): { fullPath: string; mime: string; ext: string } | null {
  const rawFilename = path.basename(rawName);
  const cleanFilename = rawFilename
    .replace(/^disk-\d+-/, "")
    .replace(/^disk-/, "")
    .replace(/^media-/, "");
  let ext = path.extname(cleanFilename).toLowerCase();
  let candidateFilename = cleanFilename;

  if (!ext) {
    const seedDir = getSeedDir();
    const probeExts = [".webp", ".png", ".jpg", ".jpeg", ".mp4", ".webm"];
    for (const probe of probeExts) {
      const probeName = cleanFilename + probe;
      const isImg = [".webp", ".png", ".jpg", ".jpeg"].includes(probe);
      const testDir = isImg ? IMAGE_DIR : VIDEO_DIR;
      if (fs.existsSync(path.join(testDir, probeName)) || (seedDir && fs.existsSync(path.join(seedDir, probeName)))) {
        ext = probe;
        candidateFilename = probeName;
        break;
      }
    }
  }

  const isImage = [".webp", ".png", ".jpg", ".jpeg"].includes(ext);
  const isVideo = [".mp4", ".webm", ".mov", ".ogv"].includes(ext);

  if (!isImage && !isVideo) return null;

  const primaryDir = isImage ? IMAGE_DIR : VIDEO_DIR;

  // 1. Try rawFilename in primaryDir
  let full = path.join(primaryDir, rawFilename);
  if (!fs.existsSync(full)) {
    // 2. Try candidateFilename in primaryDir
    full = path.join(primaryDir, candidateFilename);
  }

  // 3. Fallback to seed directory
  const seedDir = getSeedDir();
  if (!fs.existsSync(full) && seedDir) {
    const seedCandidate = path.join(seedDir, candidateFilename);
    if (fs.existsSync(seedCandidate)) full = seedCandidate;
  }

  if (!fs.existsSync(full)) return null;

  const mime =
    ext === ".webp"
      ? "image/webp"
      : ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".mp4"
            ? "video/mp4"
            : ext === ".webm"
              ? "video/webm"
              : ext === ".mov"
                ? "video/quicktime"
                : "video/ogg";

  return { fullPath: full, mime, ext };
}

mediaRouter.get("/:filename", (req, res) => {
  const raw = req.params.filename;
  const rawParam = Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "");
  const resolved = resolveMediaFilePath(rawParam);

  if (!resolved) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { fullPath, mime, ext } = resolved;

  // Thumbnail fast path for image tiles (`/api/media/<name>?thumb=320`).
  if (req.query.thumb !== undefined && mime.startsWith("image/") && ext !== ".gif") {
    const size = parseThumbSize(req.query.thumb);
    ensureThumb(fullPath, size)
      .then((thumbPath) => {
        const st = fs.statSync(thumbPath);
        res.setHeader("Content-Type", "image/webp");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Content-Length", String(st.size));
        fs.createReadStream(thumbPath).pipe(res);
      })
      .catch(() => {
        // Thumbnail generation failed (corrupt source?) — fall back to the
        // original file below instead of erroring the tile.
        sendFullFile(req, res, fullPath, mime);
      });
    return;
  }

  sendFullFile(req, res, fullPath, mime);
});

function sendFullFile(req: import("express").Request, res: import("express").Response, fullPath: string, mime: string): void {
  const stat = fs.statSync(fullPath);
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
    fs.createReadStream(fullPath, { start, end }).pipe(res);
    return;
  }

  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Length", String(stat.size));
  fs.createReadStream(fullPath).pipe(res);
}

export default mediaRouter;
