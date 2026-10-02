import { prisma, isDbOnCooldown, reportDbError, reportDbSuccess } from "./db.js";
import { withMedia } from "./media.js";
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
  FALLBACK_BLOOD_STOCK,
} from "./fallbackData.js";

export async function getFacilities(limit?: number) {
  if (!isDbOnCooldown()) {
    try {
      const rows = await prisma.facility.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        ...(limit ? { take: limit } : {}),
      });
      if (rows.length) {
        reportDbSuccess();
        return await withMedia("facilities", rows);
      }
    } catch (err) {
      reportDbError(err);
      console.warn("[content] getFacilities DB query failed, using fallback:", err instanceof Error ? err.message : err);
    }
  }
  return limit ? FALLBACK_FACILITIES.slice(0, limit) : FALLBACK_FACILITIES;
}

export async function getFacilityBySlug(slug: string) {
  if (!isDbOnCooldown()) {
    try {
      const row = await prisma.facility.findUnique({ where: { slug } });
      if (row) {
        reportDbSuccess();
        return (await withMedia("facilities", [row]))[0];
      }
    } catch (err) {
      reportDbError(err);
      console.warn(`[content] getFacilityBySlug(${slug}) DB query failed, searching fallback:`, err instanceof Error ? err.message : err);
    }
  }
  return FALLBACK_FACILITIES.find((x) => x.slug === slug) ?? null;
}

export type ClinicalType = "specialties" | "treatments" | "services";

export async function getClinical(type: ClinicalType, limit?: number) {
  if (!isDbOnCooldown()) {
    try {
      if (type === "specialties") {
        const rows = await prisma.specialty.findMany({
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          ...(limit ? { take: limit } : {}),
        });
        if (rows.length) {
          reportDbSuccess();
          return await withMedia("specialties", rows);
        }
      } else if (type === "treatments") {
        const rows = await prisma.treatment.findMany({
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          ...(limit ? { take: limit } : {}),
        });
        if (rows.length) {
          reportDbSuccess();
          return await withMedia("treatments", rows);
        }
      } else {
        const rows = await prisma.service.findMany({
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          ...(limit ? { take: limit } : {}),
        });
        if (rows.length) {
          reportDbSuccess();
          return await withMedia("services", rows);
        }
      }
    } catch (err) {
      reportDbError(err);
      console.warn(`[content] getClinical(${type}) DB query failed, using fallback:`, err instanceof Error ? err.message : err);
    }
  }

  // Graceful fallback
  if (type === "specialties") {
    return limit ? FALLBACK_SPECIALTIES.slice(0, limit) : FALLBACK_SPECIALTIES;
  }
  if (type === "treatments") {
    return limit ? FALLBACK_TREATMENTS.slice(0, limit) : FALLBACK_TREATMENTS;
  }
  return limit ? FALLBACK_SERVICES.slice(0, limit) : FALLBACK_SERVICES;
}

export async function getServices(limit?: number) {
  return getClinical("services", limit);
}

export async function getTreatments() {
  return getClinical("treatments");
}

export async function getClinicalBySlug(type: ClinicalType, slug: string) {
  if (!isDbOnCooldown()) {
    try {
      if (type === "specialties") {
        const row = await prisma.specialty.findUnique({ where: { slug } });
        if (row) {
          reportDbSuccess();
          return (await withMedia("specialties", [row]))[0];
        }
      } else if (type === "treatments") {
        const row = await prisma.treatment.findUnique({ where: { slug } });
        if (row) {
          reportDbSuccess();
          return (await withMedia("treatments", [row]))[0];
        }
      } else {
        const row = await prisma.service.findUnique({ where: { slug } });
        if (row) {
          reportDbSuccess();
          return (await withMedia("services", [row]))[0];
        }
      }
    } catch (err) {
      reportDbError(err);
      console.warn(`[content] getClinicalBySlug(${type}, ${slug}) DB query failed, searching fallback:`, err instanceof Error ? err.message : err);
    }
  }

  // Fallback lookup
  if (type === "specialties") {
    return FALLBACK_SPECIALTIES.find((x) => x.slug === slug) ?? null;
  }
  if (type === "treatments") {
    return FALLBACK_TREATMENTS.find((x) => x.slug === slug) ?? null;
  }
  return FALLBACK_SERVICES.find((x) => x.slug === slug) ?? null;
}

export async function getFlagshipTreatments(limit = 3) {
  if (!isDbOnCooldown()) {
    try {
      const rows = await prisma.treatment.findMany({
        where: { isFlagship: true },
        orderBy: { sortOrder: "asc" },
        take: limit,
      });
      if (rows.length) {
        reportDbSuccess();
        return await withMedia("treatments", rows);
      }
    } catch (err) {
      reportDbError(err);
      console.warn("[content] getFlagshipTreatments DB query failed, using fallback:", err instanceof Error ? err.message : err);
    }
  }
  return FALLBACK_TREATMENTS.filter((t) => t.isFlagship).slice(0, limit);
}

export async function getDoctors(limit?: number) {
  if (!isDbOnCooldown()) {
    try {
      const rows = await prisma.doctor.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        ...(limit ? { take: limit } : {}),
      });
      if (rows.length) {
        reportDbSuccess();
        return await withMedia("doctors", rows);
      }
    } catch (err) {
      reportDbError(err);
      console.warn("[content] getDoctors DB query failed, using fallback:", err instanceof Error ? err.message : err);
    }
  }
  return limit ? FALLBACK_DOCTORS.slice(0, limit) : FALLBACK_DOCTORS;
}

export async function getDoctorBySlug(slug: string) {
  if (!isDbOnCooldown()) {
    try {
      const row = await prisma.doctor.findUnique({ where: { slug } });
      if (row) {
        reportDbSuccess();
        return (await withMedia("doctors", [row]))[0];
      }
    } catch (err) {
      reportDbError(err);
      console.warn(`[content] getDoctorBySlug(${slug}) DB query failed, searching fallback:`, err instanceof Error ? err.message : err);
    }
  }
  return FALLBACK_DOCTORS.find((d) => d.slug === slug) ?? null;
}

export async function getInsurance() {
  if (!isDbOnCooldown()) {
    try {
      const rows = await prisma.insuranceProvider.findMany({ orderBy: { sortOrder: "asc" } });
      if (rows.length) {
        reportDbSuccess();
        return await withMedia("insurance", rows);
      }
    } catch (err) {
      reportDbError(err);
      console.warn("[content] getInsurance DB query failed, using fallback:", err instanceof Error ? err.message : err);
    }
  }
  return FALLBACK_INSURANCE;
}

export async function getGallery(limit?: number) {
  if (!isDbOnCooldown()) {
    try {
      const rows = await prisma.galleryItem.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        ...(limit ? { take: limit } : {}),
      });
      if (rows.length) {
        reportDbSuccess();
        return await withMedia("gallery", rows);
      }
    } catch (err) {
      reportDbError(err);
      console.warn("[content] getGallery DB query failed, using fallback:", err instanceof Error ? err.message : err);
    }
  }
  return limit ? FALLBACK_GALLERY.slice(0, limit) : FALLBACK_GALLERY;
}

export async function getTestimonials() {
  if (!isDbOnCooldown()) {
    try {
      const rows = await prisma.testimonial.findMany({ orderBy: { sortOrder: "asc" } });
      if (rows.length) {
        reportDbSuccess();
        return await withMedia("testimonials", rows);
      }
    } catch (err) {
      reportDbError(err);
      console.warn("[content] getTestimonials DB query failed, using fallback:", err instanceof Error ? err.message : err);
    }
  }
  return FALLBACK_TESTIMONIALS;
}

export async function getBlogs(opts: { limit?: number; category?: string; q?: string; page?: number; pageSize?: number } = {}) {
  const pageSize = opts.pageSize ?? opts.limit ?? 50;
  const page = Math.max(1, opts.page ?? 1);

  if (!isDbOnCooldown()) {
    try {
      const where: { isPublished: boolean; category?: string; OR?: Array<Record<string, unknown>> } = { isPublished: true };
      if (opts.category) where.category = opts.category;
      if (opts.q) {
        where.OR = [{ title: { contains: opts.q } }, { excerpt: { contains: opts.q } }];
      }
      const [rows, total] = await Promise.all([
        prisma.blogPost.findMany({ where, orderBy: { publishedAt: "desc" }, take: pageSize, skip: (page - 1) * pageSize }),
        prisma.blogPost.count({ where }),
      ]);
      if (rows.length) {
        reportDbSuccess();
        return { posts: await withMedia("blogs", rows), total, pageSize };
      }
    } catch (err) {
      reportDbError(err);
      console.warn("[content] getBlogs DB query failed, using fallback:", err instanceof Error ? err.message : err);
    }
  }

  // Fallback filtering
  let filtered = FALLBACK_BLOGS;
  if (opts.category) {
    filtered = filtered.filter((b) => b.category.toLowerCase() === opts.category?.toLowerCase());
  }
  if (opts.q) {
    const qLower = opts.q.toLowerCase();
    filtered = filtered.filter((b) => b.title.toLowerCase().includes(qLower) || b.excerpt.toLowerCase().includes(qLower));
  }
  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  return { posts: paginated, total, pageSize };
}

export async function getBlogBySlug(slug: string) {
  if (!isDbOnCooldown()) {
    try {
      const row = await prisma.blogPost.findFirst({ where: { slug, isPublished: true } });
      if (row) {
        reportDbSuccess();
        return (await withMedia("blogs", [row]))[0];
      }
    } catch (err) {
      reportDbError(err);
      console.warn(`[content] getBlogBySlug(${slug}) DB query failed, searching fallback:`, err instanceof Error ? err.message : err);
    }
  }
  return FALLBACK_BLOGS.find((b) => b.slug === slug) ?? null;
}

export async function getProducts() {
  if (!isDbOnCooldown()) {
    try {
      const rows = await prisma.product.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
      if (rows.length) {
        reportDbSuccess();
        return await withMedia("products", rows);
      }
    } catch (err) {
      reportDbError(err);
      console.warn("[content] getProducts DB query failed, using fallback:", err instanceof Error ? err.message : err);
    }
  }
  return FALLBACK_PRODUCTS;
}

export async function getBloodStock() {
  if (!isDbOnCooldown()) {
    try {
      const rows = await prisma.bloodStock.findMany();
      if (rows.length) {
        const order = ["O", "A", "B", "AB"];
        const sorted = (rows as Array<{ groupCategory?: string | null }>).sort((a: any, b: any) => {
          const aCat = typeof a?.groupCategory === "string" ? a.groupCategory : "";
          const bCat = typeof b?.groupCategory === "string" ? b.groupCategory : "";
          const aIdx = order.indexOf(aCat);
          const bIdx = order.indexOf(bCat);
          return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
        });
        reportDbSuccess();
        return sorted;
      }
    } catch (err) {
      reportDbError(err);
      console.warn("[content] getBloodStock DB query failed, using fallback:", err instanceof Error ? err.message : err);
    }
  }
  return FALLBACK_BLOOD_STOCK;
}
