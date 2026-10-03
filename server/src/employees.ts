import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma, isDbOnCooldown, reportDbError, withDbTimeout } from "./db.js";

export type EmployeeDTO = {
  id: string;
  entity: "RITHANYA_HOSPITAL" | "RVBC";
  fullName: string;
  designation: string;
  department: string;
  shiftSchedule: string;
  contactNumber: string;
  monthlyFixedBaseSalary: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const CACHE_FILE = path.resolve(process.cwd(), "uploads", "employees-cache.json");

const SEED_EMPLOYEES: EmployeeDTO[] = [
  {
    id: "emp-rh-narayana",
    entity: "RITHANYA_HOSPITAL",
    fullName: "Dr. D. Narayana Murthy",
    designation: "Chief Medical Officer & Consultant Diabetologist",
    department: "Diabetology & General Medicine",
    shiftSchedule: "General (9 AM – 5 PM)",
    contactNumber: "9848011223",
    monthlyFixedBaseSalary: 120000,
    isActive: true,
    createdAt: new Date("2026-01-10").toISOString(),
    updatedAt: new Date("2026-01-10").toISOString(),
  },
  {
    id: "emp-rh-deepa",
    entity: "RITHANYA_HOSPITAL",
    fullName: "Dr. A. Lakshmi Deepa",
    designation: "Pediatric Hematologist & Thalassemia Daycare Lead",
    department: "Pediatrics & Hematology",
    shiftSchedule: "Morning shift (8 AM – 4 PM)",
    contactNumber: "9848022334",
    monthlyFixedBaseSalary: 95000,
    isActive: true,
    createdAt: new Date("2026-01-15").toISOString(),
    updatedAt: new Date("2026-01-15").toISOString(),
  },
  {
    id: "emp-rh-swathi",
    entity: "RITHANYA_HOSPITAL",
    fullName: "Staff Nurse Swathi",
    designation: "Senior Staff Nurse — Daycare Transfusion",
    department: "Nursing & Daycare",
    shiftSchedule: "Rotational Day (7 AM – 3 PM)",
    contactNumber: "9848033445",
    monthlyFixedBaseSalary: 32000,
    isActive: true,
    createdAt: new Date("2026-02-01").toISOString(),
    updatedAt: new Date("2026-02-01").toISOString(),
  },
  {
    id: "emp-rvbc-phleb",
    entity: "RVBC",
    fullName: "K. Suresh Reddy",
    designation: "Senior Blood Bank Technician & Phlebotomist",
    department: "Blood Centre & Component Separation",
    shiftSchedule: "Rotational (8 AM – 4 PM)",
    contactNumber: "9848044556",
    monthlyFixedBaseSalary: 36000,
    isActive: true,
    createdAt: new Date("2026-01-20").toISOString(),
    updatedAt: new Date("2026-01-20").toISOString(),
  },
  {
    id: "emp-rvbc-officer",
    entity: "RVBC",
    fullName: "Dr. P. Mohan Rao",
    designation: "Blood Transfusion Officer (BTO)",
    department: "Voluntary Blood Centre",
    shiftSchedule: "General (9 AM – 5 PM)",
    contactNumber: "9848055667",
    monthlyFixedBaseSalary: 85000,
    isActive: true,
    createdAt: new Date("2026-01-05").toISOString(),
    updatedAt: new Date("2026-01-05").toISOString(),
  },
];

let inMemoryEmployees: EmployeeDTO[] = loadCache();

function loadCache(): EmployeeDTO[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn("[employees] Could not read employees cache file:", err);
  }
  return [...SEED_EMPLOYEES];
}

function persistCache(): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(inMemoryEmployees, null, 2), "utf-8");
  } catch (err) {
    console.warn("[employees] Could not persist employees cache file:", err);
  }
}

export async function loadEmployees(entity: string): Promise<EmployeeDTO[]> {
  const targetEntity = entity === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";

  if (!isDbOnCooldown()) {
    try {
      const rows = await withDbTimeout(
        prisma.employee.findMany({
          where: { entity: targetEntity },
          orderBy: { fullName: "asc" },
        }),
        2000
      );

      const dbMapped: EmployeeDTO[] = rows.map((e) => ({
        id: e.id,
        entity: e.entity as EmployeeDTO["entity"],
        fullName: e.fullName,
        designation: e.designation,
        department: e.department,
        shiftSchedule: e.shiftSchedule,
        contactNumber: e.contactNumber,
        monthlyFixedBaseSalary: e.monthlyFixedBaseSalary,
        isActive: e.isActive,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      }));

      for (const row of dbMapped) {
        const idx = inMemoryEmployees.findIndex((x) => x.id === row.id);
        if (idx >= 0) inMemoryEmployees[idx] = row;
        else inMemoryEmployees.push(row);
      }
      persistCache();
      return inMemoryEmployees.filter((e) => e.entity === targetEntity).sort((a, b) => a.fullName.localeCompare(b.fullName));
    } catch (err) {
      reportDbError(err);
      console.warn("[employees] DB query failed, falling back to resilient in-memory store:", (err as Error)?.message || err);
    }
  }

  return inMemoryEmployees.filter((e) => e.entity === targetEntity).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function createEmployeeRecord(data: {
  entity?: unknown;
  fullName: string;
  designation: string;
  department: string;
  shiftSchedule?: string;
  contactNumber?: string;
  monthlyFixedBaseSalary: number;
  isActive?: boolean;
}): Promise<EmployeeDTO> {
  const entity = data.entity === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const newEmp: EmployeeDTO = {
    id,
    entity,
    fullName: data.fullName,
    designation: data.designation,
    department: data.department,
    shiftSchedule: data.shiftSchedule || "General",
    contactNumber: data.contactNumber || "",
    monthlyFixedBaseSalary: data.monthlyFixedBaseSalary,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    createdAt: now,
    updatedAt: now,
  };

  inMemoryEmployees.push(newEmp);
  persistCache();

  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.employee.create({
        data: {
          id,
          entity,
          fullName: newEmp.fullName,
          designation: newEmp.designation,
          department: newEmp.department,
          shiftSchedule: newEmp.shiftSchedule,
          contactNumber: newEmp.contactNumber,
          monthlyFixedBaseSalary: newEmp.monthlyFixedBaseSalary,
          isActive: newEmp.isActive,
        },
      }),
      2500
    ).catch((err) => {
      reportDbError(err);
      console.warn("[employees] Background DB sync failed, safely saved in memory cache:", err?.message || err);
    });
  }

  return newEmp;
}

export async function updateEmployeeRecord(
  id: string,
  data: Partial<Omit<EmployeeDTO, "id" | "createdAt">>
): Promise<EmployeeDTO> {
  const emp = inMemoryEmployees.find((x) => x.id === id);
  if (!emp) throw new Error("Employee not found");

  if (data.entity) emp.entity = data.entity === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";
  if (data.fullName !== undefined) emp.fullName = data.fullName;
  if (data.designation !== undefined) emp.designation = data.designation;
  if (data.department !== undefined) emp.department = data.department;
  if (data.shiftSchedule !== undefined) emp.shiftSchedule = data.shiftSchedule;
  if (data.contactNumber !== undefined) emp.contactNumber = data.contactNumber;
  if (data.monthlyFixedBaseSalary !== undefined) emp.monthlyFixedBaseSalary = data.monthlyFixedBaseSalary;
  if (data.isActive !== undefined) emp.isActive = Boolean(data.isActive);
  emp.updatedAt = new Date().toISOString();

  persistCache();

  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.employee.update({
        where: { id },
        data: {
          ...(data.entity ? { entity: emp.entity } : {}),
          ...(data.fullName !== undefined ? { fullName: emp.fullName } : {}),
          ...(data.designation !== undefined ? { designation: emp.designation } : {}),
          ...(data.department !== undefined ? { department: emp.department } : {}),
          ...(data.shiftSchedule !== undefined ? { shiftSchedule: emp.shiftSchedule } : {}),
          ...(data.contactNumber !== undefined ? { contactNumber: emp.contactNumber } : {}),
          ...(data.monthlyFixedBaseSalary !== undefined ? { monthlyFixedBaseSalary: emp.monthlyFixedBaseSalary } : {}),
          ...(data.isActive !== undefined ? { isActive: emp.isActive } : {}),
        },
      }),
      2500
    ).catch((err) => {
      reportDbError(err);
      console.warn("[employees] Background DB update failed:", err?.message || err);
    });
  }

  return emp;
}

export async function deleteEmployeeRecord(id: string): Promise<void> {
  const idx = inMemoryEmployees.findIndex((x) => x.id === id);
  if (idx >= 0) inMemoryEmployees.splice(idx, 1);
  persistCache();

  if (!isDbOnCooldown()) {
    withDbTimeout(prisma.employee.delete({ where: { id } }), 2500).catch((err) => {
      reportDbError(err);
      console.warn("[employees] Background DB delete failed:", err?.message || err);
    });
  }
}

export async function toggleEmployeeRecord(id: string): Promise<EmployeeDTO> {
  const emp = inMemoryEmployees.find((x) => x.id === id);
  if (!emp) throw new Error("Employee not found");
  emp.isActive = !emp.isActive;
  emp.updatedAt = new Date().toISOString();
  persistCache();

  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.employee.update({
        where: { id },
        data: { isActive: emp.isActive },
      }),
      2500
    ).catch((err) => {
      reportDbError(err);
    });
  }

  return emp;
}
