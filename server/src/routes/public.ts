import { Router } from "express";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../db.js";
import { getSettings } from "../settings.js";
import {
  getBlogs,
  getBlogBySlug,
  getBloodStock,
  getClinical,
  getClinicalBySlug,
  getDoctors,
  getDoctorBySlug,
  getFlagshipTreatments,
  getGallery,
  getInsurance,
  getProducts,
  getServices,
  getTestimonials,
  getTreatments,
} from "../content.js";
import { phoneDigits } from "../utils.js";
import { PRIVATE_DIR } from "../media.js";

const router = Router();

/** Express 5 types route params as string | string[] — normalize to a single string. */
const param = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? "") : String(v ?? ""));

router.get("/settings", async (_req, res) => {
  res.json({ settings: await getSettings() });
});

router.get("/clinical", async (req, res) => {
  const type = String(req.query.type ?? "specialties");
  if (!["specialties", "treatments", "services"].includes(type)) {
    res.status(400).json({ error: "Invalid type" });
    return;
  }
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  res.json({ items: await getClinical(type as never, limit) });
});

router.get("/clinical/:type/:slug", async (req, res) => {
  const type = param(req.params.type);
  const slug = param(req.params.slug);
  if (!["specialties", "treatments", "services"].includes(type)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const item = await getClinicalBySlug(type as never, slug);
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ item });
});

router.get("/services", async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  res.json({ items: await getServices(limit) });
});

router.get("/treatments", async (_req, res) => {
  res.json({ items: await getTreatments() });
});

router.get("/flagship", async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 3;
  res.json({ items: await getFlagshipTreatments(limit) });
});

router.get("/doctors", async (_req, res) => {
  res.json({ items: await getDoctors() });
});

router.get("/doctors/:slug", async (req, res) => {
  const d = await getDoctorBySlug(param(req.params.slug));
  if (!d) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ item: d });
});

router.get("/insurance", async (_req, res) => {
  res.json({ items: await getInsurance() });
});

router.get("/gallery", async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  res.json({ items: await getGallery(limit) });
});

router.get("/testimonials", async (_req, res) => {
  res.json({ items: await getTestimonials() });
});

router.get("/blogs", async (req, res) => {
  const { category, q, page, pageSize, limit } = req.query as Record<string, string>;
  const data = await getBlogs({
    category: category || undefined,
    q: q || undefined,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : limit ? Number(limit) : 6,
  });
  res.json(data);
});

router.get("/blogs/:slug", async (req, res) => {
  const b = await getBlogBySlug(param(req.params.slug));
  if (!b) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ item: b });
});

router.get("/products", async (_req, res) => {
  res.json({ items: await getProducts() });
});

router.get("/blood-stock", async (_req, res) => {
  res.json({ stock: await getBloodStock(), serverTime: new Date().toISOString() });
});

router.get("/home", async (_req, res) => {
  const [settings, specialties, flagship, services, doctors, gallery, insurance, blogs, testimonials, stock] =
    await Promise.all([
      getSettings(),
      getClinical("specialties", 6),
      getFlagshipTreatments(3),
      getServices(6),
      getDoctors(),
      getGallery(6),
      getInsurance(),
      getBlogs({ limit: 3 }),
      getTestimonials(),
      getBloodStock(),
    ]);
  res.json({ settings, specialties, flagship, services, doctors, gallery, insurance, blogs, testimonials, stock });
});

router.post("/appointments", async (req, res) => {
  const { fullName, phone, department, preferredDate, message, source } = req.body ?? {};
  const name = String(fullName ?? "").trim();
  const ph = String(phone ?? "").trim();
  if (name.length < 2 || name.length > 120) {
    res.status(400).json({ error: "Please enter your full name" });
    return;
  }
  if (phoneDigits(ph).length < 10) {
    res.status(400).json({ error: "Please enter a valid phone number" });
    return;
  }
  const src = ["CONTACT", "THALASSEMIA"].includes(String(source)) ? String(source) : "WEBSITE";
  await prisma.appointment.create({
    data: {
      fullName: name.slice(0, 120),
      phone: ph.slice(0, 30),
      department: String(department ?? "").slice(0, 200),
      preferredDate: String(preferredDate ?? "").slice(0, 40),
      message: String(message ?? "").slice(0, 1500),
      source: src,
    },
  });
  res.json({ ok: true });
});

router.post("/orders", async (req, res) => {
  const { name, phone, address, pin, paymentMethod, items } = req.body ?? {};
  const customerName = String(name ?? "").trim();
  const phoneNumber = String(phone ?? "").trim();
  const shippingAddress = String(address ?? "").trim();
  const pinCode = String(pin ?? "").trim();
  if (customerName.length < 2) {
    res.status(400).json({ error: "Please enter your name" });
    return;
  }
  if (phoneDigits(phoneNumber).length < 10) {
    res.status(400).json({ error: "Please enter a valid phone number" });
    return;
  }
  if (shippingAddress.length < 8) {
    res.status(400).json({ error: "Please enter your full address" });
    return;
  }
  if (!/^\d{6}$/.test(pinCode)) {
    res.status(400).json({ error: "Please enter a valid 6-digit PIN code" });
    return;
  }
  if (!Array.isArray(items) || !items.length) {
    res.status(400).json({ error: "Your cart is empty" });
    return;
  }
  const method = paymentMethod === "UPI" ? "UPI" : "COD";
  try {
    const result = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const lines: Array<{ productId: string; quantity: number; unitPrice: number; productName: string }> = [];
      for (const it of items) {
        const qty = Math.trunc(Number(it.quantity ?? it.qty ?? 1));
        if (!Number.isFinite(qty) || qty < 1 || qty > 20) throw new Error("Invalid quantity");
        const prod = await tx.product.findUnique({ where: { id: String(it.productId ?? it.id) } });
        if (!prod) throw new Error("A product in your cart is no longer available");
        if (prod.stockUnits < qty) throw new Error(`Only ${prod.stockUnits} unit(s) of ${prod.name} are available`);
        subtotal += prod.price * qty;
        lines.push({ productId: prod.id, quantity: qty, unitPrice: prod.price, productName: prod.name });
      }
      const delivery = subtotal >= 500 ? 0 : 40;
      const total = subtotal + delivery;
      const count = await tx.order.count();
      let orderNumber = `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
      const clash = await tx.order.findUnique({ where: { orderNumber } });
      if (clash) orderNumber += `-${Math.floor(Math.random() * 900 + 100)}`;
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerName: customerName.slice(0, 200),
          phoneNumber: phoneNumber.slice(0, 30),
          shippingAddress: shippingAddress.slice(0, 1000),
          pinCode,
          totalAmount: total,
          status: "PENDING",
          paymentMethod: method,
          isPaid: false,
        },
      });
      for (const l of lines) {
        await tx.orderItem.create({ data: { orderId: order.id, ...l } });
        await tx.product.update({ where: { id: l.productId }, data: { stockUnits: { decrement: l.quantity } } });
      }
      return { orderNumber, total };
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Could not place order" });
  }
});

// DPDP public endpoints use multer memory storage (wired in index via upload fields)
router.post("/dpdp", async (req, res) => {
  const f = (req as unknown as { file?: Express.Multer.File }).file;
  const body = req.body ?? {};
  const fullName = String(body.fullName ?? "").trim();
  const phoneNumber = String(body.phoneNumber ?? body.phone ?? "").trim();
  const requestDetails = String(body.requestDetails ?? body.details ?? "").trim();
  if (fullName.length < 2) {
    res.status(400).json({ error: "Please enter your full name" });
    return;
  }
  if (phoneDigits(phoneNumber).length < 10) {
    res.status(400).json({ error: "Please enter a valid phone number" });
    return;
  }
  if (requestDetails.length < 5 || requestDetails.length > 2000) {
    res.status(400).json({ error: "Please describe your request (5–2000 characters)" });
    return;
  }
  let proofFile: string | null = null;
  if (f) {
    if (f.size > 8 * 1024 * 1024) {
      res.status(400).json({ error: "Identity proof must be under 8MB" });
      return;
    }
    const ext = path.extname(f.originalname).slice(0, 10) || ".bin";
    const name = `dpdp-${Date.now()}-${crypto.randomBytes(3).toString("hex")}${ext}`;
    await fs.mkdir(PRIVATE_DIR, { recursive: true });
    await fs.writeFile(path.join(PRIVATE_DIR, name), f.buffer);
    proofFile = name;
  }
  const trackingCode = `DPDP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  await prisma.dpdpErasureRequest.create({
    data: {
      trackingCode,
      fullName: fullName.slice(0, 200),
      phoneNumber: phoneNumber.slice(0, 30),
      identificationRef: String(body.identificationRef ?? "").slice(0, 200) || null,
      recordsNature: String(body.recordsNature ?? "").slice(0, 500),
      requestDetails: requestDetails.slice(0, 2000),
      identityProofFile: proofFile,
    },
  });
  res.json({ ok: true, trackingCode });
});

router.get("/dpdp", async (req, res) => {
  const code = String(req.query.code ?? "").trim();
  const phone = String(req.query.phone ?? "").trim();
  if (!code || phoneDigits(phone).length < 10) {
    res.status(400).json({ error: "Tracking code and phone number are required" });
    return;
  }
  const row = await prisma.dpdpErasureRequest.findUnique({ where: { trackingCode: code } });
  if (!row || phoneDigits(row.phoneNumber).slice(-10) !== phoneDigits(phone).slice(-10)) {
    res.status(404).json({ error: "No request found for these details" });
    return;
  }
  res.json({
    trackingCode: row.trackingCode,
    status: row.status,
    submittedAt: row.createdAt,
    updatedAt: row.updatedAt,
    note: row.status === "PENDING" ? null : row.resolutionNotes,
  });
});

export default router;
