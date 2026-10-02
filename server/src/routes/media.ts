import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { IMAGE_DIR, VIDEO_DIR } from "../media.js";

const mediaRouter = Router();

const seedCandidates = [
  path.join(process.cwd(), "public", "seed"),
  path.join(process.cwd(), "server", "public", "seed"),
  path.resolve(__dirname, "..", "public", "seed"),
  path.resolve(__dirname, "../..", "public", "seed"),
  path.resolve(__dirname, "../../public/seed"),
  path.resolve(__dirname, "../../../public/seed"),
  path.resolve(__dirname, "../../../server/public/seed"),
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

export function resolveMediaFilePath(rawName: string): { fullPath: string; mime: string; ext: string } | null {
  const rawFilename = path.basename(rawName);
  const cleanFilename = rawFilename
    .replace(/^disk-\d+-/, "")
    .replace(/^disk-/, "")
    .replace(/^media-/, "");
  const ext = path.extname(cleanFilename).toLowerCase();

  const isImage = [".webp", ".png", ".jpg", ".jpeg"].includes(ext);
  const isVideo = [".mp4", ".webm", ".mov", ".ogv"].includes(ext);

  if (!isImage && !isVideo) return null;

  const primaryDir = isImage ? IMAGE_DIR : VIDEO_DIR;

  // 1. Try rawFilename in primaryDir
  let full = path.join(primaryDir, rawFilename);
  if (!fs.existsSync(full)) {
    // 2. Try cleanFilename in primaryDir
    full = path.join(primaryDir, cleanFilename);
  }

  // 3. Fallback to seed directory
  const seedDir = getSeedDir();
  if (!fs.existsSync(full) && seedDir) {
    const seedCandidate = path.join(seedDir, cleanFilename);
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

  const { fullPath, mime } = resolved;
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
});

export default mediaRouter;
