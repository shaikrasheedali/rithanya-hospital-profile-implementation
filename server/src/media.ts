import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
import { prisma, isDbOnCooldown, reportDbError, withDbTimeout } from "./db.js";
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
      .webp({ quality: 82, effort: 4, alphaQuality: 85 })
      .toBuffer();
    if (processed.length > MAX_BYTES) throw new Error("Processed image exceeds the strict 10MB threshold.");
    const filename = `${Date.now()}-${hashPart}.webp`;
    await fs.mkdir(IMAGE_DIR, { recursive: true });
    await fs.writeFile(path.join(IMAGE_DIR, filename), processed);

    const assetRecord: MediaAssetRecord = {
      id: `media-${Date.now()}-${hashPart}`,
      filename,
      originalName: file.originalname,
      mimeType: "image/webp",
      kind: "IMAGE",
      sizeInBytes: processed.length,
      url: `/api/media/${filename}`,
      createdAt: new Date(),
    };
    registerAssetInMemory(assetRecord);

    if (!isDbOnCooldown()) {
      try {
        const created = await withDbTimeout(
          prisma.mediaAsset.create({
            data: {
              filename,
              originalName: file.originalname,
              mimeType: "image/webp",
              kind: "IMAGE",
              sizeInBytes: processed.length,
              url: `/api/media/${filename}`,
            },
          }),
          2000,
        );
        registerAssetInMemory(created as MediaAssetRecord);
        return created as MediaAssetRecord;
      } catch (dbErr) {
        reportDbError(dbErr);
        console.warn("[media] DB insert timed out or failed, using memory record:", dbErr instanceof Error ? dbErr.message : dbErr);
      }
    }
    return assetRecord;
  }

  const ext = VIDEO_TYPES[file.mimetype];
  if (ext) {
    if (buf.length > MAX_VIDEO_BYTES) throw new Error("Video exceeds the 120MB limit.");
    const filename = `${Date.now()}-${hashPart}.${ext}`;
    await fs.mkdir(VIDEO_DIR, { recursive: true });
    await fs.writeFile(path.join(VIDEO_DIR, filename), buf);

    const assetRecord: MediaAssetRecord = {
      id: `media-${Date.now()}-${hashPart}`,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      kind: "VIDEO",
      sizeInBytes: buf.length,
      url: `/api/media/${filename}`,
      createdAt: new Date(),
    };
    registerAssetInMemory(assetRecord);

    if (!isDbOnCooldown()) {
      try {
        const created = await withDbTimeout(
          prisma.mediaAsset.create({
            data: {
              filename,
              originalName: file.originalname,
              mimeType: file.mimetype,
              kind: "VIDEO",
              sizeInBytes: buf.length,
              url: `/api/media/${filename}`,
            },
          }),
          2000,
        );
        registerAssetInMemory(created as MediaAssetRecord);
        return created as MediaAssetRecord;
      } catch (dbErr) {
        reportDbError(dbErr);
        console.warn("[media] DB insert timed out or failed, using memory record:", dbErr instanceof Error ? dbErr.message : dbErr);
      }
    }
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
    if (mediaIds && mediaIds.length > 0) {
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
        1500,
      );
      for (const r of rows) {
        const list = map.get(r.entityId) ?? [];
        list.push({ id: r.media.id, url: r.media.url, kind: r.media.kind as "IMAGE" | "VIDEO", originalName: r.media.originalName });
        map.set(r.entityId, list);
        // Also register in memory
        registerAssetInMemory(r.media as MediaAssetRecord);
      }
    } catch (err) {
      reportDbError(err);
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
  // Update in-memory mapping immediately
  inMemoryEntityMediaMap.set(`${entityType}:${entityId}`, unique);

  if (!isDbOnCooldown()) {
    try {
      await withDbTimeout(
        prisma.$transaction(async (tx) => {
          await tx.mediaLink.deleteMany({ where: { entityType, entityId } });
          if (unique.length) {
            // Only link media that exist in DB to prevent foreign key errors
            const existingAssets = await tx.mediaAsset.findMany({
              where: { id: { in: unique } },
              select: { id: true },
            });
            const validIds = new Set(existingAssets.map((a) => a.id));
            const toInsert = unique
              .filter((mId) => validIds.has(mId))
              .map((mediaId, i) => ({ entityType, entityId, mediaId, sortOrder: i }));
            if (toInsert.length) {
              await tx.mediaLink.createMany({ data: toInsert });
            }
          }
        }),
        2500,
      );
    } catch (err) {
      reportDbError(err);
      console.warn(`[media] setEntityMedia(${entityType}, ${entityId}) DB transaction failed:`, err instanceof Error ? err.message : err);
    }
  }
}

export async function clearEntityMedia(entityType: EntityType, entityId: string) {
  inMemoryEntityMediaMap.delete(`${entityType}:${entityId}`);
  if (!isDbOnCooldown()) {
    try {
      await withDbTimeout(prisma.mediaLink.deleteMany({ where: { entityType, entityId } }), 2000);
    } catch (err) {
      reportDbError(err);
    }
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
