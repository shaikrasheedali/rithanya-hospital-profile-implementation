/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "./db.js";
import { audit, computeModules, hashPassword, type ModuleKey, type Role, type SessionUser } from "./auth.js";
import { decryptField, encryptField, encryptJson } from "./crypto.js";
import { PRIVATE_DIR } from "./media.js";
import { computeMonthlyPayroll, daysInMonth } from "./payroll.js";
import { phoneDigits } from "./utils.js";

export class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type Ctx = { user: SessionUser; body: Record<string, any>; id?: string; entity?: string };
type Fn = (c: Ctx) => Promise<unknown>;
export type Handler = {
  module: ModuleKey;
  create?: Fn;
  update?: Fn;
  remove?: Fn;
  actions?: Record<string, Fn>;
};

const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
const req = (v: unknown, label: string, max = 500, min = 1) => {
  const s = str(v, max);
  if (s.length < min) throw new ApiError(`${label} is required`);
  return s;
};
const num = (v: unknown, label: string, opts: { min?: number; max?: number; optional?: boolean } = {}) => {
  if ((v === "" || v === null || v === undefined) && opts.optional) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ApiError(`${label} must be a number`);
  if (opts.min !== undefined && n < opts.min) throw new ApiError(`${label} must be at least ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) throw new ApiError(`${label} must be at most ${opts.max}`);
  return n;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], label: string): T => {
  if (!list.includes(v as T)) throw new ApiError(`Invalid ${label}`);
  return v as T;
};
const uniqueViolation = (e: unknown) => {
  const msg = String((e as any)?.message ?? "");
  return (e as any)?.code === "P2002" || msg.includes("Unique constraint");
};

export const BLOOD_GROUPS = ["O+ve", "O-ve", "A+ve", "A-ve", "B+ve", "B-ve", "AB+ve", "AB-ve", "Unknown"] as const;

async function saveConsentPhoto(dataUrl: string): Promise<string> {
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new ApiError("Invalid consent photo");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 8 * 1024 * 1024) throw new ApiError("Consent photo is too large");
  const out = await sharp(buf)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  const name = `${crypto.randomUUID()}.webp`;
  const dir = path.join(PRIVATE_DIR, "consent");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), out);
  return `/api/portal/consent/${name}`;
}

function cleanAllergies(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.map((x) => str(x, 60)).filter(Boolean))).slice(0, 30);
}

const categories: Handler = {
  module: "emr",
  async create({ user, body }) {
    try {
      const row = await prisma.clinicalCategory.create({
        data: { name: req(body.name, "Category name", 160), description: str(body.description, 600) || null },
      });
      await audit(user, "CREATE_CATEGORY", "ClinicalCategory", row.id, row.name);
      return row;
    } catch (e) {
      if (uniqueViolation(e)) throw new ApiError("A category with this name already exists", 409);
      throw e;
    }
  },
  async update({ user, body, id }) {
    try {
      const row = await prisma.clinicalCategory.update({
        where: { id: id! },
        data: { name: req(body.name, "Category name", 160), description: str(body.description, 600) || null },
      });
      await audit(user, "UPDATE_CATEGORY", "ClinicalCategory", id, row?.name);
      return row;
    } catch (e) {
      if (uniqueViolation(e)) throw new ApiError("A category with this name already exists", 409);
      throw e;
    }
  },
  async remove({ user, id }) {
    await prisma.clinicalCategory.delete({ where: { id: id! } });
    await audit(user, "DELETE_CATEGORY", "ClinicalCategory", id);
    return { ok: true };
  },
};

const patients: Handler = {
  module: "emr",
  async create({ user, body }) {
    const patientType = oneOf(body.patientType, ["INPATIENT", "OUTPATIENT"] as const, "patient type");
    const contact = req(body.contactNumber, "Contact number", 30);
    if (phoneDigits(contact).length < 10) throw new ApiError("Enter a valid contact number");
    const consent = body.consentPhoto ? await saveConsentPhoto(String(body.consentPhoto)) : null;
    const room = patientType === "INPATIENT" ? req(body.roomBedNumber, "Room / bed number", 40) : null;
    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.patient.count();
      let uhid = `RH-${new Date().getFullYear()}-${String(c + 1).padStart(4, "0")}`;
      const dupe = await tx.patient.findUnique({ where: { uhid } });
      if (dupe) uhid += `-${Math.floor(Math.random() * 900 + 100)}`;
      const p = await tx.patient.create({
        data: {
          uhid,
          fullName: encryptField(req(body.fullName, "Full name", 120, 2)),
          contactNumber: encryptField(contact),
          age: num(body.age, "Age", { min: 0, max: 120 })!,
          gender: oneOf(body.gender, ["MALE", "FEMALE", "OTHER"] as const, "gender"),
          bloodGroup: oneOf(body.bloodGroup, BLOOD_GROUPS, "blood group"),
          patientType,
          clinicalCondition: encryptField(str(body.clinicalCondition, 4000)),
          allergies: encryptJson(cleanAllergies(body.allergies)),
          consentPhotoUrl: consent,
          categoryId: str(body.categoryId, 60) || null,
        },
      });
      if (room) await tx.inpatientStay.create({ data: { patientId: p.id, roomBedNumber: room } });
      return p;
    });
    await audit(user, patientType === "INPATIENT" ? "ADMIT_PATIENT" : "REGISTER_OP", "Patient", created.id, created.uhid);
    return { id: created.id, uhid: created.uhid };
  },
  async update({ user, body, id }) {
    const set: Record<string, unknown> = {};
    if (body.fullName !== undefined) set.fullName = encryptField(req(body.fullName, "Full name", 120, 2));
    if (body.contactNumber !== undefined) {
      const c = req(body.contactNumber, "Contact number", 30);
      if (phoneDigits(c).length < 10) throw new ApiError("Enter a valid contact number");
      set.contactNumber = encryptField(c);
    }
    if (body.age !== undefined) set.age = num(body.age, "Age", { min: 0, max: 120 })!;
    if (body.gender !== undefined) set.gender = oneOf(body.gender, ["MALE", "FEMALE", "OTHER"] as const, "gender");
    if (body.bloodGroup !== undefined) set.bloodGroup = oneOf(body.bloodGroup, BLOOD_GROUPS, "blood group");
    if (body.clinicalCondition !== undefined) set.clinicalCondition = encryptField(str(body.clinicalCondition, 4000));
    if (body.allergies !== undefined) set.allergies = encryptJson(cleanAllergies(body.allergies));
    if (body.categoryId !== undefined) set.categoryId = str(body.categoryId, 60) || null;
    if (body.consentPhoto) set.consentPhotoUrl = await saveConsentPhoto(String(body.consentPhoto));
    await prisma.$transaction(async (tx) => {
      if (Object.keys(set).length) await tx.patient.update({ where: { id: id! }, data: set as never });
      if (body.roomBedNumber !== undefined) {
        const room = str(body.roomBedNumber, 40);
        if (room) {
          await tx.inpatientStay.updateMany({ where: { patientId: id!, status: "ADMITTED" }, data: { roomBedNumber: room } });
        }
      }
    });
    await audit(user, "UPDATE_PATIENT", "Patient", id, "EMR record edited");
    return { ok: true };
  },
  async remove({ user, id }) {
    await prisma.patient.update({ where: { id: id! }, data: { isArchived: true } });
    await audit(user, "ARCHIVE_PATIENT", "Patient", id, "Soft-removed from active lists");
    return { ok: true };
  },
  actions: {
    async discharge({ user, body, id }) {
      await prisma.$transaction(async (tx) => {
        const p = await tx.patient.findUnique({ where: { id: id! } });
        if (!p) throw new ApiError("Patient not found", 404);
        await tx.patient.update({ where: { id: id! }, data: { isDischarged: true } });
        await tx.inpatientStay.updateMany({
          where: { patientId: id!, status: "ADMITTED" },
          data: {
            status: "DISCHARGED",
            dischargeDate: new Date(),
            dischargeNotes: body.notes ? encryptField(str(body.notes, 3000)) : null,
          },
        });
      });
      await audit(user, "DISCHARGE_PATIENT", "Patient", id);
      return { ok: true };
    },
    async unarchive({ user, id }) {
      await prisma.patient.update({ where: { id: id! }, data: { isArchived: false } });
      await audit(user, "RESTORE_PATIENT", "Patient", id);
      return { ok: true };
    },
    async archive({ user, id }) {
      await prisma.patient.update({ where: { id: id! }, data: { isArchived: true } });
      await audit(user, "ARCHIVE_PATIENT", "Patient", id);
      return { ok: true };
    },
    async vitals({ user, body, id }) {
      const p = await prisma.patient.findUnique({ where: { id: id! } });
      if (!p) throw new ApiError("Patient not found", 404);
      await prisma.vitalLog.create({
        data: {
          patientId: id!,
          recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
          haemoglobin: num(body.haemoglobin, "Haemoglobin", { min: 1, max: 25 })!,
          spO2: num(body.spO2, "SpO2", { min: 50, max: 100 })!,
          pulse: num(body.pulse, "Pulse", { min: 20, max: 250 })!,
          fastingGlucose: num(body.fastingGlucose, "Fasting glucose", { min: 10, max: 900, optional: true }),
          postPrandialGlucose: num(body.postPrandialGlucose, "PP glucose", { min: 10, max: 900, optional: true }),
          hbA1c: num(body.hbA1c, "HbA1c", { min: 2, max: 20, optional: true }),
          bpSystolic: num(body.bpSystolic, "Systolic BP", { min: 40, max: 300 })!,
          bpDiastolic: num(body.bpDiastolic, "Diastolic BP", { min: 20, max: 200 })!,
          serumFerritin: num(body.serumFerritin, "Serum ferritin", { min: 0, max: 100000, optional: true }),
          clinicalNotes: body.clinicalNotes ? encryptField(str(body.clinicalNotes, 2000)) : null,
          recordedByStaff: user.fullName,
        },
      });
      await audit(user, "LOG_VITALS", "Patient", id);
      return { ok: true };
    },
  },
};

const bloodbank: Handler = {
  module: "bloodbank",
  async create({ user, body }) {
    const stocks = Array.isArray(body.stocks) ? body.stocks : [];
    if (!stocks.length) throw new ApiError("No stock values supplied");
    const colors: Record<string, string> = { O: "SKY_BLUE", A: "YELLOW", B: "RED", AB: "WHITE" };
    for (const s of stocks) {
      const g = oneOf(s.bloodGroup, ["O", "A", "B", "AB"] as const, "blood group");
      const wb = num(s.wholeBloodUnits, "Whole blood units", { min: 0, max: 9999 })!;
      const pl = num(s.plasmaUnits, "Plasma units", { min: 0, max: 9999 })!;
      await prisma.bloodStock.upsert({
        where: { bloodGroup: g },
        create: { bloodGroup: g, groupCategory: g, colorCode: colors[g], wholeBloodUnits: wb, plasmaUnits: pl },
        update: { wholeBloodUnits: wb, plasmaUnits: pl, lastUpdated: new Date() },
      });
    }
    await audit(
      user,
      "UPDATE_BLOOD_STOCK",
      "BloodStock",
      null,
      stocks.map((s: any) => `${s.bloodGroup}: WB=${s.wholeBloodUnits}, Plasma=${s.plasmaUnits}`).join(" | "),
    );
    return { ok: true };
  },
};

const orders: Handler = {
  module: "store",
  async update({ user, body, id }) {
    const status = oneOf(body.status, ["PENDING", "PAID", "PROCESSING", "DISPATCHED", "DELIVERED", "CANCELLED"] as const, "status");
    await prisma.$transaction(async (tx) => {
      const o = await tx.order.findUnique({ where: { id: id! } });
      if (!o) throw new ApiError("Order not found", 404);
      if (o.status === "CANCELLED" && status !== "CANCELLED") throw new ApiError("A cancelled order cannot be reopened");
      if (status === "CANCELLED" && o.status !== "CANCELLED") {
        const items = await tx.orderItem.findMany({ where: { orderId: id! } });
        for (const it of items) {
          const prod = await tx.product.findUnique({ where: { id: it.productId } });
          if (prod) await tx.product.update({ where: { id: it.productId }, data: { stockUnits: prod.stockUnits + it.quantity } });
        }
      }
      await tx.order.update({
        where: { id: id! },
        data: { status, isPaid: status === "CANCELLED" ? o.isPaid : ["PAID", "PROCESSING", "DISPATCHED", "DELIVERED"].includes(status) || o.isPaid },
      });
    });
    await audit(user, "ORDER_STATUS", "Order", id, status);
    return { ok: true };
  },
};

function employeeValues(b: Record<string, any>, defaultEntity?: string) {
  return {
    entity: oneOf(b.entity ?? defaultEntity ?? "RITHANYA_HOSPITAL", ["RITHANYA_HOSPITAL", "RVBC"] as const, "entity"),
    fullName: req(b.fullName, "Full name", 120, 2),
    designation: req(b.designation, "Designation", 120),
    department: req(b.department, "Department", 120),
    shiftSchedule: str(b.shiftSchedule, 80) || "General",
    contactNumber: str(b.contactNumber, 30),
    monthlyFixedBaseSalary: num(b.monthlyFixedBaseSalary, "Base salary", { min: 0, max: 10000000 })!,
    isActive: b.isActive === undefined ? true : Boolean(b.isActive),
  };
}

const employees: Handler = {
  module: "hr",
  async create({ user, body, entity }) {
    const row = await prisma.employee.create({ data: employeeValues(body, entity) as never });
    await audit(user, "CREATE_EMPLOYEE", "Employee", row.id, row.fullName);
    return row;
  },
  async update({ user, body, id, entity }) {
    const row = await prisma.employee.update({ where: { id: id! }, data: employeeValues(body, entity) as never });
    await audit(user, "UPDATE_EMPLOYEE", "Employee", id, row?.fullName);
    return row;
  },
  async remove({ user, id }) {
    await prisma.employee.delete({ where: { id: id! } });
    await audit(user, "DELETE_EMPLOYEE", "Employee", id);
    return { ok: true };
  },
  actions: {
    async toggle({ user, id }) {
      const e = await prisma.employee.findUnique({ where: { id: id! } });
      if (!e) throw new ApiError("Employee not found", 404);
      await prisma.employee.update({ where: { id: id! }, data: { isActive: !e.isActive } });
      await audit(user, "TOGGLE_EMPLOYEE", "Employee", id);
      return { ok: true };
    },
  },
};

function buildSignatureSvg(paths: unknown, w: unknown, h: unknown): string | null {
  if (!Array.isArray(paths) || !paths.length) return null;
  const width = Math.min(1200, Math.max(50, Number(w) || 400));
  const height = Math.min(600, Math.max(30, Number(h) || 160));
  const ds = paths.slice(0, 200).map((d) => String(d));
  for (const d of ds) if (!/^[MLml0-9., \-]+$/.test(d) || d.length > 20000) throw new ApiError("Invalid signature data");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${ds
    .map((d) => `<path d="${d}" fill="none" stroke="#0A2540" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("")}</svg>`;
}

const payroll: Handler = {
  module: "hr",
  async create({ user, body }) {
    const employeeId = req(body.employeeId, "Employee", 60);
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) throw new ApiError("Employee not found", 404);
    const month = num(body.month, "Month", { min: 1, max: 12 })!;
    const year = num(body.year, "Year", { min: 2020, max: 2100 })!;
    const calendarDays = daysInMonth(month, year);
    const lopDays = num(body.lopDays ?? 0, "LOP days", { min: 0, max: calendarDays })!;
    const allowances = num(body.allowances ?? 0, "Allowances", { min: 0 })!;
    const otherDeductions = num(body.otherDeductions ?? 0, "Deductions", { min: 0 })!;
    const c = computeMonthlyPayroll({
      baseSalary: Number(emp.monthlyFixedBaseSalary),
      calendarDays,
      lopDays,
      allowances,
      otherDeductions,
    });
    const svg = buildSignatureSvg(body.signaturePaths, body.signatureWidth, body.signatureHeight);
    const values = {
      employeeId,
      month,
      year,
      baseSalary: c.baseSalary,
      calendarDays,
      lopDays,
      paidDays: c.paidDays,
      lopDeduction: c.lopDeduction,
      allowances,
      otherDeductions,
      netPayable: c.netPayable,
      authorizerSignSvg: svg,
      authorizerName: svg ? user.fullName : null,
      signedAt: svg ? new Date() : null,
    };
    const row = await prisma.payrollRecord.upsert({
      where: { employeeId_month_year: { employeeId, month, year } },
      create: values,
      update: values,
    });
    await audit(user, "PROCESS_PAYROLL", "PayrollRecord", row.id, `${emp.fullName} ${month}/${year} net ${values.netPayable}`);
    return row;
  },
  async remove({ user, id }) {
    await prisma.payrollRecord.delete({ where: { id: id! } });
    await audit(user, "DELETE_PAYROLL", "PayrollRecord", id);
    return { ok: true };
  },
};

const expenseCategories: Handler = {
  module: "finance",
  async create({ user, body, entity }) {
    try {
      const ent = oneOf(body.entity ?? entity ?? "RITHANYA_HOSPITAL", ["RITHANYA_HOSPITAL", "RVBC"] as const, "entity");
      const row = await prisma.expenseCategory.create({
        data: { entity: ent, name: req(body.name, "Category name", 120), description: str(body.description, 400) || null },
      });
      await audit(user, "CREATE_EXPENSE_CATEGORY", "ExpenseCategory", row.id, `${row.name} (${ent})`);
      return row;
    } catch (e) {
      if (uniqueViolation(e)) throw new ApiError("Category already exists", 409);
      throw e;
    }
  },
  async update({ user, body, id, entity }) {
    const data: Record<string, any> = {
      name: req(body.name, "Category name", 120),
      description: str(body.description, 400) || null,
    };
    if (body.entity || entity) data.entity = oneOf(body.entity ?? entity, ["RITHANYA_HOSPITAL", "RVBC"] as const, "entity");
    const row = await prisma.expenseCategory.update({
      where: { id: id! },
      data,
    });
    await audit(user, "UPDATE_EXPENSE_CATEGORY", "ExpenseCategory", id);
    return row;
  },
  async remove({ user, id }) {
    await prisma.expenseCategory.delete({ where: { id: id! } });
    await audit(user, "DELETE_EXPENSE_CATEGORY", "ExpenseCategory", id);
    return { ok: true };
  },
};

function ledgerValues(b: Record<string, any>, defaultEntity?: string) {
  return {
    entity: oneOf(b.entity ?? defaultEntity ?? "RITHANYA_HOSPITAL", ["RITHANYA_HOSPITAL", "RVBC"] as const, "entity"),
    type: oneOf(b.type, ["CREDIT", "DEBIT"] as const, "type"),
    itemName: req(b.itemName, "Item name", 200),
    description: str(b.description, 1000) || null,
    categoryId: str(b.categoryId, 60) || null,
    vendorPayee: req(b.vendorPayee, "Vendor / payee", 200),
    amount: num(b.amount, "Amount", { min: 0.01, max: 1e10 })!,
    invoiceRef: str(b.invoiceRef, 80) || null,
    method: oneOf(b.method, ["Cash", "UPI", "NEFT", "Cheque"] as const, "payment mode"),
    entryDate: b.entryDate ? new Date(b.entryDate) : new Date(),
  };
}

const ledger: Handler = {
  module: "finance",
  async create({ user, body, entity }) {
    const row = await prisma.expenseLedger.create({ data: ledgerValues(body, entity) as never });
    await audit(user, "LEDGER_ENTRY", "ExpenseLedger", row.id, `${row.type} ${row.amount} ${row.itemName}`);
    return row;
  },
  async update({ user, body, id, entity }) {
    const row = await prisma.expenseLedger.update({ where: { id: id! }, data: ledgerValues(body, entity) as never });
    await audit(user, "LEDGER_UPDATE", "ExpenseLedger", id);
    return row;
  },
  async remove({ user, id }) {
    await prisma.expenseLedger.delete({ where: { id: id! } });
    await audit(user, "LEDGER_DELETE", "ExpenseLedger", id);
    return { ok: true };
  },
};

async function matchPatients(r: { phoneNumber: string; fullName: string; identificationRef: string | null }) {
  const all = await prisma.patient.findMany();
  const phone = phoneDigits(r.phoneNumber).slice(-10);
  const name = r.fullName.trim().toLowerCase();
  const ref = (r.identificationRef ?? "").trim().toLowerCase();
  const hits = [];
  for (const p of all) {
    const pPhone = phoneDigits(decryptField(p.contactNumber)).slice(-10);
    const pName = decryptField(p.fullName).trim().toLowerCase();
    if (pPhone === phone && (pName === name || (ref && p.uhid.toLowerCase() === ref))) hits.push({ p, pName: decryptField(p.fullName) });
  }
  return hits;
}

const dpdp: Handler = {
  module: "dpdp",
  actions: {
    async match({ id }) {
      const r = await prisma.dpdpErasureRequest.findUnique({ where: { id: id! } });
      if (!r) throw new ApiError("Request not found", 404);
      const hits = await matchPatients(r);
      return {
        matches: hits.map(({ p, pName }) => ({
          id: p.id,
          uhid: p.uhid,
          name: pName.replace(/(?<=.).(?=.{0,})/g, (_c: string, i: number) => (i < 2 ? _c : _c === " " ? " " : "•")),
          type: p.patientType,
          createdAt: p.createdAt,
        })),
      };
    },
    async erase({ user, id }) {
      const r = await prisma.dpdpErasureRequest.findUnique({ where: { id: id! } });
      if (!r) throw new ApiError("Request not found", 404);
      if (r.status !== "PENDING") throw new ApiError("This request has already been resolved");
      const hits = await matchPatients(r);
      if (!hits.length) throw new ApiError("No matching EMR record located. Resolve the request manually instead.", 404);
      await prisma.$transaction(async (tx) => {
        for (const { p } of hits) {
          if (p.consentPhotoUrl?.startsWith("/api/portal/consent/")) {
            await fs.rm(path.join(PRIVATE_DIR, "consent", path.basename(p.consentPhotoUrl)), { force: true });
          }
          await tx.patient.delete({ where: { id: p.id } });
        }
        await tx.dpdpErasureRequest.update({
          where: { id: id! },
          data: {
            status: "MATCHED_AND_ERASED",
            matchedPatientId: hits[0].p.id,
            resolutionNotes: `${hits.length} patient record(s) (${hits.map((h) => h.p.uhid).join(", ")}) with stays and vitals were cascaded and securely destroyed.`,
          },
        });
      });
      await audit(user, "DPDP_ERASE", "DpdpErasureRequest", id, `${hits.length} record(s) erased`);
      return { ok: true, erased: hits.length };
    },
    async resolve({ user, body, id }) {
      await prisma.dpdpErasureRequest.update({
        where: { id: id! },
        data: { status: "MANUALLY_RESOLVED", resolutionNotes: str(body.notes, 1500) || "Resolved manually by the compliance desk." },
      });
      await audit(user, "DPDP_RESOLVE", "DpdpErasureRequest", id);
      return { ok: true };
    },
    async reject({ user, body, id }) {
      await prisma.dpdpErasureRequest.update({
        where: { id: id! },
        data: { status: "REJECTED", resolutionNotes: str(body.notes, 1500) || "Request dismissed after verification." },
      });
      await audit(user, "DPDP_REJECT", "DpdpErasureRequest", id);
      return { ok: true };
    },
  },
};

async function assertCanManage(actor: SessionUser, targetRole: Role, targetId?: string) {
  if (targetId && targetId === actor.id) return;
  if (actor.role === "SUPERADMIN") return;
  if (actor.role === "ADMIN" && targetRole === "STAFF") return;
  throw new ApiError("You can only manage Staff accounts", 403);
}

const MODULE_COLS: Record<string, string> = {
  emr: "canManageEMR",
  bloodbank: "canManageBloodBank",
  cms: "canManageCMS",
  store: "canManageStore",
  hr: "canManageHR",
  finance: "canManageFinance",
  dpdp: "canManageDPDP",
  settings: "canManageSettings",
};

async function writeAccess(tx: any, userId: string, role: Role, mods?: Record<string, boolean>) {
  const base = computeModules(role);
  const values: Record<string, boolean> = {};
  for (const [k, col] of Object.entries(MODULE_COLS)) values[col as string] = mods ? Boolean(mods[k]) : (base as any)[k];
  if (role !== "SUPERADMIN") values.canManageSettings = false;
  await tx.userModuleAccess.upsert({ where: { userId }, create: { userId, ...values }, update: values });
}

const users: Handler = {
  module: "access",
  async create({ user, body }) {
    const role = oneOf(body.role, ["SUPERADMIN", "ADMIN", "STAFF"] as const, "role");
    if (role === "SUPERADMIN" && user.role !== "SUPERADMIN") throw new ApiError("Only a Superadmin can create a Superadmin", 403);
    await assertCanManage(user, role);
    const password = String(body.password ?? "");
    if (password.length < 8) throw new ApiError("Password must be at least 8 characters");
    try {
      const passwordHash = await hashPassword(password);
      const row = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            username: req(body.username, "Username", 80, 3).toLowerCase().replace(/\s+/g, ""),
            email: req(body.email, "Email", 200).toLowerCase(),
            fullName: req(body.fullName, "Full name", 120),
            role,
            passwordHash,
            createdById: user.id,
          },
        });
        await writeAccess(tx, u.id, role);
        return u;
      });
      await audit(user, "CREATE_USER", "User", row.id, `${row.username} (${role})`);
      return { id: row.id };
    } catch (e) {
      if (uniqueViolation(e)) throw new ApiError("Username or email already in use", 409);
      throw e;
    }
  },
  async update({ user, body, id }) {
    const target = await prisma.user.findUnique({ where: { id: id! } });
    if (!target) throw new ApiError("User not found", 404);
    await assertCanManage(user, target.role as Role, id);
    if (id === user.id && body.isActive === false) throw new ApiError("You cannot deactivate your own account");
    const set: Record<string, unknown> = {};
    if (body.fullName !== undefined) set.fullName = req(body.fullName, "Full name", 120);
    if (body.email !== undefined) set.email = req(body.email, "Email", 200).toLowerCase();
    if (body.isActive !== undefined) set.isActive = Boolean(body.isActive);
    if (body.role !== undefined && body.role !== target.role) {
      const role = oneOf(body.role, ["SUPERADMIN", "ADMIN", "STAFF"] as const, "role");
      if (id === user.id) throw new ApiError("You cannot change your own role");
      if (user.role !== "SUPERADMIN") throw new ApiError("Only a Superadmin can change roles", 403);
      set.role = role;
    }
    if (body.password) {
      if (String(body.password).length < 8) throw new ApiError("Password must be at least 8 characters");
      set.passwordHash = await hashPassword(String(body.password));
    }
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: id! }, data: set as never });
        if (set.role) await writeAccess(tx, id!, set.role as Role);
      });
    } catch (e) {
      if (uniqueViolation(e)) throw new ApiError("Email already in use", 409);
      throw e;
    }
    await audit(user, body.password ? "RESET_PASSWORD" : "UPDATE_USER", "User", id, target.username);
    return { ok: true };
  },
  async remove({ user, id }) {
    if (id === user.id) throw new ApiError("You cannot delete your own account");
    const target = await prisma.user.findUnique({ where: { id: id! } });
    if (!target) throw new ApiError("User not found", 404);
    await assertCanManage(user, target.role as Role);
    await prisma.user.delete({ where: { id: id! } });
    await audit(user, "DELETE_USER", "User", id, target.username);
    return { ok: true };
  },
};

const permissions: Handler = {
  module: "access",
  async update({ user, body, id }) {
    const target = await prisma.user.findUnique({ where: { id: id! } });
    if (!target) throw new ApiError("User not found", 404);
    if (target.role === "SUPERADMIN") throw new ApiError("Superadmin permissions are fixed", 403);
    await assertCanManage(user, target.role as Role);
    if (id === user.id) throw new ApiError("You cannot edit your own permissions", 403);
    const mods = (body.modules ?? {}) as Record<string, boolean>;
    await prisma.$transaction(async (tx) => writeAccess(tx, id!, target.role as Role, mods));
    await audit(user, "UPDATE_PERMISSIONS", "User", id, target.username);
    return { ok: true };
  },
};

const settings: Handler = {
  module: "settings",
  async update({ user, body }) {
    const partial: Record<string, unknown> = {};
    const has = (k: string) => body[k] !== undefined;
    if (has("legalName")) partial.legalName = req(body.legalName, "Legal name", 160);
    if (has("clinicalTagline")) partial.clinicalTagline = str(body.clinicalTagline, 300);
    if (has("emergencyHotline")) partial.emergencyHotline = req(body.emergencyHotline, "Emergency hotline", 30);
    if (has("secondaryHotline")) partial.secondaryHotline = str(body.secondaryHotline, 30) || null;
    if (has("whatsappNumber")) partial.whatsappNumber = phoneDigits(str(body.whatsappNumber, 30));
    if (has("email")) partial.email = str(body.email, 200);
    if (has("physicalAddress")) partial.physicalAddress = str(body.physicalAddress, 600);
    if (has("opdTimings")) partial.opdTimings = str(body.opdTimings, 300);
    if (has("noticeBanner")) partial.noticeBanner = str(body.noticeBanner, 400);
    if (has("criticalBloodAlertThreshold")) partial.criticalBloodAlertThreshold = Math.trunc(num(body.criticalBloodAlertThreshold, "Blood alert threshold", { min: 0, max: 999 })!);
    if (has("seoPageTitle")) partial.seoPageTitle = str(body.seoPageTitle, 200);
    if (has("metaDescription")) partial.metaDescription = str(body.metaDescription, 400);
    if (has("targetKeywords")) partial.targetKeywords = str(body.targetKeywords, 600);
    if (has("canonicalUrl")) {
      const u = str(body.canonicalUrl, 300) || "https://rithanyahospital.com";
      try {
        new URL(u);
      } catch {
        throw new ApiError("Canonical URL must be a valid URL");
      }
      partial.canonicalUrl = u;
    }
    if (has("robotsIndexFollow")) partial.robotsIndexFollow = Boolean(body.robotsIndexFollow);
    if (has("faviconUrl")) partial.faviconUrl = str(body.faviconUrl, 400) || null;
    if (has("socialShareThumbnailUrl")) partial.socialShareThumbnailUrl = str(body.socialShareThumbnailUrl, 400) || null;
    if (!Object.keys(partial).length) throw new ApiError("Nothing to update");
    await prisma.hospitalSetting.update({ where: { id: "PRIMARY_CONFIG" }, data: partial as never });
    await audit(user, "UPDATE_SETTINGS", "HospitalSetting", "PRIMARY_CONFIG", Object.keys(partial).join(", "));
    return { ok: true };
  },
};

const appointments: Handler = {
  module: "emr",
  async update({ user, body, id }) {
    const status = oneOf(body.status, ["NEW", "CONFIRMED", "COMPLETED", "CANCELLED"] as const, "status");
    await prisma.appointment.update({ where: { id: id! }, data: { status } });
    await audit(user, "APPOINTMENT_STATUS", "Appointment", id, status);
    return { ok: true };
  },
  async remove({ user, id }) {
    await prisma.appointment.delete({ where: { id: id! } });
    await audit(user, "DELETE_APPOINTMENT", "Appointment", id);
    return { ok: true };
  },
};

export const RESOURCES: Record<string, Handler> = {
  categories,
  patients,
  bloodbank,
  orders,
  employees,
  payroll,
  "expense-categories": expenseCategories,
  ledger,
  dpdp,
  users,
  permissions,
  settings,
  appointments,
};
