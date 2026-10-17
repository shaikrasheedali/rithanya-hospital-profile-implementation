import {
  prisma,
  isDbOnCooldown,
  reportDbError,
  reportDbSuccess,
  withDbTimeout,
  DB_READ_MS,
  DB_WRITE_MS,
  isTransientDbError,
} from "./db.js";
import { COLLECTIONS, type CollectionKey, type FieldDef } from "./collections.js";
import {
  clearEntityMedia,
  setEntityMedia,
  withMedia,
  registerAssetInMemory,
  inMemoryAssetStore,
  type EntityType,
} from "./media.js";
import { sanitizeHtml, slugify } from "./utils.js";
import { enqueueOutbox, outboxHasPending, registerOutboxExecutor, wakeOutbox } from "./outbox.js";
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

// -----------------------------------------------------------------------------
// In-memory cache that MIRRORS the database.
//
// The database is the single source of truth. The cache is populated:
//   1. from the DB whenever a list is read and no writes are pending in the
//      durable outbox (queued writes make the DB temporarily stale), or
//   2. from the bundled fallback seed ONLY while the DB has never been
//      reachable — so the public site keeps working during outages.
//
// Writes always update the cache immediately and are persisted to the DB with
// a generous, awaited timeout; on DB failure they are appended to the durable
// outbox and replayed automatically once the DB is healthy again.
// -----------------------------------------------------------------------------
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

const g = globalThis as typeof globalThis & {
  __rhCmsStores?: Map<CollectionKey, Map<string, any>>;
  __rhCmsLoaded?: Set<CollectionKey>;
};
g.__rhCmsStores ??= new Map<CollectionKey, Map<string, any>>();
g.__rhCmsLoaded ??= new Set<CollectionKey>();
const collectionStores = g.__rhCmsStores;
const loadedFromDb = g.__rhCmsLoaded;

/** Seed the in-memory cache from bundled fallback content (offline bootstrap only). */
function ensureFallbackCache(key: CollectionKey): void {
  const store = getCollectionStore(key);
  if (store.size > 0) return;
  for (const item of datasetMap[key] ?? []) {
    const clone = { ...item };
    store.set(clone.id, clone);

    // Register inline media assets & links in memory
    if (Array.isArray(clone.media) && clone.media.length > 0) {
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
        }
      }
    }
  }
}

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

/** Read the authoritative rows for a collection. Returns null when the DB is unreachable. */
async function loadDbRows(key: CollectionKey): Promise<Array<Record<string, any> & { id: string }> | null> {
  if (isDbOnCooldown()) return null;
  try {
    const rows = (await withDbTimeout(findMany(key), DB_READ_MS)) as Array<
      Record<string, any> & { id: string }
    >;
    reportDbSuccess();
    return rows;
  } catch (err) {
    if (isTransientDbError(err)) reportDbError(err);
    return null;
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

  // Refresh the cache from the DB (source of truth) whenever there are no
  // pending queued writes for CMS. While the outbox holds pending CMS writes
  // the DB copy is older than our cache, so we keep serving the cache.
  if (!outboxHasPending("cms")) {
    const rows = await loadDbRows(key);
    if (rows) {
      store.clear();
      for (const row of rows) store.set(String(row.id), { ...row });
      loadedFromDb.add(key);
    }
  }

  // Offline bootstrap: never DB-loaded and still empty → serve bundled content.
  if (!loadedFromDb.has(key) && store.size === 0) ensureFallbackCache(key);

  const items = Array.from(store.values());
  const withMed = await withMedia(key as EntityType, items);
  return sortCollectionItems(key, withMed);
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
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((rawId) => {
      const stripped = rawId.replace(/^disk-\d+-/, "").replace(/^disk-/, "");
      const mem = inMemoryAssetStore.get(rawId) || inMemoryAssetStore.get(stripped);
      if (mem && mem.filename) return mem.filename;
      return stripped;
    });
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

async function updateRow(key: CollectionKey, id: string, data: Record<string, unknown>) {
  switch (key) {
    case "facilities": return prisma.facility.update({ where: { id }, data: data as never });
    case "specialties": return prisma.specialty.update({ where: { id }, data: data as never });
    case "treatments": return prisma.treatment.update({ where: { id }, data: data as never });
    case "services": return prisma.service.update({ where: { id }, data: data as never });
    case "doctors": return prisma.doctor.update({ where: { id }, data: data as never });
    case "insurance": return prisma.insuranceProvider.update({ where: { id }, data: data as never });
    case "gallery": return prisma.galleryItem.update({ where: { id }, data: data as never });
    case "blogs": return prisma.blogPost.update({ where: { id }, data: data as never });
    case "testimonials": return prisma.testimonial.update({ where: { id }, data: data as never });
    case "products": return prisma.product.update({ where: { id }, data: data as never });
  }
}

/** Extract the DB-relevant columns of an in-memory item (never an EMR/media relation). */
function rowForDb(key: CollectionKey, item: Record<string, any>): Record<string, unknown> {
  const def = COLLECTIONS[key];
  const row: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (item[f.name] !== undefined && item[f.name] !== null) {
      row[f.name] = item[f.name];
    } else if (f.type === "checkbox" && item[f.name] === undefined) {
      row[f.name] = false;
    }
  }
  if (def.slugSource && item.slug) row.slug = item.slug;
  return row;
}

/**
 * Awaited persistence for CMS writes.
 * - DB reachable → write directly (10s ceiling) and confirm to the admin.
 * - DB down / write failed → append to the encrypted durable outbox and replay
 *   automatically when the DB recovers. The in-memory cache already reflects
 *   the change, so the UI is correct immediately and stays correct.
 */
async function persistWrite(
  op: { module: "cms"; action: "create" | "upsert" | "delete"; key: string; payload: unknown },
  run: () => Promise<unknown>,
): Promise<void> {
  if (outboxHasPending("cms")) {
    enqueueOutbox(op);
    wakeOutbox();
    return;
  }
  if (isDbOnCooldown()) {
    enqueueOutbox(op);
    return;
  }
  try {
    await withDbTimeout(run(), DB_WRITE_MS);
    reportDbSuccess();
    wakeOutbox();
  } catch (err) {
    if (isTransientDbError(err)) {
      reportDbError(err);
      enqueueOutbox(op);
    } else {
      // Data-logic error (e.g. unique slug on replayed insert) — surface it.
      console.warn(`[cms] persistWrite ${op.action}/${op.key} data error:`, (err as Error)?.message ?? err);
      enqueueOutbox(op);
    }
  }
}

export async function createItem(key: CollectionKey, body: Record<string, unknown>) {
  const def = COLLECTIONS[key];
  const mediaIds = cleanMediaIds(body.mediaIds);
  // Creation mirrors the admin UI rule (and the update path): every CMS item
  // must reference at least one image or video.
  if (mediaIds.length === 0) return { error: "Add at least one image or video" };
  const res = coerce(def.fields, body, true);
  if ("error" in res && res.error) return { error: res.error };
  const data = (res as { data: Record<string, unknown> }).data;

  let slug = def.slugSource ? uniqueSlugInMemory(key, String(data[def.slugSource])) : "";

  const newId = `${key.slice(0, 4)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const store = getCollectionStore(key);
  const newItem: Record<string, any> = {
    id: newId,
    ...(slug ? { slug } : {}),
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.set(newId, newItem);

  if (mediaIds.length > 0) {
    await setEntityMedia(key as EntityType, newId, mediaIds);
  }

  // Awaited DB insert with unique-slug retry (DB is authoritative on conflicts).
  let attempt = 0;
  for (;;) {
    const row = rowForDb(key, { ...newItem, ...(slug ? { slug } : {}) });
    const op = {
      module: "cms" as const,
      action: "create" as const,
      key: `c:${key}:${newId}`,
      payload: { key, id: newId, row },
    };
    if (outboxHasPending("cms") === false && !isDbOnCooldown()) {
      try {
        // Persist the SAME id the in-memory cache and media links use (the
        // replay path and seed data do the same) — otherwise the DB row gets a
        // random uuid and withMedia()/deleteItem() can never match its links.
        await withDbTimeout(insertRow(key, { id: newId, ...row }), DB_WRITE_MS);
        reportDbSuccess();
        if (slug !== newItem.slug) {
          // DB adjusted our slug — mirror it in memory and media links.
          newItem.slug = slug;
        }
        wakeOutbox();
        break;
      } catch (err: any) {
        if (err?.code === "P2002" && def.slugSource && attempt < 4) {
          attempt += 1;
          slug = `${slugify(String(data[def.slugSource]))}-${attempt + 1}`;
          continue;
        }
        if (isTransientDbError(err)) reportDbError(err);
        enqueueOutbox(op);
        break;
      }
    } else {
      enqueueOutbox(op);
      break;
    }
  }

  const [withMed] = await withMedia(key as EntityType, [newItem] as Array<{ id: string }>);
  return { row: withMed };
}

export async function updateItem(key: CollectionKey, id: string, body: Record<string, unknown>) {
  const def = COLLECTIONS[key];
  const mediaIds = cleanMediaIds(body.mediaIds);

  // The admin UI always enforces at least one media item; the server mirrors
  // that rule whenever a media list is explicitly sent.
  if (body.mediaIds !== undefined && mediaIds.length === 0) {
    return { error: "Add at least one image or video" };
  }

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

  if (!existing) return { error: "Item not found" };

  const updatedItem = {
    ...existing,
    ...data,
    id: targetId,
    updatedAt: new Date(),
  } as Record<string, any>;
  store.set(targetId, updatedItem);

  if (mediaIds.length > 0) {
    await setEntityMedia(key as EntityType, targetId, mediaIds);
  }

  await persistWrite(
    {
      module: "cms",
      action: "upsert",
      key: `u:${key}:${targetId}`,
      payload: { key, id: targetId, data: { ...rowForDb(key, updatedItem), ...data } },
    },
    () => updateRow(key, targetId, data),
  );

  const [withMed] = await withMedia(key as EntityType, [updatedItem] as Array<{ id: string }>);
  return { row: withMed };
}

export async function deleteItem(key: CollectionKey, id: string) {
  const store = getCollectionStore(key);
  store.delete(id);

  // Fallback resolution: some callers pass a slug instead of the id.
  let resolvedId = id;
  for (const [k, v] of store.entries()) {
    if (v.slug === id || k.toLowerCase() === id.toLowerCase()) {
      store.delete(k);
      resolvedId = k;
      break;
    }
  }

  await clearEntityMedia(key as EntityType, resolvedId);

  await persistWrite(
    { module: "cms", action: "delete", key: `d:${key}:${resolvedId}`, payload: { key, id: resolvedId } },
    async () => {
      switch (key) {
        case "facilities": return prisma.facility.deleteMany({ where: { id: resolvedId } });
        case "specialties": return prisma.specialty.deleteMany({ where: { id: resolvedId } });
        case "treatments": return prisma.treatment.deleteMany({ where: { id: resolvedId } });
        case "services": return prisma.service.deleteMany({ where: { id: resolvedId } });
        case "doctors": return prisma.doctor.deleteMany({ where: { id: resolvedId } });
        case "insurance": return prisma.insuranceProvider.deleteMany({ where: { id: resolvedId } });
        case "gallery": return prisma.galleryItem.deleteMany({ where: { id: resolvedId } });
        case "blogs": return prisma.blogPost.deleteMany({ where: { id: resolvedId } });
        case "testimonials": return prisma.testimonial.deleteMany({ where: { id: resolvedId } });
        case "products": return prisma.product.deleteMany({ where: { id: resolvedId } });
      }
    },
  );

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Durable outbox replay for CMS writes
// ---------------------------------------------------------------------------
registerOutboxExecutor("cms", async (op) => {
  const payload = (op.payload ?? {}) as {
    key: CollectionKey;
    id?: string;
    row?: Record<string, unknown>;
    data?: Record<string, unknown>;
  };
  const key = payload.key;
  const row = { ...(payload.row ?? {}), ...(payload.data ?? {}) };

  if (op.action === "delete") {
    const id = String(payload.id ?? "");
    switch (key) {
      case "facilities": await prisma.facility.deleteMany({ where: { id } }); break;
      case "specialties": await prisma.specialty.deleteMany({ where: { id } }); break;
      case "treatments": await prisma.treatment.deleteMany({ where: { id } }); break;
      case "services": await prisma.service.deleteMany({ where: { id } }); break;
      case "doctors": await prisma.doctor.deleteMany({ where: { id } }); break;
      case "insurance": await prisma.insuranceProvider.deleteMany({ where: { id } }); break;
      case "gallery": await prisma.galleryItem.deleteMany({ where: { id } }); break;
      case "blogs": await prisma.blogPost.deleteMany({ where: { id } }); break;
      case "testimonials": await prisma.testimonial.deleteMany({ where: { id } }); break;
      case "products": await prisma.product.deleteMany({ where: { id } }); break;
    }
    return;
  }

  if (!row || typeof row !== "object") return;

  if (op.action === "create") {
    const id = String(payload.id ?? op.id);
    if (!id) return;
    // Row already exists under this id — treat as an update instead.
    try {
      await withDbTimeout(insertRow(key, { id, ...row }), DB_WRITE_MS);
      return;
    } catch (err: any) {
      if (err?.code === "P2002") {
        // Unique conflict (id reused or slug taken): update by id, then by slug.
        try {
          await withDbTimeout(updateRow(key, id, row), DB_WRITE_MS);
          return;
        } catch {
          if (row.slug && typeof row.slug === "string") {
            await withDbTimeout(updateRow(key, String(row.slug), row), DB_WRITE_MS);
            return;
          }
          throw err;
        }
      }
      throw err;
    }
  }

  // "upsert": try update-by-id first; create only when the row is missing.
  if (!payload.id) return;
  try {
    await withDbTimeout(updateRow(key, payload.id, row), DB_WRITE_MS);
  } catch (err: any) {
    if (err?.code === "P2025") {
      const slug = row.slug ?? slugify(String(row[COLLECTIONS[key]?.slugSource ?? "title"] ?? payload.id));
      await withDbTimeout(insertRow(key, { id: payload.id, ...row, slug }), DB_WRITE_MS);
      return;
    }
    throw err;
  }
});
