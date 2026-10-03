import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma, isDbOnCooldown, reportDbError, withDbTimeout } from "./db.js";
import { loadEmployees } from "./employees.js";
import { computeMonthlyPayroll, daysInMonth } from "./payroll.js";

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

// Initial demo seeded records
const SEED_RECORDS: PayrollRecordDTO[] = [
  {
    id: "pay-seed-001",
    employeeId: "emp-dr-narayana",
    entity: "RITHANYA_HOSPITAL",
    month: 10,
    year: 2026,
    baseSalary: 150000,
    calendarDays: 31,
    lopDays: 0,
    paidDays: 31,
    perDaySalary: 4838.71,
    lopDeduction: 0,
    allowances: 15000,
    otherDeductions: 5000,
    netPayable: 160000,
    authorizerName: "Hospital Superadmin",
    signedAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
    createdAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
  },
  {
    id: "pay-seed-002",
    employeeId: "emp-s-kavitha",
    entity: "RITHANYA_HOSPITAL",
    month: 10,
    year: 2026,
    baseSalary: 45000,
    calendarDays: 31,
    lopDays: 1,
    paidDays: 30,
    perDaySalary: 1451.61,
    lopDeduction: 1451.61,
    allowances: 3000,
    otherDeductions: 1000,
    netPayable: 45548.39,
    authorizerName: "Hospital Superadmin",
    signedAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
    createdAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
  },
];

let inMemoryPayroll: PayrollRecordDTO[] = loadCache();

function loadCache(): PayrollRecordDTO[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
    fs.writeFileSync(CACHE_FILE, JSON.stringify(inMemoryPayroll, null, 2), "utf-8");
  } catch (err) {
    console.warn("[payrollStore] Could not persist payroll cache file:", err);
  }
}

/**
 * 12-Month Rolling Retention Rule:
 * Keep only records from the last 12 months up to the current date.
 * Any record older than 12 months is permanently pruned.
 */
export function pruneOldPayrollRecords(): void {
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
      withDbTimeout(
        prisma.payrollRecord.deleteMany({
          where: { id: { in: prunedRecords } },
        }),
        3000
      ).catch((err) => {
        reportDbError(err);
      });
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
  pruneOldPayrollRecords();

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
        2500
      );

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
      reportDbError(err);
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

  // Background DB sync
  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.payrollRecord.upsert({
        where: {
          employeeId_month_year: {
            employeeId: data.employeeId,
            month: data.month,
            year: data.year,
          },
        },
        create: {
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
        },
        update: {
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
        },
      }),
      3000
    ).catch((err) => {
      reportDbError(err);
      console.warn("[payrollStore] Background DB sync failed, saved safely in memory cache:", err?.message || err);
    });
  }

  return record;
}

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
