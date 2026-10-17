import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
import {
  prisma,
  isDbOnCooldown,
  reportDbError,
  reportDbSuccess,
  withDbTimeout,
  DB_WRITE_MS,
  isTransientDbError,
} from "./db.js";
import { enqueueOutbox, outboxHasPending, registerOutboxExecutor, wakeOutbox } from "./outbox.js";
import type { MediaRef } from "./utils.js";

import fsSync from "node:fs";

function resolveUploadRoot(): string {
  const serverUploads = path.join(process.cwd(), "server", "uploads");
  if (fsSync.existsSync(serverUploads)) return serverUploads;
  const cwdUploads = path.join(process.cwd(), "uploads");
  if (fsSync.existsSync(cwdUploads)) return cwdUploads;
  const fromDir = path.resolve(__dirname, "..", "uploads");
  if (fsSync.existsSync(fromDir)) return fromDir;
  const fromDirDist = path.resolve(__dirname, "../..", "uploads");
  if (fsSync.existsSync(fromDirDist)) return fromDirDist;
  return path.join(process.cwd(), "uploads");
}

export const UPLOAD_ROOT = resolveUploadRoot();
export const IMAGE_DIR = path.join(UPLOAD_ROOT, "optimized");
export const VIDEO_DIR = path.join(UPLOAD_ROOT, "videos");
export const PRIVATE_DIR = path.join(UPLOAD_ROOT, "private");

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 120 * 1024 * 1024;
const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/ogg": "ogv",
};

export type EntityType =
  | "facilities"
  | "specialties"
  | "treatments"
  | "services"
  | "doctors"
  | "insurance"
  | "gallery"
  | "blogs"
  | "products"
  | "testimonials";

export type UploadedFile = { originalname: string; mimetype: string; buffer: Buffer; size: number };

export interface MediaAssetRecord {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  kind: "IMAGE" | "VIDEO";
  sizeInBytes: number;
  url: string;
  createdAt: Date;
}

// In-memory caches for near-instant retrieval and fallback resilience
export const inMemoryAssetStore = new Map<string, MediaAssetRecord>();
export const inMemoryEntityMediaMap = new Map<string, string[]>();

/**
 * Recency guard for in-memory media links: entries written via setEntityMedia
 * are trusted for a short window (fast immediate UI feedback); after that the
 * DB link table is authoritative again and stale cache entries are ignored.
 */
const MEDIA_WRITE_FRESH_MS = 15_000;
const gMedia = globalThis as typeof globalThis & { __rhRecentMediaWrites?: Map<string, number> };
gMedia.__rhRecentMediaWrites ??= new Map<string, number>();
const recentMediaWrites = gMedia.__rhRecentMediaWrites;

function touchMediaWrite(entityKey: string): void {
  recentMediaWrites.set(entityKey, Date.now());
}

function isFreshMediaWrite(entityKey: string): boolean {
  const at = recentMediaWrites.get(entityKey);
  return at !== undefined && Date.now() - at < MEDIA_WRITE_FRESH_MS;
}

/** Persist a MediaAsset row; awaits the DB (10s) or queues durably on failure. */
async function persistAsset(data: {
  filename: string;
  originalName: string;
  mimeType: string;
  kind: "IMAGE" | "VIDEO";
  sizeInBytes: number;
  url: string;
}): Promise<void> {
  const op = { module: "media", action: "asset", key: `asset:${data.filename}`, payload: data };
  if (outboxHasPending("media") || isDbOnCooldown()) {
    enqueueOutbox(op);
    return;
  }
  try {
    await withDbTimeout(prisma.mediaAsset.create({ data }), DB_WRITE_MS);
    reportDbSuccess();
    wakeOutbox();
  } catch (err) {
    if (isTransientDbError(err)) reportDbError(err);
    enqueueOutbox(op);
  }
}

/** Shared transaction used by both live writes and outbox replay. */
async function applyEntityMedia(
  entityType: EntityType,
  entityId: string,
  unique: string[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.mediaLink.deleteMany({ where: { entityType, entityId } });
    if (unique.length) {
      // Find existing DB assets by either id or filename
      const existingAssets = await tx.mediaAsset.findMany({
        where: {
          OR: [
            { id: { in: unique } },
            { filename: { in: unique } },
          ],
        },
        select: { id: true, filename: true },
      });
      const assetByFilename = new Map(existingAssets.map((a) => [a.filename, a.id]));
      const validIds = new Set(existingAssets.map((a) => a.id));

      const toInsert: Array<{ entityType: string; entityId: string; mediaId: string; sortOrder: number }> = [];
      for (let i = 0; i < unique.length; i++) {
        const mId = unique[i];
        let resolvedId = validIds.has(mId) ? mId : assetByFilename.get(mId);
        if (!resolvedId) {
          const clean = mId.replace(/^disk-\d+-/, "").replace(/^disk-/, "").replace(/^media-/, "");
          const mem = inMemoryAssetStore.get(mId) || inMemoryAssetStore.get(clean);
          if (mem) {
            try {
              const created = await tx.mediaAsset.create({
                data: {
                  filename: mem.filename || clean,
                  originalName: mem.originalName || clean,
                  mimeType: mem.mimeType || "image/webp",
                  kind: mem.kind || "IMAGE",
                  sizeInBytes: mem.sizeInBytes || 2048,
                  url: mem.url || `/api/media/${clean}`,
                },
              });
              resolvedId = created.id;
              validIds.add(created.id);
              assetByFilename.set(created.filename, created.id);
            } catch {
              // ignore collision
            }
          }
        }
        if (resolvedId) {
          toInsert.push({ entityType, entityId, mediaId: resolvedId, sortOrder: i });
        }
      }
      if (toInsert.length) {
        await tx.mediaLink.createMany({ data: toInsert });
      }
    }
  });
}

export function registerAssetInMemory(asset: MediaAssetRecord): void {
  inMemoryAssetStore.set(asset.id, asset);
  if (asset.filename) {
    inMemoryAssetStore.set(asset.filename, asset);
    const clean = asset.filename.replace(/^disk-\d+-/, "").replace(/^disk-/, "").replace(/^media-/, "");
    inMemoryAssetStore.set(clean, asset);
  }
}

export async function saveUploadFile(file: UploadedFile): Promise<MediaAssetRecord> {
  const buf = file.buffer;
  const hashPart = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);

  if (file.mimetype.startsWith("image/")) {
    const processed = await sharp(buf)
      .rotate()
      .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 2, alphaQuality: 85 })
      .toBuffer();
    if (processed.length > MAX_BYTES) throw new Error("Processed image exceeds the strict 10MB threshold.");
    const filename = `${Date.now()}-${hashPart}.webp`;
    await fs.mkdir(IMAGE_DIR, { recursive: true });
    await fs.writeFile(path.join(IMAGE_DIR, filename), processed);

    const assetRecord: MediaAssetRecord = {
      id: filename,
      filename,
      originalName: file.originalname,
      mimeType: "image/webp",
      kind: "IMAGE",
      sizeInBytes: processed.length,
      url: `/api/media/${filename}`,
      createdAt: new Date(),
    };
    registerAssetInMemory(assetRecord);
    inMemoryAssetStore.set(filename, assetRecord);
    inMemoryAssetStore.set(`media-${filename}`, assetRecord);
    inMemoryAssetStore.set(`media-${Date.now()}-${hashPart}`, assetRecord);
    inMemoryAssetStore.set(`${Date.now()}-${hashPart}`, assetRecord);

    await persistAsset({
      filename,
      originalName: file.originalname,
      mimeType: "image/webp",
      kind: "IMAGE",
      sizeInBytes: processed.length,
      url: `/api/media/${filename}`,
    });
    return assetRecord;
  }

  const ext = VIDEO_TYPES[file.mimetype];
  if (ext) {
    if (buf.length > MAX_VIDEO_BYTES) throw new Error("Video exceeds the 120MB limit.");
    const filename = `${Date.now()}-${hashPart}.${ext}`;
    await fs.mkdir(VIDEO_DIR, { recursive: true });
    await fs.writeFile(path.join(VIDEO_DIR, filename), buf);

    const assetRecord: MediaAssetRecord = {
      id: filename,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      kind: "VIDEO",
      sizeInBytes: buf.length,
      url: `/api/media/${filename}`,
      createdAt: new Date(),
    };
    registerAssetInMemory(assetRecord);
    inMemoryAssetStore.set(filename, assetRecord);
    inMemoryAssetStore.set(`media-${filename}`, assetRecord);
    inMemoryAssetStore.set(`media-${Date.now()}-${hashPart}`, assetRecord);
    inMemoryAssetStore.set(`${Date.now()}-${hashPart}`, assetRecord);

    await persistAsset({
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      kind: "VIDEO",
      sizeInBytes: buf.length,
      url: `/api/media/${filename}`,
    });
    return assetRecord;
  }
  throw new Error(`Unsupported file type: ${file.mimetype || "unknown"}. Upload an image or an MP4/WebM video.`);
}

export async function mediaMapFor(entityType: EntityType, ids: string[]): Promise<Map<string, MediaRef[]>> {
  const map = new Map<string, MediaRef[]>();
  if (!ids.length) return map;

  const missingIds: string[] = [];

  for (const id of ids) {
    const key = `${entityType}:${id}`;
    const mediaIds = inMemoryEntityMediaMap.get(key);
    if (mediaIds && mediaIds.length > 0 && isFreshMediaWrite(key)) {
      const refs: MediaRef[] = [];
      for (const mId of mediaIds) {
        const clean = mId.replace(/^disk-\d+-/, "").replace(/^disk-/, "").replace(/^media-/, "");
        const a = inMemoryAssetStore.get(mId) || inMemoryAssetStore.get(clean);
        if (a) {
          refs.push({ id: a.id, url: a.url, kind: a.kind, originalName: a.originalName });
        } else {
          // If clean is an uploaded file or seed path
          const isVideo = clean.endsWith(".mp4") || clean.endsWith(".webm") || clean.endsWith(".mov");
          const url = clean.startsWith("/") ? clean : `/api/media/${clean}`;
          refs.push({ id: clean, url, kind: isVideo ? "VIDEO" : "IMAGE", originalName: clean });
        }
      }
      map.set(id, refs);
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length > 0 && !isDbOnCooldown()) {
    try {
      const rows = await withDbTimeout(
        prisma.mediaLink.findMany({
          where: { entityType, entityId: { in: missingIds } },
          include: { media: true },
          orderBy: { sortOrder: "asc" },
        }),
        DB_WRITE_MS,
      );
      for (const r of rows) {
        const list = map.get(r.entityId) ?? [];
        list.push({ id: r.media.id, url: r.media.url, kind: r.media.kind as "IMAGE" | "VIDEO", originalName: r.media.originalName });
        map.set(r.entityId, list);
        // Also register in memory
        registerAssetInMemory(r.media as MediaAssetRecord);
      }
    } catch (err) {
      if (isTransientDbError(err)) reportDbError(err);
      console.warn(`[media] DB read for ${entityType} media links skipped:`, err instanceof Error ? err.message : err);
    }
  }
  return map;
}

export async function withMedia<T extends { id: string }>(
  entityType: EntityType,
  rows: T[],
): Promise<(T & { media: MediaRef[] })[]> {
  const map = await mediaMapFor(entityType, rows.map((r) => r.id));
  return rows.map((r) => {
    // If the item already had an inline fallback media array and map had nothing, preserve inline media
    const existing = (r as unknown as { media?: MediaRef[] }).media;
    const resolved = map.get(r.id);
    return { ...r, media: resolved && resolved.length ? resolved : (existing ?? []) };
  });
}

export async function setEntityMedia(entityType: EntityType, entityId: string, mediaIds: string[]) {
  const normalized = mediaIds.map((m) => m.replace(/^disk-\d+-/, "").replace(/^disk-/, ""));
  const unique = Array.from(new Set(normalized));
  const entityKey = `${entityType}:${entityId}`;
  // Update in-memory mapping immediately (DUPLICATE cleans like `media-` ids kept out of links)
  inMemoryEntityMediaMap.set(entityKey, unique);
  touchMediaWrite(entityKey);

  const op = { module: "media", action: "link", key: `link:${entityType}:${entityId}`, payload: { entityType, entityId, mediaIds: unique } };
  if (outboxHasPending("media") || isDbOnCooldown()) {
    enqueueOutbox(op);
    return;
  }
  try {
    await withDbTimeout(applyEntityMedia(entityType, entityId, unique), DB_WRITE_MS);
    reportDbSuccess();
    wakeOutbox();
  } catch (err) {
    if (isTransientDbError(err)) reportDbError(err);
    enqueueOutbox(op);
  }
}

export async function clearEntityMedia(entityType: EntityType, entityId: string) {
  const entityKey = `${entityType}:${entityId}`;
  inMemoryEntityMediaMap.delete(entityKey);
  touchMediaWrite(entityKey);
  const op = { module: "media", action: "clearLink", key: `link:${entityType}:${entityId}`, payload: { entityType, entityId } };
  if (outboxHasPending("media") || isDbOnCooldown()) {
    enqueueOutbox(op);
    return;
  }
  try {
    await withDbTimeout(prisma.mediaLink.deleteMany({ where: { entityType, entityId } }), DB_WRITE_MS);
    reportDbSuccess();
    wakeOutbox();
  } catch (err) {
    if (isTransientDbError(err)) reportDbError(err);
    enqueueOutbox(op);
  }
}

export async function deleteAssetFile(asset: { filename: string; url: string }) {
  inMemoryAssetStore.delete(asset.filename);
  if (!asset.url.startsWith("/api/media/")) return;
  for (const dir of [IMAGE_DIR, VIDEO_DIR]) {
    await fs.rm(path.join(dir, asset.filename), { force: true });
  }
}

export const cover = (media: MediaRef[] | undefined): MediaRef | undefined =>
  media?.find((m) => m.kind === "IMAGE") ?? media?.[0];

// ---------------------------------------------------------------------------
// Durable outbox replay for media writes
// ---------------------------------------------------------------------------
registerOutboxExecutor("media", async (op) => {
  const payload = (op.payload ?? {}) as {
    entityType?: EntityType;
    entityId?: string;
    mediaIds?: string[];
    filename?: string;
    originalName?: string;
    mimeType?: string;
    kind?: "IMAGE" | "VIDEO";
    sizeInBytes?: number;
    url?: string;
  };

  if (op.action === "asset") {
    const data = {
      filename: String(payload.filename ?? ""),
      originalName: String(payload.originalName ?? ""),
      mimeType: String(payload.mimeType ?? "image/webp"),
      kind: (payload.kind ?? "IMAGE") as "IMAGE" | "VIDEO",
      sizeInBytes: Number(payload.sizeInBytes ?? 2048),
      url: String(payload.url ?? "/api/media/"),
    };
    if (!data.filename) return;
    try {
      await withDbTimeout(prisma.mediaAsset.create({ data }), DB_WRITE_MS);
    } catch (err: any) {
      if (err?.code === "P2002") return; // asset row already exists — dedupe retains it
      throw err;
    }
    return;
  }

  if (op.action === "link") {
    if (!payload.entityType || !payload.entityId || !Array.isArray(payload.mediaIds)) return;
    await withDbTimeout(
      applyEntityMedia(payload.entityType, payload.entityId, payload.mediaIds.map(String)),
      DB_WRITE_MS,
    );
    return;
  }

  if (op.action === "clearLink") {
    if (!payload.entityType || !payload.entityId) return;
    await withDbTimeout(
      prisma.mediaLink.deleteMany({ where: { entityType: payload.entityType, entityId: payload.entityId } }),
      DB_WRITE_MS,
    );
    return;
  }

  if (op.action === "delete") {
    const id = String((op.payload as { id?: string })?.id ?? "").replace(/^disk-\d+-/, "").replace(/^disk-/, "").replace(/^media-/, "");
    if (!id) return;
    // Asset row may exist under the bare id, filename, or a media- alias.
    await withDbTimeout(
      prisma.mediaAsset.deleteMany({
        where: { OR: [{ id }, { filename: id }] },
      }),
      DB_WRITE_MS,
    );
    return;
  }
});
