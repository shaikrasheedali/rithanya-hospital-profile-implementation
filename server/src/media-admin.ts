import fs from "node:fs/promises";
import fsSync from "node:fs";
import { prisma, isDbOnCooldown, reportDbError, withDbTimeout } from "./db.js";
import { getSettings } from "./settings.js";
import { IMAGE_DIR, inMemoryAssetStore, registerAssetInMemory } from "./media.js";

export type AssetRow = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  kind: "IMAGE" | "VIDEO";
  sizeInBytes: number;
  url: string;
  createdAt: Date;
  refs: number;
  linkedTo: string[];
};

export async function listAssets(): Promise<AssetRow[]> {
  if (!isDbOnCooldown()) {
    try {
      const assets = await withDbTimeout(
        prisma.mediaAsset.findMany({
          include: { links: true },
          orderBy: { createdAt: "desc" },
        }),
        1500,
      );
      const s = await getSettings();
      return assets.map((a) => {
        const linkedTo = Array.from(new Set(a.links.map((l) => l.entityType)));
        const extra: string[] = [];
        if (s.faviconUrl === a.url) extra.push("favicon");
        if (s.socialShareThumbnailUrl === a.url) extra.push("og-image");
        const row: AssetRow = {
          id: a.id,
          filename: a.filename,
          originalName: a.originalName,
          mimeType: a.mimeType,
          kind: a.kind as "IMAGE" | "VIDEO",
          sizeInBytes: a.sizeInBytes,
          url: a.url,
          createdAt: a.createdAt,
          refs: a.links.length + extra.length,
          linkedTo: [...linkedTo, ...extra],
        };
        registerAssetInMemory(row);
        return row;
      });
    } catch (err) {
      reportDbError(err);
      console.warn("[media-admin] Failed to load assets from DB, scanning disk fallback:", err instanceof Error ? err.message : err);
    }
  }

  // Graceful fallback from in-memory assets & disk: scan IMAGE_DIR
  const list: AssetRow[] = [];
  const seenUrls = new Set<string>();

  for (const a of inMemoryAssetStore.values()) {
    if (!seenUrls.has(a.url)) {
      seenUrls.add(a.url);
      list.push({
        id: a.id,
        filename: a.filename,
        originalName: a.originalName,
        mimeType: a.mimeType,
        kind: a.kind,
        sizeInBytes: a.sizeInBytes,
        url: a.url,
        createdAt: a.createdAt,
        refs: 1,
        linkedTo: ["active"],
      });
    }
  }

  try {
    if (fsSync.existsSync(IMAGE_DIR)) {
      const files = await fs.readdir(IMAGE_DIR);
      for (const [idx, f] of files.entries()) {
        const url = `/api/media/${f}`;
        if (!seenUrls.has(url) && (f.endsWith(".webp") || f.endsWith(".png") || f.endsWith(".jpg"))) {
          seenUrls.add(url);
          const assetRecord: AssetRow = {
            id: f, // Clean filename as primary ID
            filename: f,
            originalName: f,
            mimeType: "image/webp",
            kind: "IMAGE" as const,
            sizeInBytes: 2048,
            url,
            createdAt: new Date(),
            refs: 0,
            linkedTo: [],
          };
          list.push(assetRecord);

          // Register in memory under all possible identifiers for total resiliency
          registerAssetInMemory(assetRecord);
          inMemoryAssetStore.set(f, assetRecord);
          inMemoryAssetStore.set(`disk-${idx}-${f}`, assetRecord);
          inMemoryAssetStore.set(`disk-${f}`, assetRecord);
          inMemoryAssetStore.set(`media-${f}`, assetRecord);
        }
      }
    }
  } catch (diskErr) {
    console.warn("[media-admin] Fallback disk scan error:", diskErr);
  }
  return list;
}
