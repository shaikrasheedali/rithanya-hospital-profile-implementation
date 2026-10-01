import { prisma } from "./db.js";
import { COLLECTIONS, type CollectionKey, type FieldDef } from "./collections.js";
import { clearEntityMedia, setEntityMedia, withMedia, type EntityType } from "./media.js";
import { sanitizeHtml, slugify } from "./utils.js";

export function isCollection(key: string): key is CollectionKey {
  return key in COLLECTIONS;
}

async function findMany(key: CollectionKey) {
  switch (key) {
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

export async function listCollection(key: CollectionKey) {
  const rows = (await findMany(key)) as Array<{ id: string }>;
  return withMedia(key as EntityType, rows);
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

async function uniqueSlug(key: CollectionKey, base: string): Promise<string> {
  let slug = slugify(base);
  for (let i = 2; i < 50; i++) {
    let hit: unknown = null;
    switch (key) {
      case "specialties": hit = await prisma.specialty.findUnique({ where: { slug } }); break;
      case "treatments": hit = await prisma.treatment.findUnique({ where: { slug } }); break;
      case "services": hit = await prisma.service.findUnique({ where: { slug } }); break;
      case "doctors": hit = await prisma.doctor.findUnique({ where: { slug } }); break;
      case "blogs": hit = await prisma.blogPost.findUnique({ where: { slug } }); break;
      case "products": hit = await prisma.product.findUnique({ where: { slug } }); break;
      default: hit = null;
    }
    if (!hit) return slug;
    slug = `${slugify(base)}-${i}`;
  }
  return `${slugify(base)}-${Date.now()}`;
}

function cleanMediaIds(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

async function insertRow(key: CollectionKey, data: Record<string, unknown>) {
  switch (key) {
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

async function deleteRow(key: CollectionKey, id: string) {
  switch (key) {
    case "specialties": return prisma.specialty.delete({ where: { id } });
    case "treatments": return prisma.treatment.delete({ where: { id } });
    case "services": return prisma.service.delete({ where: { id } });
    case "doctors": return prisma.doctor.delete({ where: { id } });
    case "insurance": return prisma.insuranceProvider.delete({ where: { id } });
    case "gallery": return prisma.galleryItem.delete({ where: { id } });
    case "blogs": return prisma.blogPost.delete({ where: { id } });
    case "testimonials": return prisma.testimonial.delete({ where: { id } });
    case "products": return prisma.product.delete({ where: { id } });
  }
}

export async function createItem(key: CollectionKey, body: Record<string, unknown>) {
  const def = COLLECTIONS[key];
  const mediaIds = cleanMediaIds(body.mediaIds);
  if (mediaIds.length < 1) return { error: "Attach at least one image or video (upload new or pick from the media library)." };
  const res = coerce(def.fields, body, true);
  if ("error" in res && res.error) return { error: res.error };
  const data = (res as { data: Record<string, unknown> }).data;
  if (def.slugSource) data.slug = await uniqueSlug(key, String(data[def.slugSource]));
  const row = (await insertRow(key, data)) as unknown as { id: string };
  await setEntityMedia(key as EntityType, row.id, mediaIds);
  return { row };
}

export async function updateItem(key: CollectionKey, id: string, body: Record<string, unknown>) {
  const def = COLLECTIONS[key];
  const mediaIds = cleanMediaIds(body.mediaIds);
  if (mediaIds.length < 1) return { error: "Attach at least one image or video." };
  const res = coerce(def.fields, body, false);
  if ("error" in res && res.error) return { error: res.error };
  const data = (res as { data: Record<string, unknown> }).data;
  try {
    const row = await updateRow(key, id, data);
    await setEntityMedia(key as EntityType, id, mediaIds);
    return { row };
  } catch {
    return { error: "Item not found" };
  }
}

export async function deleteItem(key: CollectionKey, id: string) {
  await clearEntityMedia(key as EntityType, id);
  try {
    await deleteRow(key, id);
  } catch {
    return { error: "This item is referenced elsewhere (e.g. past orders) and cannot be deleted." };
  }
  return { ok: true };
}
