import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
import { loadEmployees } from "./employees.js";
import { computeMonthlyPayroll, daysInMonth } from "./payroll.js";
import { enqueueOutbox, outboxHasPending, registerOutboxExecutor, wakeOutbox } from "./outbox.js";
import { encryptJson, decryptJson } from "./crypto.js";

export type PayrollRecordDTO = {
  id: string;
  employeeId: string;
  entity: "RITHANYA_HOSPITAL" | "RVBC";
  month: number;
  year: number;
  baseSalary: number;
  calendarDays: number;
  lopDays: number;
  paidDays: number;
  perDaySalary: number;
  lopDeduction: number;
  allowances: number;
  otherDeductions: number;
  netPayable: number;
  authorizerName?: string | null;
  authorizerSignSvg?: string | null;
  signedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

const CACHE_FILE = path.resolve(process.cwd(), "uploads", "payroll-cache.json");

// Initial demo seeded records (fixed ids so DB rows match the in-memory store)
const SEED_RECORDS: PayrollRecordDTO[] = [
  {
    id: "pay-seed-001",
    employeeId: "emp-rh-narayana",
    entity: "RITHANYA_HOSPITAL",
    month: 10,
    year: 2026,
    baseSalary: 120000,
    calendarDays: 31,
    lopDays: 0,
    paidDays: 31,
    perDaySalary: 3870.97,
    lopDeduction: 0,
    allowances: 15000,
    otherDeductions: 5000,
    netPayable: 130000,
    authorizerName: "Hospital Superadmin",
    signedAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
    createdAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
  },
  {
    id: "pay-seed-002",
    employeeId: "emp-rh-swathi",
    entity: "RITHANYA_HOSPITAL",
    month: 10,
    year: 2026,
    baseSalary: 32000,
    calendarDays: 31,
    lopDays: 1,
    paidDays: 30,
    perDaySalary: 1032.26,
    lopDeduction: 1032.26,
    allowances: 3000,
    otherDeductions: 1000,
    netPayable: 32967.74,
    authorizerName: "Hospital Superadmin",
    signedAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
    createdAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
  },
];

export { SEED_RECORDS };

let inMemoryPayroll: PayrollRecordDTO[] = loadCache();

function loadCache(): PayrollRecordDTO[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      // New format: encrypted payload. Legacy: plaintext JSON array.
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      if (!Array.isArray(parsed)) {
        const dec = decryptJson<PayrollRecordDTO[]>(raw, null as unknown as PayrollRecordDTO[]);
        parsed = Array.isArray(dec) ? dec : null;
      }
      if (Array.isArray(parsed) && (parsed as PayrollRecordDTO[]).length > 0) {
        return parsed as PayrollRecordDTO[];
      }
    }
  } catch (err) {
    console.warn("[payrollStore] Could not read payroll cache file:", err);
  }
  return [...SEED_RECORDS];
}

function persistCache(): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Payroll data is sensitive — keep the offline cache encrypted.
    fs.writeFileSync(CACHE_FILE, encryptJson(inMemoryPayroll), "utf-8");
  } catch (err) {
    console.warn("[payrollStore] Could not persist payroll cache file:", err);
  }
}

/** Awaited payroll persistence helper: DB first, durable outbox on failure. */
async function persistPayrollWrite(
  op: { module: "payroll"; action: "upsert" | "delete"; key: string; payload: unknown },
  run: () => Promise<unknown>,
): Promise<void> {
  if (outboxHasPending("payroll") || isDbOnCooldown()) {
    enqueueOutbox(op);
    return;
  }
  try {
    await withDbTimeout(run(), DB_WRITE_MS);
    reportDbSuccess();
    wakeOutbox();
  } catch (err) {
    if (isTransientDbError(err)) reportDbError(err);
    console.warn(`[payrollStore] DB write failed (${op.action}) — queued for durable retry:`, (err as Error)?.message || err);
    enqueueOutbox(op);
  }
}

/**
 * 12-Month Rolling Retention Rule:
 * Keep only records from the last 12 months up to the current date.
 * Any record older than 12 months is permanently pruned.
 */
export async function pruneOldPayrollRecords(): Promise<void> {
  const now = new Date();
  const currentTotalMonths = now.getFullYear() * 12 + (now.getMonth() + 1);
  const cutoffTotalMonths = currentTotalMonths - 12;

  const originalCount = inMemoryPayroll.length;
  const prunedRecords: string[] = [];

  inMemoryPayroll = inMemoryPayroll.filter((r) => {
    const rTotalMonths = r.year * 12 + r.month;
    if (rTotalMonths < cutoffTotalMonths) {
      prunedRecords.push(r.id);
      return false;
    }
    return true;
  });

  if (inMemoryPayroll.length !== originalCount) {
    persistCache();
    console.log(`[payrollStore] 12-Month retention pruned ${originalCount - inMemoryPayroll.length} old payroll records`);

    if (!isDbOnCooldown() && prunedRecords.length > 0) {
      try {
        await withDbTimeout(
          prisma.payrollRecord.deleteMany({ where: { id: { in: prunedRecords } } }),
          DB_WRITE_MS,
        );
        reportDbSuccess();
        wakeOutbox();
      } catch (err) {
        if (isTransientDbError(err)) reportDbError(err);
      }
    }
  }
}

export async function loadPayrollData(
  entity: string,
  month: number,
  year: number
): Promise<{
  employees: Array<{
    id: string;
    fullName: string;
    designation: string;
    department: string;
    base: number;
    isActive: boolean;
  }>;
  records: PayrollRecordDTO[];
}> {
  // Prune any records older than 12 months
  await pruneOldPayrollRecords();

  const targetEntity = entity === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";
  const allEmployees = await loadEmployees(targetEntity);
  // Only active employees appear in payroll calculations and desk
  const activeEmployees = allEmployees
    .filter((e) => e.isActive !== false)
    .map((e) => ({
      id: e.id,
      fullName: e.fullName,
      designation: e.designation,
      department: e.department,
      base: Number(e.monthlyFixedBaseSalary),
      isActive: e.isActive,
    }));

  if (!isDbOnCooldown()) {
    try {
      const dbRecords = await withDbTimeout(
        prisma.payrollRecord.findMany({
          where: {
            month,
            year,
            employee: { entity: targetEntity },
          },
          include: { employee: true },
        }),
        DB_READ_MS
      );
      reportDbSuccess();

      for (const r of dbRecords) {
        const mapped: PayrollRecordDTO = {
          id: r.id,
          employeeId: r.employeeId,
          entity: (r.employee?.entity as PayrollRecordDTO["entity"]) ?? targetEntity,
          month: r.month,
          year: r.year,
          baseSalary: r.baseSalary,
          calendarDays: r.calendarDays,
          lopDays: r.lopDays,
          paidDays: r.paidDays,
          perDaySalary: Math.round((r.baseSalary / (r.calendarDays || 30)) * 100) / 100,
          lopDeduction: r.lopDeduction,
          allowances: r.allowances,
          otherDeductions: r.otherDeductions,
          netPayable: r.netPayable,
          authorizerName: r.authorizerName,
          authorizerSignSvg: r.authorizerSignSvg,
          signedAt: r.signedAt ? r.signedAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };

        const idx = inMemoryPayroll.findIndex(
          (x) => x.employeeId === mapped.employeeId && x.month === mapped.month && x.year === mapped.year
        );
        if (idx >= 0) inMemoryPayroll[idx] = mapped;
        else inMemoryPayroll.push(mapped);
      }
      persistCache();
    } catch (err) {
      if (isTransientDbError(err)) reportDbError(err);
      console.warn("[payrollStore] DB query failed, falling back to resilient payroll cache:", (err as Error)?.message || err);
    }
  }

  // Filter matching records for this entity, month, and year
  const activeIds = new Set(activeEmployees.map((e) => e.id));
  const records = inMemoryPayroll.filter(
    (r) => r.entity === targetEntity && r.month === month && r.year === year && activeIds.has(r.employeeId)
  );

  return {
    employees: activeEmployees,
    records,
  };
}

export async function savePayrollRecord(data: {
  employeeId: string;
  entity: string;
  month: number;
  year: number;
  baseSalary?: number;
  lopDays: number;
  allowances: number;
  otherDeductions: number;
  authorizerName?: string | null;
  authorizerSignSvg?: string | null;
}): Promise<PayrollRecordDTO> {
  const targetEntity = data.entity === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";
  const calDays = daysInMonth(data.month, data.year);

  // Retrieve employee to ensure existence and base salary
  const employees = await loadEmployees(targetEntity);
  const emp = employees.find((e) => e.id === data.employeeId);
  if (!emp) throw new Error("Employee not found");

  const base = data.baseSalary !== undefined && data.baseSalary > 0
    ? data.baseSalary
    : Number(emp.monthlyFixedBaseSalary);

  const calc = computeMonthlyPayroll({
    baseSalary: base,
    calendarDays: calDays,
    lopDays: data.lopDays,
    allowances: data.allowances,
    otherDeductions: data.otherDeductions,
  });

  const now = new Date().toISOString();
  let existing = inMemoryPayroll.find(
    (r) => r.employeeId === data.employeeId && r.month === data.month && r.year === data.year
  );

  const id = existing?.id ?? crypto.randomUUID();
  const record: PayrollRecordDTO = {
    id,
    employeeId: data.employeeId,
    entity: targetEntity,
    month: data.month,
    year: data.year,
    baseSalary: calc.baseSalary,
    calendarDays: calc.calendarDays,
    lopDays: calc.lopDays,
    paidDays: calc.paidDays,
    perDaySalary: calc.perDaySalary,
    lopDeduction: calc.lopDeduction,
    allowances: calc.allowances,
    otherDeductions: calc.otherDeductions,
    netPayable: calc.netPayable,
    authorizerName: data.authorizerName ?? existing?.authorizerName ?? "Hospital Admin",
    authorizerSignSvg: data.authorizerSignSvg ?? existing?.authorizerSignSvg ?? null,
    signedAt: data.authorizerSignSvg ? now : (existing?.signedAt ?? null),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (existing) {
    const idx = inMemoryPayroll.findIndex((x) => x.id === existing!.id);
    if (idx >= 0) inMemoryPayroll[idx] = record;
  } else {
    inMemoryPayroll.push(record);
  }
  persistCache();

  const dbData = {
    id: record.id,
    employeeId: record.employeeId,
    month: record.month,
    year: record.year,
    baseSalary: record.baseSalary,
    calendarDays: record.calendarDays,
    lopDays: record.lopDays,
    paidDays: record.paidDays,
    lopDeduction: record.lopDeduction,
    allowances: record.allowances,
    otherDeductions: record.otherDeductions,
    netPayable: record.netPayable,
    authorizerName: record.authorizerName,
    authorizerSignSvg: record.authorizerSignSvg,
    signedAt: record.signedAt ? new Date(record.signedAt) : null,
  };

  await persistPayrollWrite(
    {
      module: "payroll",
      action: "upsert",
      key: `pay:${record.employeeId}:${record.year}-${record.month}`,
      payload: { employeeId: record.employeeId, month: record.month, year: record.year, data: dbData },
    },
    () =>
      prisma.payrollRecord.upsert({
        where: {
          employeeId_month_year: {
            employeeId: record.employeeId,
            month: record.month,
            year: record.year,
          },
        },
        create: dbData,
        update: {
          baseSalary: dbData.baseSalary,
          calendarDays: dbData.calendarDays,
          lopDays: dbData.lopDays,
          paidDays: dbData.paidDays,
          lopDeduction: dbData.lopDeduction,
          allowances: dbData.allowances,
          otherDeductions: dbData.otherDeductions,
          netPayable: dbData.netPayable,
          authorizerName: dbData.authorizerName,
          authorizerSignSvg: dbData.authorizerSignSvg,
          signedAt: dbData.signedAt,
        },
      }),
  );

  return record;
}

/**
 * Hard-delete a payroll slip (memory + DB). The DB deleteMany is idempotent,
 * so replayed outbox ops never resurrect anything.
 */
export async function deletePayrollRecord(id: string): Promise<void> {
  const idx = inMemoryPayroll.findIndex((r) => r.id === id);
  if (idx >= 0) inMemoryPayroll.splice(idx, 1);
  persistCache();

  await persistPayrollWrite(
    { module: "payroll", action: "delete", key: `pay:${id}`, payload: { id } },
    () => prisma.payrollRecord.deleteMany({ where: { id } }),
  );
}

// ---------------------------------------------------------------------------
// Durable outbox replay for payroll
// ---------------------------------------------------------------------------
registerOutboxExecutor("payroll", async (op) => {
  if (op.action === "upsert") {
    const p = op.payload as { employeeId: string; month: number; year: number; data: Record<string, unknown> };
    await prisma.payrollRecord.upsert({
      where: {
        employeeId_month_year: {
          employeeId: p.employeeId,
          month: p.month,
          year: p.year,
        },
      },
      create: p.data as never,
      update: p.data as never,
    });
    return;
  }
  if (op.action === "delete") {
    const p = op.payload as { id: string };
    await prisma.payrollRecord.deleteMany({ where: { id: p.id } });
    return;
  }
});

export async function getPayslipById(id: string): Promise<{
  record: PayrollRecordDTO & { employee: any };
} | null> {
  const rec = inMemoryPayroll.find((r) => r.id === id);
  if (!rec) return null;

  const employees = await loadEmployees(rec.entity);
  const emp = employees.find((e) => e.id === rec.employeeId);

  return {
    record: {
      ...rec,
      employee: emp ?? {
        fullName: "Staff Member",
        designation: "Healthcare Staff",
        department: "Clinical Services",
        entity: rec.entity,
      },
    },
  };
}
