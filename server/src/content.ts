import { prisma } from "./db.js";
import { withMedia } from "./media.js";

export type ClinicalType = "specialties" | "treatments" | "services";

export async function getClinical(type: ClinicalType, limit?: number) {
  if (type === "specialties") {
    const rows = await prisma.specialty.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], ...(limit ? { take: limit } : {}) });
    return withMedia("specialties", rows);
  }
  if (type === "treatments") {
    const rows = await prisma.treatment.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], ...(limit ? { take: limit } : {}) });
    return withMedia("treatments", rows);
  }
  const rows = await prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], ...(limit ? { take: limit } : {}) });
  return withMedia("services", rows);
}

export async function getServices(limit?: number) {
  const rows = await prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], ...(limit ? { take: limit } : {}) });
  return withMedia("services", rows);
}

export async function getTreatments() {
  const rows = await prisma.treatment.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return withMedia("treatments", rows);
}

export async function getClinicalBySlug(type: ClinicalType, slug: string) {
  if (type === "specialties") {
    const row = await prisma.specialty.findUnique({ where: { slug } });
    if (!row) return null;
    return (await withMedia("specialties", [row]))[0];
  }
  if (type === "treatments") {
    const row = await prisma.treatment.findUnique({ where: { slug } });
    if (!row) return null;
    return (await withMedia("treatments", [row]))[0];
  }
  const row = await prisma.service.findUnique({ where: { slug } });
  if (!row) return null;
  return (await withMedia("services", [row]))[0];
}

export async function getFlagshipTreatments(limit = 3) {
  const rows = await prisma.treatment.findMany({ where: { isFlagship: true }, orderBy: { sortOrder: "asc" }, take: limit });
  return withMedia("treatments", rows);
}

export async function getDoctors(limit?: number) {
  const rows = await prisma.doctor.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], ...(limit ? { take: limit } : {}) });
  return withMedia("doctors", rows);
}

export async function getDoctorBySlug(slug: string) {
  const row = await prisma.doctor.findUnique({ where: { slug } });
  return row ? (await withMedia("doctors", [row]))[0] : null;
}

export async function getInsurance() {
  const rows = await prisma.insuranceProvider.findMany({ orderBy: { sortOrder: "asc" } });
  return withMedia("insurance", rows);
}

export async function getGallery(limit?: number) {
  const rows = await prisma.galleryItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], ...(limit ? { take: limit } : {}) });
  return withMedia("gallery", rows);
}

export async function getTestimonials() {
  const rows = await prisma.testimonial.findMany({ orderBy: { sortOrder: "asc" } });
  return withMedia("testimonials", rows);
}

export async function getBlogs(opts: { limit?: number; category?: string; q?: string; page?: number; pageSize?: number } = {}) {
  const where: { isPublished: boolean; category?: string; OR?: Array<Record<string, unknown>> } = { isPublished: true };
  if (opts.category) where.category = opts.category;
  if (opts.q) {
    where.OR = [{ title: { contains: opts.q } }, { excerpt: { contains: opts.q } }];
  }
  const pageSize = opts.pageSize ?? opts.limit ?? 50;
  const page = Math.max(1, opts.page ?? 1);
  const [rows, total] = await Promise.all([
    prisma.blogPost.findMany({ where, orderBy: { publishedAt: "desc" }, take: pageSize, skip: (page - 1) * pageSize }),
    prisma.blogPost.count({ where }),
  ]);
  return { posts: await withMedia("blogs", rows), total, pageSize };
}

export async function getBlogBySlug(slug: string) {
  const row = await prisma.blogPost.findFirst({ where: { slug, isPublished: true } });
  return row ? (await withMedia("blogs", [row]))[0] : null;
}

export async function getProducts() {
  const rows = await prisma.product.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return withMedia("products", rows);
}

export async function getBloodStock() {
  const rows = await prisma.bloodStock.findMany();
  const order = ["O", "A", "B", "AB"];
  return (rows as Array<{ groupCategory?: string | null }>).sort((a: any, b: any) => {
    const aCat = typeof a?.groupCategory === "string" ? a.groupCategory : "";
    const bCat = typeof b?.groupCategory === "string" ? b.groupCategory : "";
    const aIdx = order.indexOf(aCat);
    const bIdx = order.indexOf(bCat);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });
}

