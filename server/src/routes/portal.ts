import { Router } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma, isDbOnCooldown, reportDbError, withDbTimeout } from "../db.js";
import { requireAuth, getUser, getEntity, audit } from "../auth.js";
import { isCollection } from "../cms.js";
import { createItem, updateItem, deleteItem, listCollection } from "../cms.js";
import { COLLECTIONS } from "../collections.js";
import { listAssets } from "../media-admin.js";
import { saveUploadFile, deleteAssetFile, IMAGE_DIR, VIDEO_DIR, PRIVATE_DIR } from "../media.js";
import { RESOURCES, ApiError } from "../resources.js";
import { getSettings } from "../settings.js";
import { loadPatients, loadCategories, getPatientById } from "../emr.js";
import { loadOrders } from "../orders.js";
import { loadEmployees } from "../employees.js";
import { loadExpenseCategories, loadLedgerEntries } from "../finance.js";
import { loadUsersList, loadPermissionsMatrix } from "../users.js";
import { retentionState } from "../retention.js";
import { FALLBACK_BLOOD_STOCK } from "../fallbackData.js";
import { getBloodStock } from "../content.js";

const router = Router();

/** Express 5 types route params as string | string[] — normalize to a single string. */
const param = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? "") : String(v ?? ""));

// ---------- CMS collections ----------
router.get("/cms/:collection", requireAuth(), async (req, res) => {
  const collection = param(req.params.collection);
  if (!isCollection(collection)) {
    res.status(404).json({ error: "Unknown collection" });
    return;
  }
  const need = COLLECTIONS[collection].module;
  const user = getUser(req);
  if (!user.modules[need]) {
    res.status(403).json({ error: "You do not have access to this module" });
    return;
  }
  res.json({ items: await listCollection(collection) });
});

router.post("/cms/:collection", requireAuth(), async (req, res) => {
  const collection = param(req.params.collection);
  if (!isCollection(collection)) {
    res.status(404).json({ error: "Unknown collection" });
    return;
  }
  const need = COLLECTIONS[collection].module;
  const user = getUser(req);
  if (!user.modules[need]) {
    res.status(403).json({ error: "You do not have access to this module" });
    return;
  }
  const result = await createItem(collection, req.body ?? {});
  if ("error" in result && result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  await audit(user, `CREATE_${collection.toUpperCase()}`, collection, (result as { row: { id: string } }).row.id);
  res.json({ ok: true, item: (result as { row: unknown }).row });
});

router.put("/cms/:collection/:id", requireAuth(), async (req, res) => {
  const collection = param(req.params.collection);
  const id = param(req.params.id);
  if (!isCollection(collection)) {
    res.status(404).json({ error: "Unknown collection" });
    return;
  }
  const need = COLLECTIONS[collection].module;
  const user = getUser(req);
  if (!user.modules[need]) {
    res.status(403).json({ error: "You do not have access to this module" });
    return;
  }
  const result = await updateItem(collection, id, req.body ?? {});
  if ("error" in result && result.error) {
    res.status(result.error === "Item not found" ? 404 : 400).json({ error: result.error });
    return;
  }
  await audit(user, `UPDATE_${collection.toUpperCase()}`, collection, id);
  res.json({ ok: true, item: (result as { row: unknown }).row });
});

router.delete("/cms/:collection/:id", requireAuth(), async (req, res) => {
  const collection = param(req.params.collection);
  const id = param(req.params.id);
  if (!isCollection(collection)) {
    res.status(404).json({ error: "Unknown collection" });
    return;
  }
  const need = COLLECTIONS[collection].module;
  const user = getUser(req);
  if (!user.modules[need]) {
    res.status(403).json({ error: "You do not have access to this module" });
    return;
  }
  const result = await deleteItem(collection, id);
  if ("error" in result && result.error) {
    res.status(409).json({ error: result.error });
    return;
  }
  await audit(user, `DELETE_${collection.toUpperCase()}`, collection, id);
  res.json({ ok: true });
});

// ---------- Media library ----------
router.get("/media", requireAuth(), async (_req, res) => {
  try {
    res.json({ assets: await listAssets() });
  } catch (err) {
    console.warn("[portal:media] Error listing assets:", err);
    res.json({ assets: [] });
  }
});

router.post("/media", requireAuth(), async (req, res) => {
  const user = getUser(req);
  if (!user.modules.cms && !user.modules.store && !user.modules.settings) {
    res.status(403).json({ error: "You do not have access to this module" });
    return;
  }
  const files = ((req as unknown as { files?: Express.Multer.File[] }).files ?? []) as Express.Multer.File[];
  if (!files.length) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }
  const saved: unknown[] = [];
  const errors: string[] = [];
  for (const f of files) {
    try {
      const row = await saveUploadFile({ originalname: f.originalname, mimetype: f.mimetype, buffer: f.buffer, size: f.size });
      saved.push(row);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Upload failed");
    }
  }
  await audit(user, "UPLOAD_MEDIA", "MediaAsset", null, `${saved.length} file(s)`);
  res.json({ assets: saved, errors });
});

router.delete("/media/purge", requireAuth("cms"), async (req, res) => {
  const user = getUser(req);
  const assets = await listAssets();
  const unlinked = assets.filter((a) => a.refs === 0);
  let removed = 0;
  const errors: string[] = [];
  for (const a of unlinked) {
    try {
      await withDbTimeout(prisma.mediaAsset.delete({ where: { id: a.id } }), 2500);
      await deleteAssetFile(a);
      removed += 1;
    } catch (e) {
      errors.push(`${a.originalName}: ${e instanceof Error ? e.message : "delete failed"}`);
    }
  }
  await audit(user, "PURGE_MEDIA", "MediaAsset", null, `${removed} removed`);
  if (removed === 0 && unlinked.length > 0) {
    res.status(409).json({ error: errors[0] ?? "Could not purge — assets may still be linked." });
    return;
  }
  res.json({ ok: true, removed, errors });
});

router.delete("/media/:id", requireAuth("cms"), async (req, res) => {
  const user = getUser(req);
  const asset = await prisma.mediaAsset.findUnique({ where: { id: param(req.params.id) }, include: { links: true } });
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  const s = await getSettings();
  const extra = (s.faviconUrl === asset.url ? 1 : 0) + (s.socialShareThumbnailUrl === asset.url ? 1 : 0);
  const refs = asset.links.length + extra;
  if (refs > 0) {
    res.status(409).json({ error: `Asset is used by ${refs} item(s) and cannot be deleted` });
    return;
  }
  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  await deleteAssetFile(asset);
  await audit(user, "DELETE_MEDIA", "MediaAsset", asset.id, asset.originalName);
  res.json({ ok: true });
});

// ---------- Generic resource dispatcher ----------
async function runHandler(req: import("express").Request, res: import("express").Response, kind: "create" | "update" | "remove" | "action") {
  const resource = param((req.params as { resource?: unknown }).resource);
  const rawId = (req.params as { id?: unknown }).id;
  const id = rawId === undefined ? undefined : param(rawId);
  const handler = RESOURCES[resource];
  if (!handler) {
    res.status(404).json({ error: "Unknown resource" });
    return;
  }
  const user = getUser(req);
  if (!user.modules[handler.module]) {
    res.status(403).json({ error: "You do not have access to this module" });
    return;
  }
  const entity = getEntity(req);
  try {
    let result: unknown;
    if (kind === "create") {
      if (!handler.create) throw new ApiError("Not supported", 405);
      result = await handler.create({ user, body: req.body ?? {}, entity });
    } else if (kind === "update") {
      if (!handler.update) throw new ApiError("Not supported", 405);
      result = await handler.update({ user, body: req.body ?? {}, id, entity });
    } else if (kind === "remove") {
      if (!handler.remove) throw new ApiError("Not supported", 405);
      result = await handler.remove({ user, body: req.body ?? {}, id });
    } else {
      const action = String((req.body ?? {}).action ?? "");
      const fn = handler.actions?.[action];
      if (!fn) throw new ApiError("Unknown action", 400);
      result = await fn({ user, body: req.body ?? {}, id });
    }
    res.json({ ok: true, data: result });
  } catch (e) {
    if (e instanceof ApiError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    // Prisma "record not found" on update/delete of a bogus id → clean 404, not 500.
    if ((e as { code?: string })?.code === "P2025") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    console.error(`[portal:r:${resource}]`, e);
    res.status(500).json({ error: "Something went wrong" });
  }
}

router.post("/r/:resource", requireAuth(), (req, res) => runHandler(req, res, "create"));
router.put("/r/:resource/:id", requireAuth(), (req, res) => runHandler(req, res, "update"));
router.delete("/r/:resource/:id", requireAuth(), (req, res) => runHandler(req, res, "remove"));
router.post("/r/:resource/:id", requireAuth(), (req, res) => runHandler(req, res, "action"));

// List helpers for generic resources used by portal desks
router.get("/r/:resource", requireAuth(), async (req, res) => {
  const resource = param(req.params.resource);
  const handler = RESOURCES[resource];
  if (!handler) {
    res.status(404).json({ error: "Unknown resource" });
    return;
  }
  const user = getUser(req);
  if (!user.modules[handler.module]) {
    res.status(403).json({ error: "You do not have access to this module" });
    return;
  }
  try {
    switch (resource) {
      case "categories": res.json({ items: await loadCategories() }); return;
      case "orders": res.json({ items: await loadOrders() }); return;
      case "appointments": {
        if (isDbOnCooldown()) { res.json({ items: [] }); return; }
        const items = await withDbTimeout(prisma.appointment.findMany({ orderBy: { createdAt: "desc" }, take: 300 }), 2000).catch(() => []);
        res.json({ items });
        return;
      }
      case "employees": {
        const entity = getEntity(req);
        const items = await loadEmployees(entity);
        res.json({ items, entity });
        return;
      }
      case "expense-categories": {
        const entity = getEntity(req);
        const items = await loadExpenseCategories(entity);
        res.json({ items, entity });
        return;
      }
      case "ledger": {
        const entity = getEntity(req);
        const items = await loadLedgerEntries(entity);
        res.json({ items, entity });
        return;
      }
      case "users": {
        const users = await loadUsersList();
        res.json({ items: users });
        return;
      }
      case "permissions": {
        const items = await loadPermissionsMatrix(user);
        res.json({ items });
        return;
      }
      default: res.status(405).json({ error: "List not supported for this resource" }); return;
    }
  } catch (e) {
    reportDbError(e);
    console.warn(`[portal:r:${resource}] List failed:`, e);
    res.json({ items: [] });
  }
});

// ---------- Page-data endpoints (what Next.js pages fetched via direct DB) ----------
router.get("/dashboard", requireAuth(), async (req, res) => {
  const user = getUser(req);
  if (isDbOnCooldown()) {
    const fallbackPatients = await loadPatients({ discharged: false });
    res.json({
      user,
      stats: {
        patients: fallbackPatients.length,
        appointments: 0,
        orders: 0,
        products: 0,
        dpdpPending: 0,
        stock: FALLBACK_BLOOD_STOCK,
      },
      recentAppointments: [],
      recentOrders: [],
    });
    return;
  }
  try {
    const [patients, appointments, orders, stock, dpdpPending, products, recentAppointments, recentOrders] =
      await withDbTimeout(
        Promise.all([
          prisma.patient.count().catch(() => 0),
          prisma.appointment.count().catch(() => 0),
          prisma.order.count().catch(() => 0),
          prisma.bloodStock.findMany().catch(() => []),
          prisma.dpdpErasureRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
          prisma.product.count().catch(() => 0),
          prisma.appointment.findMany({ orderBy: { createdAt: "desc" }, take: 8 }).catch(() => []),
          prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { items: true } }).catch(() => []),
        ]),
        2000,
      );
    res.json({
      user,
      stats: {
        patients,
        appointments,
        orders,
        products,
        dpdpPending,
        stock: stock.length ? stock : FALLBACK_BLOOD_STOCK,
      },
      recentAppointments,
      recentOrders,
    });
  } catch (err) {
    reportDbError(err);
    console.warn("[portal:dashboard] Error loading metrics, returning safe fallback:", err);
    res.json({
      user,
      stats: {
        patients: 0,
        appointments: 0,
        orders: 0,
        products: 0,
        dpdpPending: 0,
        stock: FALLBACK_BLOOD_STOCK,
      },
      recentAppointments: [],
      recentOrders: [],
    });
  }
});

router.get("/patients", requireAuth("emr"), async (req, res) => {
  const type = req.query.type as string | undefined;
  const discharged = req.query.discharged === "1" || req.query.discharged === "true";
  const archived = req.query.archived === "1" || req.query.archived === "true";
  try {
    const patients = await loadPatients({
      type: type === "INPATIENT" || type === "OUTPATIENT" ? type : undefined,
      discharged,
      archived,
    });
    const categories = await loadCategories();
    res.json({ patients, categories });
  } catch (err) {
    console.warn("[portal:patients] Error loading patients:", err);
    res.json({ patients: [], categories: [] });
  }
});

router.get("/patients/:id", requireAuth("emr"), async (req, res) => {
  try {
    const patient = await getPatientById(param(req.params.id));
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const categories = await loadCategories();
    res.json({ patient, categories });
  } catch (err) {
    console.warn("[portal:patients/:id] Error loading patient:", err);
    res.status(500).json({ error: "Failed to load patient profile" });
  }
});

router.get("/appointments", requireAuth("emr"), async (_req, res) => {
  if (isDbOnCooldown()) {
    res.json({ items: [] });
    return;
  }
  try {
    res.json({ items: await withDbTimeout(prisma.appointment.findMany({ orderBy: { createdAt: "desc" }, take: 300 }), 1500) });
  } catch (err) {
    reportDbError(err);
    console.warn("[portal:appointments] Query failed, returning empty list:", err);
    res.json({ items: [] });
  }
});

router.get("/blood-stock", requireAuth("bloodbank"), async (_req, res) => {
  try {
    const [stock, settings] = await Promise.all([
      getBloodStock(),
      getSettings(),
    ]);
    res.json({ stock, threshold: settings.criticalBloodAlertThreshold });
  } catch (err) {
    const settings = await getSettings();
    res.json({ stock: FALLBACK_BLOOD_STOCK, threshold: settings.criticalBloodAlertThreshold });
  }
});

router.get("/orders", requireAuth("store"), async (_req, res) => {
  try {
    const orders = await loadOrders();
    res.json({ items: orders });
  } catch (err) {
    reportDbError(err);
    console.warn("[portal:orders] Query failed, returning empty list:", err);
    res.json({ items: [] });
  }
});

router.get("/employees", requireAuth("hr"), async (req, res) => {
  const entity = getEntity(req);
  try {
    const items = await loadEmployees(entity);
    res.json({ items, entity });
  } catch (err) {
    reportDbError(err);
    res.json({ items: [], entity });
  }
});

router.get("/payroll", requireAuth("hr"), async (req, res) => {
  const month = Number(req.query.month ?? new Date().getMonth() + 1);
  const year = Number(req.query.year ?? new Date().getFullYear());
  const entity = getEntity(req);
  if (isDbOnCooldown()) {
    res.json({ employees: [], records: [], month, year, entity });
    return;
  }
  try {
    const employees = await withDbTimeout(prisma.employee.findMany({ where: { isActive: true, entity }, orderBy: { fullName: "asc" } }), 1500);
    const records = await withDbTimeout(prisma.payrollRecord.findMany({ where: { month, year, employee: { entity } }, include: { employee: true } }), 1500);
    res.json({ employees, records, month, year, entity });
  } catch (err) {
    reportDbError(err);
    res.json({ employees: [], records: [], month, year, entity });
  }
});

router.get("/payslip/:id", requireAuth("hr"), async (req, res) => {
  if (isDbOnCooldown()) {
    res.status(404).json({ error: "Payslip not available offline" });
    return;
  }
  try {
    const record = await withDbTimeout(prisma.payrollRecord.findUnique({ where: { id: param(req.params.id) }, include: { employee: true } }), 1500);
    if (!record) {
      res.status(404).json({ error: "Payslip not found" });
      return;
    }
    res.json({ record, settings: await getSettings() });
  } catch (err) {
    reportDbError(err);
    res.status(404).json({ error: "Payslip not found" });
  }
});

router.get("/ledger", requireAuth("finance"), async (req, res) => {
  const entity = getEntity(req);
  const entityLabel = entity === "RVBC" ? "RVBC (Voluntary Blood Centre)" : "Rithanya Hospital";
  try {
    const [items, categories] = await Promise.all([
      loadLedgerEntries(entity),
      loadExpenseCategories(entity),
    ]);
    res.json({ items, categories, entity, entityLabel });
  } catch (err) {
    reportDbError(err);
    res.json({ items: [], categories: [], entity, entityLabel });
  }
});

router.get("/expense-categories", requireAuth("finance"), async (req, res) => {
  const entity = getEntity(req);
  const entityLabel = entity === "RVBC" ? "RVBC (Voluntary Blood Centre)" : "Rithanya Hospital";
  try {
    const items = await loadExpenseCategories(entity);
    res.json({ items, entity, entityLabel });
  } catch (err) {
    reportDbError(err);
    res.json({ items: [], entity, entityLabel });
  }
});

router.get("/finance-overview", requireAuth("finance"), async (req, res) => {
  const entity = getEntity(req);
  try {
    const entries = await loadLedgerEntries(entity);
    const byMonth = new Map<string, { credit: number; debit: number }>();
    for (const e of entries) {
      const k = new Date(e.entryDate).toISOString().slice(0, 7);
      const cur = byMonth.get(k) ?? { credit: 0, debit: 0 };
      if (e.type === "CREDIT") cur.credit += e.amount;
      else cur.debit += e.amount;
      byMonth.set(k, cur);
    }
    const months = Array.from(byMonth.entries()).sort().slice(-6).map(([month, v]) => ({ month, ...v, net: v.credit - v.debit }));
    const byCategory = new Map<string, number>();
    for (const e of entries) {
      if (e.type !== "DEBIT") continue;
      const k = (e as any).categoryName ?? "Uncategorised";
      byCategory.set(k, (byCategory.get(k) ?? 0) + e.amount);
    }
    const totalCredit = entries.filter((e) => e.type === "CREDIT").reduce((s, e) => s + e.amount, 0);
    const totalDebit = entries.filter((e) => e.type === "DEBIT").reduce((s, e) => s + e.amount, 0);
    res.json({
      totals: { credit: totalCredit, debit: totalDebit, net: totalCredit - totalDebit },
      months,
      byCategory: Array.from(byCategory.entries()).map(([name, total]) => ({ name, total })),
      retention: retentionState,
      entity,
    });
  } catch (err) {
    reportDbError(err);
    res.json({
      totals: { credit: 0, debit: 0, net: 0 },
      months: [],
      byCategory: [],
      retention: retentionState,
      entity,
    });
  }
});

router.get("/dpdp-requests", requireAuth("dpdp"), async (_req, res) => {
  if (isDbOnCooldown()) {
    res.json({ items: [] });
    return;
  }
  try {
    res.json({ items: await withDbTimeout(prisma.dpdpErasureRequest.findMany({ orderBy: { createdAt: "desc" }, take: 300 }), 1500) });
  } catch (err) {
    reportDbError(err);
    res.json({ items: [] });
  }
});

router.get("/users", requireAuth("access"), async (_req, res) => {
  try {
    const users = await loadUsersList();
    res.json({ items: users });
  } catch (err) {
    reportDbError(err);
    res.json({ items: [] });
  }
});

router.get("/permissions", requireAuth("access"), async (req, res) => {
  const user = getUser(req);
  try {
    const items = await loadPermissionsMatrix(user);
    res.json({ items });
  } catch (err) {
    reportDbError(err);
    res.json({ items: [] });
  }
});

router.get("/audit-logs", requireAuth("settings"), async (_req, res) => {
  if (isDbOnCooldown()) {
    res.json({ items: [] });
    return;
  }
  try {
    res.json({ items: await withDbTimeout(prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 40 }), 1500) });
  } catch (err) {
    reportDbError(err);
    res.json({ items: [] });
  }
});

router.get("/settings", requireAuth("settings"), async (_req, res) => {
  res.json({ settings: await getSettings() });
});

// ---------- Private file serving ----------
router.get("/consent/:file", requireAuth("emr"), async (req, res) => {
  const file = path.basename(param(req.params.file));
  const full = path.join(PRIVATE_DIR, "consent", file);
  try {
    await fs.access(full);
  } catch {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.setHeader("Content-Type", file.endsWith(".webp") ? "image/webp" : "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.sendFile(full);
});

router.get("/dpdp-proof/:file", requireAuth("dpdp"), async (req, res) => {
  const file = path.basename(param(req.params.file));
  const full = path.join(PRIVATE_DIR, file);
  try {
    await fs.access(full);
  } catch {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const mime = ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "application/octet-stream";
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(full);
});

export default router;

// Re-export for media file helpers used by index
export { IMAGE_DIR, VIDEO_DIR };
