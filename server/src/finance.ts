import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma, isDbOnCooldown, reportDbError, withDbTimeout } from "./db.js";

export type ExpenseCategoryDTO = {
  id: string;
  entity: "RITHANYA_HOSPITAL" | "RVBC";
  name: string;
  description: string | null;
  createdAt: string;
};

export type ExpenseLedgerDTO = {
  id: string;
  entity: "RITHANYA_HOSPITAL" | "RVBC";
  type: "CREDIT" | "DEBIT";
  itemName: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  vendorPayee: string;
  amount: number;
  invoiceRef: string | null;
  method: "Cash" | "UPI" | "NEFT" | "Cheque";
  entryDate: string;
  createdAt: string;
};

const CACHE_FILE = path.resolve(process.cwd(), "uploads", "finance-cache.json");

const SEED_CATEGORIES: ExpenseCategoryDTO[] = [
  {
    id: "cat-pharmacy-supplies",
    entity: "RITHANYA_HOSPITAL",
    name: "Pharmacy & Clinical Supplies",
    description: "Wholesale pharmaceutical procurement, injectables, and daycare consumables.",
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    id: "cat-med-gases",
    entity: "RITHANYA_HOSPITAL",
    name: "Medical Gases & Oxygen",
    description: "Cylinder refills, manifold pipeline maintenance, and liquid oxygen tank logistics.",
    createdAt: new Date("2026-01-02").toISOString(),
  },
  {
    id: "cat-biomedical-waste",
    entity: "RITHANYA_HOSPITAL",
    name: "Biomedical Waste & Sterilization",
    description: "Authorized hazardous waste clearance and autoclave operations.",
    createdAt: new Date("2026-01-03").toISOString(),
  },
  {
    id: "cat-rvbc-kits",
    entity: "RVBC",
    name: "Blood Bag & Testing Reagent Kits",
    description: "Quadruple blood bags, NAT testing cartridges, and ELISA screening reagents.",
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    id: "cat-rvbc-camps",
    entity: "RVBC",
    name: "Voluntary Camp Logistics & Refreshments",
    description: "Transportation, donor donor badges, nutritional refreshments, and mobile donor couch sets.",
    createdAt: new Date("2026-01-02").toISOString(),
  },
  {
    id: "cat-payroll-rh",
    entity: "RITHANYA_HOSPITAL",
    name: "Payroll",
    description: "Monthly staff salaries, disbursements, and healthcare team compensation.",
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    id: "cat-payroll-rvbc",
    entity: "RVBC",
    name: "Payroll",
    description: "Blood bank personnel compensation and staff allowances.",
    createdAt: new Date("2026-01-01").toISOString(),
  },
];

const SEED_LEDGER: ExpenseLedgerDTO[] = [
  {
    id: "led-rh-001",
    entity: "RITHANYA_HOSPITAL",
    type: "DEBIT",
    itemName: "Desirox & Iron Chelation Injectables Batch",
    description: "Monthly allocation for scheduled thalassemia daycare patients.",
    categoryId: "cat-pharmacy-supplies",
    categoryName: "Pharmacy & Clinical Supplies",
    vendorPayee: "Cipla Med Distributors",
    amount: 48500,
    invoiceRef: "INV-CIP-2026-908",
    method: "NEFT",
    entryDate: new Date("2026-09-25").toISOString(),
    createdAt: new Date("2026-09-25").toISOString(),
  },
  {
    id: "led-rvbc-001",
    entity: "RVBC",
    type: "DEBIT",
    itemName: "Terumo Quadruple Blood Bag Consumables (100 units)",
    description: "Component separation blood bags for Khammam youth donor drive.",
    categoryId: "cat-rvbc-kits",
    categoryName: "Blood Bag & Testing Reagent Kits",
    vendorPayee: "Terumo Penpol Healthcare",
    amount: 32000,
    invoiceRef: "TP-2026-4412",
    method: "UPI",
    entryDate: new Date("2026-09-28").toISOString(),
    createdAt: new Date("2026-09-28").toISOString(),
  },
];

type FinanceStore = {
  categories: ExpenseCategoryDTO[];
  ledger: ExpenseLedgerDTO[];
};

let inMemoryFinance: FinanceStore = loadCache();
ensurePayrollCategoryExists();

function ensurePayrollCategoryExists(): void {
  for (const ent of ["RITHANYA_HOSPITAL", "RVBC"] as const) {
    const found = inMemoryFinance.categories.find(
      (c) => c.entity === ent && c.name.toLowerCase() === "payroll"
    );
    if (!found) {
      inMemoryFinance.categories.push({
        id: `cat-payroll-${ent.toLowerCase()}`,
        entity: ent,
        name: "Payroll",
        description: "Monthly staff salaries, disbursements, and healthcare team compensation.",
        createdAt: new Date("2026-01-01").toISOString(),
      });
    }
  }
}

export function pruneOldLedgerEntries(): void {
  const now = new Date();
  const currentTotalMonths = now.getFullYear() * 12 + (now.getMonth() + 1);
  const cutoffTotalMonths = currentTotalMonths - 12;

  const originalCount = inMemoryFinance.ledger.length;
  const prunedIds: string[] = [];

  inMemoryFinance.ledger = inMemoryFinance.ledger.filter((entry) => {
    const d = new Date(entry.entryDate);
    if (isNaN(d.getTime())) return true;
    const entryTotalMonths = d.getFullYear() * 12 + (d.getMonth() + 1);
    if (entryTotalMonths < cutoffTotalMonths) {
      prunedIds.push(entry.id);
      return false;
    }
    return true;
  });

  if (inMemoryFinance.ledger.length !== originalCount) {
    persistCache();
    console.log(`[finance] 12-Month retention pruned ${originalCount - inMemoryFinance.ledger.length} old ledger entries`);
    if (!isDbOnCooldown() && prunedIds.length > 0) {
      withDbTimeout(
        prisma.expenseLedger.deleteMany({
          where: { id: { in: prunedIds } },
        }),
        3000
      ).catch((err) => {
        reportDbError(err);
      });
    }
  }
}

function loadCache(): FinanceStore {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.ledger)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[finance] Could not read finance cache file:", err);
  }
  return {
    categories: [...SEED_CATEGORIES],
    ledger: [...SEED_LEDGER],
  };
}

function persistCache(): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(inMemoryFinance, null, 2), "utf-8");
  } catch (err) {
    console.warn("[finance] Could not persist finance cache file:", err);
  }
}

export async function loadExpenseCategories(entity: string): Promise<ExpenseCategoryDTO[]> {
  ensurePayrollCategoryExists();
  const targetEntity = entity === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";

  if (!isDbOnCooldown()) {
    try {
      const rows = await withDbTimeout(
        prisma.expenseCategory.findMany({
          where: { entity: targetEntity },
          orderBy: { name: "asc" },
        }),
        2000
      );

      const dbMapped: ExpenseCategoryDTO[] = rows.map((c) => ({
        id: c.id,
        entity: c.entity as ExpenseCategoryDTO["entity"],
        name: c.name,
        description: c.description,
        createdAt: c.createdAt.toISOString(),
      }));

      for (const row of dbMapped) {
        const idx = inMemoryFinance.categories.findIndex((x) => x.id === row.id);
        if (idx >= 0) inMemoryFinance.categories[idx] = row;
        else inMemoryFinance.categories.push(row);
      }
      persistCache();
      return inMemoryFinance.categories.filter((c) => c.entity === targetEntity).sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      reportDbError(err);
      console.warn("[finance] DB query failed, falling back to resilient in-memory categories:", (err as Error)?.message || err);
    }
  }

  return inMemoryFinance.categories.filter((c) => c.entity === targetEntity).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createExpenseCategoryRecord(data: {
  entity?: unknown;
  name: string;
  description?: string | null;
}): Promise<ExpenseCategoryDTO> {
  const entity = data.entity === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";
  const name = String(data.name ?? "").trim();
  if (!name) throw new Error("Category name is required");

  // Check unique name per entity
  const existing = inMemoryFinance.categories.find(
    (c) => c.entity === entity && c.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    const err = new Error("Category already exists");
    (err as any).status = 409;
    throw err;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const newCat: ExpenseCategoryDTO = {
    id,
    entity,
    name,
    description: data.description ? String(data.description).trim() : null,
    createdAt: now,
  };

  inMemoryFinance.categories.push(newCat);
  persistCache();

  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.expenseCategory.create({
        data: {
          id,
          entity,
          name: newCat.name,
          description: newCat.description,
        },
      }),
      2500
    ).catch((err) => {
      reportDbError(err);
      console.warn("[finance] Background DB sync for expense category failed:", err?.message || err);
    });
  }

  return newCat;
}

export async function updateExpenseCategoryRecord(
  id: string,
  data: { entity?: unknown; name?: string; description?: string | null }
): Promise<ExpenseCategoryDTO> {
  const cat = inMemoryFinance.categories.find((x) => x.id === id);
  if (!cat) throw new Error("Category not found");

  if (data.entity) cat.entity = data.entity === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";
  if (data.name !== undefined) cat.name = String(data.name).trim();
  if (data.description !== undefined) cat.description = data.description ? String(data.description).trim() : null;

  persistCache();

  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.expenseCategory.update({
        where: { id },
        data: {
          ...(data.entity ? { entity: cat.entity } : {}),
          ...(data.name !== undefined ? { name: cat.name } : {}),
          ...(data.description !== undefined ? { description: cat.description } : {}),
        },
      }),
      2500
    ).catch((err) => {
      reportDbError(err);
    });
  }

  return cat;
}

export async function deleteExpenseCategoryRecord(id: string): Promise<void> {
  const cat = inMemoryFinance.categories.find((x) => x.id === id);
  if (!cat) throw new Error("Category not found");
  if (cat.name.toLowerCase() === "payroll") {
    const err = new Error("The Payroll category is mandatory and cannot be deleted");
    (err as any).status = 400;
    throw err;
  }
  const idx = inMemoryFinance.categories.findIndex((x) => x.id === id);
  if (idx >= 0) inMemoryFinance.categories.splice(idx, 1);
  persistCache();

  if (!isDbOnCooldown()) {
    withDbTimeout(prisma.expenseCategory.delete({ where: { id } }), 2500).catch((err) => {
      reportDbError(err);
    });
  }
}

export async function deleteMonthLedgerEntries(
  entity: string,
  year: number,
  month: number
): Promise<{ count: number }> {
  const targetEntity = entity === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";
  const removedIds: string[] = [];

  inMemoryFinance.ledger = inMemoryFinance.ledger.filter((entry) => {
    if (entry.entity !== targetEntity) return true;
    const d = new Date(entry.entryDate);
    if (isNaN(d.getTime())) return true;
    const entryYear = d.getFullYear();
    const entryMonth = d.getMonth() + 1;
    if (entryYear === year && entryMonth === month) {
      removedIds.push(entry.id);
      return false;
    }
    return true;
  });

  persistCache();

  if (!isDbOnCooldown() && removedIds.length > 0) {
    try {
      await withDbTimeout(
        prisma.expenseLedger.deleteMany({
          where: { id: { in: removedIds } },
        }),
        3000
      );
    } catch (err) {
      reportDbError(err);
    }
  }

  return { count: removedIds.length };
}

export async function loadLedgerEntries(entity: string): Promise<ExpenseLedgerDTO[]> {
  pruneOldLedgerEntries();
  ensurePayrollCategoryExists();
  const targetEntity = entity === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";

  if (!isDbOnCooldown()) {
    try {
      const rows = await withDbTimeout(
        prisma.expenseLedger.findMany({
          where: { entity: targetEntity },
          orderBy: { entryDate: "desc" },
          take: 500,
          include: { category: true },
        }),
        2500
      );

      const dbMapped: ExpenseLedgerDTO[] = rows.map((e) => ({
        id: e.id,
        entity: e.entity as ExpenseLedgerDTO["entity"],
        type: e.type as ExpenseLedgerDTO["type"],
        itemName: e.itemName,
        description: e.description,
        categoryId: e.categoryId,
        categoryName: e.category?.name ?? null,
        vendorPayee: e.vendorPayee,
        amount: e.amount,
        invoiceRef: e.invoiceRef,
        method: e.method as ExpenseLedgerDTO["method"],
        entryDate: e.entryDate.toISOString(),
        createdAt: e.createdAt.toISOString(),
      }));

      for (const row of dbMapped) {
        const idx = inMemoryFinance.ledger.findIndex((x) => x.id === row.id);
        if (idx >= 0) inMemoryFinance.ledger[idx] = row;
        else inMemoryFinance.ledger.push(row);
      }
      persistCache();
      return inMemoryFinance.ledger
        .filter((l) => l.entity === targetEntity)
        .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
    } catch (err) {
      reportDbError(err);
      console.warn("[finance] DB query failed, falling back to resilient in-memory ledger:", (err as Error)?.message || err);
    }
  }

  // Ensure category names are updated from current category store
  const catMap = new Map(inMemoryFinance.categories.map((c) => [c.id, c.name]));
  return inMemoryFinance.ledger
    .filter((l) => l.entity === targetEntity)
    .map((l) => ({
      ...l,
      categoryName: l.categoryId ? catMap.get(l.categoryId) ?? l.categoryName : null,
    }))
    .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
}

export async function createLedgerEntryRecord(data: {
  entity?: unknown;
  type: unknown;
  itemName: string;
  description?: string | null;
  categoryId?: string | null;
  vendorPayee: string;
  amount: number;
  invoiceRef?: string | null;
  method: unknown;
  entryDate?: unknown;
}): Promise<ExpenseLedgerDTO> {
  const entity = data.entity === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const entryDate = data.entryDate ? new Date(data.entryDate as string).toISOString() : now;

  let catName: string | null = null;
  if (data.categoryId) {
    const cat = inMemoryFinance.categories.find((c) => c.id === data.categoryId);
    catName = cat?.name ?? null;
  }

  const newEntry: ExpenseLedgerDTO = {
    id,
    entity,
    type: data.type === "CREDIT" ? "CREDIT" : "DEBIT",
    itemName: data.itemName,
    description: data.description ? String(data.description).trim() : null,
    categoryId: data.categoryId || null,
    categoryName: catName,
    vendorPayee: data.vendorPayee,
    amount: data.amount,
    invoiceRef: data.invoiceRef ? String(data.invoiceRef).trim() : null,
    method: data.method as ExpenseLedgerDTO["method"],
    entryDate,
    createdAt: now,
  };

  inMemoryFinance.ledger.unshift(newEntry);
  persistCache();

  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.expenseLedger.create({
        data: {
          id,
          entity,
          type: newEntry.type,
          itemName: newEntry.itemName,
          description: newEntry.description,
          categoryId: newEntry.categoryId,
          vendorPayee: newEntry.vendorPayee,
          amount: newEntry.amount,
          invoiceRef: newEntry.invoiceRef,
          method: newEntry.method,
          entryDate: new Date(entryDate),
        },
      }),
      2500
    ).catch((err) => {
      reportDbError(err);
      console.warn("[finance] Background DB sync for ledger entry failed:", err?.message || err);
    });
  }

  return newEntry;
}

export async function updateLedgerEntryRecord(
  id: string,
  data: Partial<Omit<ExpenseLedgerDTO, "id" | "createdAt">>
): Promise<ExpenseLedgerDTO> {
  const entry = inMemoryFinance.ledger.find((x) => x.id === id);
  if (!entry) throw new Error("Ledger entry not found");

  if (data.entity) entry.entity = data.entity === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL";
  if (data.type) entry.type = data.type;
  if (data.itemName !== undefined) entry.itemName = data.itemName;
  if (data.description !== undefined) entry.description = data.description ? String(data.description).trim() : null;
  if (data.categoryId !== undefined) {
    entry.categoryId = data.categoryId || null;
    const cat = inMemoryFinance.categories.find((c) => c.id === data.categoryId);
    entry.categoryName = cat?.name ?? null;
  }
  if (data.vendorPayee !== undefined) entry.vendorPayee = data.vendorPayee;
  if (data.amount !== undefined) entry.amount = data.amount;
  if (data.invoiceRef !== undefined) entry.invoiceRef = data.invoiceRef ? String(data.invoiceRef).trim() : null;
  if (data.method) entry.method = data.method;
  if (data.entryDate) entry.entryDate = new Date(data.entryDate).toISOString();

  persistCache();

  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.expenseLedger.update({
        where: { id },
        data: {
          ...(data.entity ? { entity: entry.entity } : {}),
          ...(data.type ? { type: entry.type } : {}),
          ...(data.itemName !== undefined ? { itemName: entry.itemName } : {}),
          ...(data.description !== undefined ? { description: entry.description } : {}),
          ...(data.categoryId !== undefined ? { categoryId: entry.categoryId } : {}),
          ...(data.vendorPayee !== undefined ? { vendorPayee: entry.vendorPayee } : {}),
          ...(data.amount !== undefined ? { amount: entry.amount } : {}),
          ...(data.invoiceRef !== undefined ? { invoiceRef: entry.invoiceRef } : {}),
          ...(data.method ? { method: entry.method } : {}),
          ...(data.entryDate ? { entryDate: new Date(entry.entryDate) } : {}),
        },
      }),
      2500
    ).catch((err) => {
      reportDbError(err);
    });
  }

  return entry;
}

export async function deleteLedgerEntryRecord(id: string): Promise<void> {
  const idx = inMemoryFinance.ledger.findIndex((x) => x.id === id);
  if (idx >= 0) inMemoryFinance.ledger.splice(idx, 1);
  persistCache();

  if (!isDbOnCooldown()) {
    withDbTimeout(prisma.expenseLedger.delete({ where: { id } }), 2500).catch((err) => {
      reportDbError(err);
    });
  }
}
