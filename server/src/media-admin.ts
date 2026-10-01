import { prisma } from "./db.js";
import { getSettings } from "./settings.js";

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
  const assets = await prisma.mediaAsset.findMany({
    include: { links: true },
    orderBy: { createdAt: "desc" },
  });
  const s = await getSettings();
  return assets.map((a) => {
    const linkedTo = Array.from(new Set(a.links.map((l) => l.entityType)));
    const extra: string[] = [];
    if (s.faviconUrl === a.url) extra.push("favicon");
    if (s.socialShareThumbnailUrl === a.url) extra.push("og-image");
    return {
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
  });
}
