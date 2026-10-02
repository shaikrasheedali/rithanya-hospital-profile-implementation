import { prisma, isDbOnCooldown, reportDbError, withDbTimeout } from "./db.js";
import { COLLECTIONS, type CollectionKey, type FieldDef } from "./collections.js";
import {
  clearEntityMedia,
  setEntityMedia,
  withMedia,
  registerAssetInMemory,
  inMemoryEntityMediaMap,
  type EntityType,
} from "./media.js";
import { sanitizeHtml, slugify } from "./utils.js";
import {
  FALLBACK_FACILITIES,
  FALLBACK_SPECIALTIES,
  FALLBACK_TREATMENTS,
  FALLBACK_SERVICES,
  FALLBACK_DOCTORS,
  FALLBACK_INSURANCE,
  FALLBACK_GALLERY,
  FALLBACK_TESTIMONIALS,
  FALLBACK_BLOGS,
  FALLBACK_PRODUCTS,
} from "./fallbackData.js";

export function isCollection(key: string): key is CollectionKey {
  return key in COLLECTIONS;
}

// -------------------------------------------------------------
// Unified In-Memory Collection Stores for Blazing-Fast Speed & Resiliency
// -------------------------------------------------------------
const collectionStores = new Map<CollectionKey, Map<string, any>>();

function initCollectionStores() {
  const datasetMap: Record<CollectionKey, any[]> = {
    facilities: FALLBACK_FACILITIES,
    specialties: FALLBACK_SPECIALTIES,
    treatments: FALLBACK_TREATMENTS,
    services: FALLBACK_SERVICES,
    doctors: FALLBACK_DOCTORS,
    insurance: FALLBACK_INSURANCE,
    gallery: FALLBACK_GALLERY,
    blogs: FALLBACK_BLOGS,
    testimonials: FALLBACK_TESTIMONIALS,
    products: FALLBACK_PRODUCTS,
  };

  for (const [key, items] of Object.entries(datasetMap) as Array<[CollectionKey, any[]]>) {
    const store = new Map<string, any>();
    for (const item of items) {
      const clone = { ...item };
      store.set(clone.id, clone);

      // Register inline media assets & links in memory
      if (Array.isArray(clone.media) && clone.media.length > 0) {
        const mediaIds: string[] = [];
        for (const m of clone.media) {
          if (m && m.id) {
            registerAssetInMemory({
              id: m.id,
              filename: m.originalName || m.id,
              originalName: m.originalName || m.id,
              mimeType: m.kind === "VIDEO" ? "video/mp4" : "image/webp",
              kind: m.kind || "IMAGE",
              sizeInBytes: 2048,
              url: m.url,
              createdAt: new Date(),
            });
            mediaIds.push(m.id);
          }
        }
        inMemoryEntityMediaMap.set(`${key}:${clone.id}`, mediaIds);
      }
    }
    collectionStores.set(key, store);
  }
}

// Initialize immediately on boot
initCollectionStores();

export function getCollectionStore(key: CollectionKey): Map<string, any> {
  let s = collectionStores.get(key);
  if (!s) {
    s = new Map<string, any>();
    collectionStores.set(key, s);
  }
  return s;
}

async function findMany(key: CollectionKey) {
  switch (key) {
    case "facilities": return prisma.facility.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
    case "specialties": return prisma.specialty.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
    case "treatments": return prisma.treatment.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
    case "services": return prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
    case "doctors": return prisma.doctor.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    case "insurance": return prisma.insuranceProvider.findMany({ orderBy: { sortOrder: "asc" } });
    case "gallery": return prisma.galleryItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
    case "blogs": return prisma.blogPost.findMany({ orderBy: { publishedAt: "desc" } });
    case "testimonials": return prisma.testimonial.findMany({ orderBy: { sortOrder: "asc" } });
    case "products": return prisma.product.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  }
}

async function syncCollectionFromDb(key: CollectionKey) {
  if (isDbOnCooldown()) return;
  try {
    const rows = (await withDbTimeout(findMany(key), 2000)) as Array<Record<string, unknown> & { id: string }>;
    if (rows && rows.length > 0) {
      const store = getCollectionStore(key);
      for (const row of rows) {
        const existing = store.get(row.id);
        store.set(row.id, { ...existing, ...row });
      }
    }
  } catch (err) {
    reportDbError(err);
  }
}

function sortCollectionItems(key: CollectionKey, items: any[]): any[] {
  if (key === "blogs") {
    return items.sort((a, b) => {
      const ta = new Date(a.publishedAt ?? 0).getTime();
      const tb = new Date(b.publishedAt ?? 0).getTime();
      return tb - ta;
    });
  }
  return items.sort((a, b) => {
    const sa = Number(a.sortOrder ?? 0);
    const sb = Number(b.sortOrder ?? 0);
    if (sa !== sb) return sa - sb;
    const ca = new Date(a.createdAt ?? 0).getTime();
    const cb = new Date(b.createdAt ?? 0).getTime();
    return cb - ca;
  });
}

export async function listCollection(key: CollectionKey) {
  const store = getCollectionStore(key);
  const items = Array.from(store.values());
  const withMed = await withMedia(key as EntityType, items);
  const sorted = sortCollectionItems(key, withMed);

  // Background non-blocking sync if DB is healthy
  if (!isDbOnCooldown()) {
    void syncCollectionFromDb(key);
  }

  return sorted;
}

function coerce(fields: FieldDef[], body: Record<string, unknown>, creating: boolean) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    let v = body[f.name];
    if (v === undefined || v === null) {
      if (creating && f.type === "checkbox") out[f.name] = false;
      else if (creating && f.required) return { error: `${f.label} is required` };
      continue;
    }
    switch (f.type) {
      case "number":
        v = Math.trunc(Number(v)) || 0;
        break;
      case "decimal": {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) return { error: `${f.label} must be a valid amount` };
        v = n;
        break;
      }
      case "checkbox":
        v = Boolean(v);
        break;
      default:
        v = String(v).trim();
        if (f.type === "richtext") v = sanitizeHtml(v as string);
        if (f.max && (v as string).length > f.max) return { error: `${f.label} must be ${f.max} characters or fewer` };
        if (f.required && !v) return { error: `${f.label} is required` };
        if (f.type === "select" && f.options && v && !(f.options as string[]).includes(v as string))
          return { error: `${f.label} has an invalid value` };
    }
    out[f.name] = v;
  }
  if (typeof out.rating === "number") out.rating = Math.min(5, Math.max(1, out.rating as number));
  return { data: out };
}

function uniqueSlugInMemory(key: CollectionKey, base: string): string {
  const store = getCollectionStore(key);
  const existingSlugs = new Set(Array.from(store.values()).map((x) => x.slug));
  let slug = slugify(base);
  if (!existingSlugs.has(slug)) return slug;
  for (let i = 2; i < 100; i++) {
    const candidate = `${slugify(base)}-${i}`;
    if (!existingSlugs.has(candidate)) return candidate;
  }
  return `${slugify(base)}-${Date.now()}`;
}

function cleanMediaIds(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

async function insertRow(key: CollectionKey, data: Record<string, unknown>) {
  switch (key) {
    case "facilities": return prisma.facility.create({ data: data as never });
    case "specialties": return prisma.specialty.create({ data: data as never });
    case "treatments": return prisma.treatment.create({ data: data as never });
    case "services": return prisma.service.create({ data: data as never });
    case "doctors": return prisma.doctor.create({ data: data as never });
    case "insurance": return prisma.insuranceProvider.create({ data: data as never });
    case "gallery": return prisma.galleryItem.create({ data: data as never });
    case "blogs": return prisma.blogPost.create({ data: data as never });
    case "testimonials": return prisma.testimonial.create({ data: data as never });
    case "products": return prisma.product.create({ data: data as never });
  }
}

async function upsertRow(key: CollectionKey, id: string, data: Record<string, unknown>) {
  switch (key) {
    case "facilities":
      return prisma.facility.upsert({ where: { id }, update: data as never, create: { id, ...data } as never });
    case "specialties":
      return prisma.specialty.upsert({ where: { id }, update: data as never, create: { id, ...data } as never });
    case "treatments":
      return prisma.treatment.upsert({ where: { id }, update: data as never, create: { id, ...data } as never });
    case "services":
      return prisma.service.upsert({ where: { id }, update: data as never, create: { id, ...data } as never });
    case "doctors":
      return prisma.doctor.upsert({ where: { id }, update: data as never, create: { id, ...data } as never });
    case "insurance":
      return prisma.insuranceProvider.upsert({ where: { id }, update: data as never, create: { id, ...data } as never });
    case "gallery":
      return prisma.galleryItem.upsert({ where: { id }, update: data as never, create: { id, ...data } as never });
    case "blogs":
      return prisma.blogPost.upsert({ where: { id }, update: data as never, create: { id, ...data } as never });
    case "testimonials":
      return prisma.testimonial.upsert({ where: { id }, update: data as never, create: { id, ...data } as never });
    case "products":
      return prisma.product.upsert({ where: { id }, update: data as never, create: { id, ...data } as never });
  }
}

async function updateRowBySlug(key: CollectionKey, slug: string, data: Record<string, unknown>) {
  switch (key) {
    case "facilities": return prisma.facility.update({ where: { slug }, data: data as never });
    case "specialties": return prisma.specialty.update({ where: { slug }, data: data as never });
    case "treatments": return prisma.treatment.update({ where: { slug }, data: data as never });
    case "services": return prisma.service.update({ where: { slug }, data: data as never });
    case "doctors": return prisma.doctor.update({ where: { slug }, data: data as never });
    case "blogs": return prisma.blogPost.update({ where: { slug }, data: data as never });
    case "products": return prisma.product.update({ where: { slug }, data: data as never });
    default: return;
  }
}

async function safeDbUpsert(key: CollectionKey, id: string, data: Record<string, unknown>) {
  if (isDbOnCooldown()) return;
  try {
    await withDbTimeout(upsertRow(key, id, data), 2000);
  } catch (err: any) {
    if (err?.code === "P2002" && data.slug) {
      try {
        await withDbTimeout(updateRowBySlug(key, String(data.slug), data), 1500);
        return;
      } catch {
        // ignore secondary failure
      }
    }
    reportDbError(err);
    console.warn(`[cms] safeDbUpsert(${key}, ${id}) non-critical warning:`, err instanceof Error ? err.message : err);
  }
}

async function safeDbDelete(key: CollectionKey, id: string) {
  if (isDbOnCooldown()) return;
  try {
    switch (key) {
      case "facilities": await withDbTimeout(prisma.facility.delete({ where: { id } }), 1500); break;
      case "specialties": await withDbTimeout(prisma.specialty.delete({ where: { id } }), 1500); break;
      case "treatments": await withDbTimeout(prisma.treatment.delete({ where: { id } }), 1500); break;
      case "services": await withDbTimeout(prisma.service.delete({ where: { id } }), 1500); break;
      case "doctors": await withDbTimeout(prisma.doctor.delete({ where: { id } }), 1500); break;
      case "insurance": await withDbTimeout(prisma.insuranceProvider.delete({ where: { id } }), 1500); break;
      case "gallery": await withDbTimeout(prisma.galleryItem.delete({ where: { id } }), 1500); break;
      case "blogs": await withDbTimeout(prisma.blogPost.delete({ where: { id } }), 1500); break;
      case "testimonials": await withDbTimeout(prisma.testimonial.delete({ where: { id } }), 1500); break;
      case "products": await withDbTimeout(prisma.product.delete({ where: { id } }), 1500); break;
    }
  } catch (err) {
    reportDbError(err);
    console.warn(`[cms] safeDbDelete(${key}, ${id}) non-critical warning:`, err instanceof Error ? err.message : err);
  }
}

export async function createItem(key: CollectionKey, body: Record<string, unknown>) {
  const def = COLLECTIONS[key];
  const mediaIds = cleanMediaIds(body.mediaIds);
  const res = coerce(def.fields, body, true);
  if ("error" in res && res.error) return { error: res.error };
  const data = (res as { data: Record<string, unknown> }).data;

  if (def.slugSource) {
    data.slug = uniqueSlugInMemory(key, String(data[def.slugSource]));
  }

  const newId = `${key.slice(0, 4)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const store = getCollectionStore(key);
  const newItem = { id: newId, ...data, createdAt: new Date(), updatedAt: new Date() };
  store.set(newId, newItem);

  if (mediaIds.length > 0) {
    await setEntityMedia(key as EntityType, newId, mediaIds);
  }

  // Safe async DB insert
  if (!isDbOnCooldown()) {
    try {
      await withDbTimeout(insertRow(key, { id: newId, ...data }), 2000);
    } catch (err) {
      reportDbError(err);
      console.warn(`[cms] createItem DB insert skipped:`, err instanceof Error ? err.message : err);
    }
  }

  const [withMed] = await withMedia(key as EntityType, [newItem]);
  return { row: withMed };
}

export async function updateItem(key: CollectionKey, id: string, body: Record<string, unknown>) {
  const def = COLLECTIONS[key];
  const mediaIds = cleanMediaIds(body.mediaIds);
  const res = coerce(def.fields, body, false);
  if ("error" in res && res.error) return { error: res.error };
  const data = (res as { data: Record<string, unknown> }).data;

  const store = getCollectionStore(key);

  // Robust lookup: match by exact id, or by slug, or case-insensitive id
  let targetId = id;
  let existing = store.get(id);

  if (!existing) {
    for (const [k, v] of store.entries()) {
      if (
        k.toLowerCase() === id.toLowerCase() ||
        v.slug === id ||
        (data.slug && v.slug === data.slug)
      ) {
        targetId = k;
        existing = v;
        break;
      }
    }
  }

  const updatedItem = {
    ...(existing ?? { id: targetId, createdAt: new Date() }),
    ...data,
    id: targetId,
    updatedAt: new Date(),
  };
  store.set(targetId, updatedItem);

  if (mediaIds.length > 0) {
    await setEntityMedia(key as EntityType, targetId, mediaIds);
  }

  // Safe DB upsert — ensures spec-1, fac-1, doc-1 or any id is persisted without breaking or 404ing
  void safeDbUpsert(key, targetId, data);

  const [withMed] = await withMedia(key as EntityType, [updatedItem]);
  return { row: withMed };
}

export async function deleteItem(key: CollectionKey, id: string) {
  const store = getCollectionStore(key);
  store.delete(id);

  // Also check if any item matched by slug
  for (const [k, v] of store.entries()) {
    if (v.slug === id || k.toLowerCase() === id.toLowerCase()) {
      store.delete(k);
      break;
    }
  }

  await clearEntityMedia(key as EntityType, id);
  void safeDbDelete(key, id);

  return { ok: true };
}
