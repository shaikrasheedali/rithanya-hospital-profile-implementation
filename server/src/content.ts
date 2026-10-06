import { prisma, isDbOnCooldown, reportDbError, withDbTimeout } from "./db.js";
import { listCollection } from "./cms.js";
import { FALLBACK_BLOOD_STOCK } from "./fallbackData.js";

export type ClinicalType = "specialties" | "treatments" | "services";

export async function getFacilities(limit?: number) {
  const items = await listCollection("facilities");
  return limit ? items.slice(0, limit) : items;
}

export async function getFacilityBySlug(slug: string) {
  const items = await listCollection("facilities");
  return items.find((x) => x.slug === slug) ?? null;
}

export async function getClinical(type: ClinicalType, limit?: number) {
  const items = await listCollection(type);
  return limit ? items.slice(0, limit) : items;
}

export async function getServices(limit?: number) {
  return getClinical("services", limit);
}

export async function getTreatments() {
  return getClinical("treatments");
}

export async function getClinicalBySlug(type: ClinicalType, slug: string) {
  const items = await listCollection(type);
  return items.find((x) => x.slug === slug) ?? null;
}

export async function getFlagshipTreatments(limit = 3) {
  const items = await listCollection("treatments");
  const flagship = items.filter((x) => Boolean(x.isFlagship));
  return flagship.slice(0, limit);
}

export async function getDoctors() {
  return listCollection("doctors");
}

export async function getDoctorBySlug(slug: string) {
  const items = await listCollection("doctors");
  return items.find((d) => d.slug === slug) ?? null;
}

export async function getInsurance() {
  return listCollection("insurance");
}

export async function getGallery(limit?: number) {
  const items = await listCollection("gallery");
  return limit ? items.slice(0, limit) : items;
}

export async function getTestimonials() {
  return listCollection("testimonials");
}

export async function getBlogs(opts: { limit?: number; category?: string; q?: string; page?: number; pageSize?: number } = {}) {
  const pageSize = opts.pageSize ?? opts.limit ?? 50;
  const page = Math.max(1, opts.page ?? 1);

  const items = await listCollection("blogs");
  let filtered = items.filter((b) => b.isPublished !== false);

  if (opts.category) {
    const catLower = opts.category.toLowerCase();
    filtered = filtered.filter((b) => (b.category ? String(b.category).toLowerCase() === catLower : false));
  }
  if (opts.q) {
    const qLower = opts.q.toLowerCase();
    filtered = filtered.filter((b) =>
      (b.title ? String(b.title).toLowerCase().includes(qLower) : false) ||
      (b.excerpt ? String(b.excerpt).toLowerCase().includes(qLower) : false)
    );
  }

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  return { posts: paginated, total, pageSize };
}

export async function getBlogBySlug(slug: string) {
  const items = await listCollection("blogs");
  return items.find((b) => b.slug === slug && b.isPublished !== false) ?? null;
}

export async function getProducts() {
  return listCollection("products");
}

// In-memory mutable blood stock for near-instant access
let inMemoryBloodStock = [...FALLBACK_BLOOD_STOCK];

export function updateInMemoryBloodStock(stocks: Array<{ bloodGroup: string; wholeBloodUnits: number; packedCellsUnits?: number; plasmaUnits: number }>) {
  const colors: Record<string, string> = { O: "SKY_BLUE", A: "YELLOW", B: "RED", AB: "WHITE" };
  for (const s of stocks) {
    const idx = inMemoryBloodStock.findIndex((x) => x.bloodGroup === s.bloodGroup);
    const cat = s.bloodGroup.replace(/[+-]/g, "");
    const updated = {
      id: idx >= 0 ? inMemoryBloodStock[idx].id : `stock-${s.bloodGroup}`,
      bloodGroup: s.bloodGroup,
      groupCategory: cat,
      colorCode: colors[cat] ?? "WHITE",
      wholeBloodUnits: s.wholeBloodUnits,
      packedCellsUnits: s.packedCellsUnits ?? (idx >= 0 ? (inMemoryBloodStock[idx] as any).packedCellsUnits : 0) ?? 0,
      plasmaUnits: s.plasmaUnits,
      lastUpdated: new Date(),
    };
    if (idx >= 0) inMemoryBloodStock[idx] = updated;
    else inMemoryBloodStock.push(updated);
  }
}

export async function getBloodStock() {
  if (!isDbOnCooldown()) {
    try {
      const rows = await withDbTimeout(prisma.bloodStock.findMany(), 1500);
      if (rows && rows.length) {
        const order = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"];
        const sorted = (rows as Array<{ bloodGroup?: string | null; groupCategory?: string | null }>).sort((a: any, b: any) => {
          const aGrp = typeof a?.bloodGroup === "string" ? a.bloodGroup : "";
          const bGrp = typeof b?.bloodGroup === "string" ? b.bloodGroup : "";
          const aIdx = order.indexOf(aGrp);
          const bIdx = order.indexOf(bGrp);
          return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
        });
        inMemoryBloodStock = sorted as any;
        return sorted;
      }
    } catch (err) {
      reportDbError(err);
    }
  }
  return inMemoryBloodStock;
}
