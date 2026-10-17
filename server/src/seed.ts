import fs from "node:fs/promises";
import path from "node:path";
import {
  prisma,
  isDbOnCooldown,
  reportDbError,
  reportDbSuccess,
  withDbTimeout,
  DB_WRITE_MS,
  isTransientDbError,
} from "./db.js";
import { hashPassword, computeModules } from "./auth.js";
import { ensureTables } from "./schemaBootstrap.js";
import { setEntityMedia, registerAssetInMemory, type EntityType } from "./media.js";
import { DEFAULT_SETTINGS } from "./settings.js";
import { SEED_EMPLOYEES } from "./employees.js";
import { SEED_CATEGORIES, SEED_LEDGER } from "./finance.js";
import { SEED_RECORDS } from "./payrollStore.js";
import {
  FALLBACK_SPECIALTIES,
  FALLBACK_SERVICES,
  FALLBACK_TREATMENTS,
  FALLBACK_FACILITIES,
  FALLBACK_DOCTORS,
  FALLBACK_INSURANCE,
  FALLBACK_GALLERY,
  FALLBACK_TESTIMONIALS,
  FALLBACK_BLOGS,
  FALLBACK_PRODUCTS,
} from "./fallbackData.js";

// ---------------------------------------------------------------------------
// Boot-time column safety net.
// The production DB ships without a migrations folder, so a couple of additive
// columns are ensured with idempotent ALTERs at boot. Failures are non-fatal:
// features degrade gracefully (see emr.ts) and the ALTER retries next boot.
// ---------------------------------------------------------------------------
const gSchema = globalThis as typeof globalThis & { __rhSchemaReady?: Map<string, boolean> };
gSchema.__rhSchemaReady ??= new Map<string, boolean>();
const schemaReady = gSchema.__rhSchemaReady!;

export function isTimeSlotColumnReady(): boolean {
  return schemaReady.get("vital_logs.time_slot") === true;
}

export async function ensureColumns(): Promise<void> {
  if (isDbOnCooldown()) return;
  // Provision any missing tables first (managed MySQL on the hosting platform
  // starts empty; this repo ships no migration files), then apply the
  // additive column safety nets below to real tables.
  await ensureTables();
  if (isDbOnCooldown()) return;
  // VitalLog.timeSlot — persisted morning/afternoon/evening/night slot.
  await ensureColumn("vital_logs", "time_slot", "ALTER TABLE vital_logs ADD COLUMN time_slot VARCHAR(16) NULL");
  // Additions from later releases, for databases provisioned by an earlier
  // deploy: every statement is a no-op on fresh/current schemas (duplicate
  // column is treated as success).
  await ensureColumn("patients", "is_archived", "ALTER TABLE patients ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("orders", "is_paid", "ALTER TABLE orders ADD COLUMN is_paid TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn(
    "employees",
    "entity",
    "ALTER TABLE employees ADD COLUMN entity VARCHAR(191) NOT NULL DEFAULT 'RITHANYA_HOSPITAL'",
  );
  await ensureColumn(
    "payroll_records",
    "authorizer_sign_svg",
    "ALTER TABLE payroll_records ADD COLUMN authorizer_sign_svg MEDIUMTEXT NULL",
  );
  await ensureColumn("media_assets", "kind", "ALTER TABLE media_assets ADD COLUMN kind VARCHAR(191) NOT NULL DEFAULT 'IMAGE'");
}

async function ensureColumn(table: string, column: string, sql: string): Promise<void> {
  const cacheKey = `${table}.${column}`;
  if (schemaReady.get(cacheKey) === true) return;
  try {
    await withDbTimeout(prisma.$executeRawUnsafe(sql), DB_WRITE_MS);
    reportDbSuccess();
    schemaReady.set(cacheKey, true);
    console.log(`[seed] Schema ensured: ${table}.${column}`);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (/duplicate column|already exists|-1060/i.test(msg)) {
      schemaReady.set(cacheKey, true);
      return;
    }
    if (isTransientDbError(err)) reportDbError(err);
    console.warn(`[seed] Could not ensure ${cacheKey} (will retry next boot): ${msg.slice(0, 120)}`);
  }
}

// ---------------------------------------------------------------------------
// Seed media: every real asset shipped in public/seed becomes a MediaAsset row
// keyed `seed-<file>`. Entries reference the physical files, so the public site
// resolves them through /seed/<file> with no placeholder generation.
// ---------------------------------------------------------------------------
const FALLBACK_FILE_NAMES: Array<[string, "IMAGE" | "VIDEO"]> = [
  ...[
    "hospital-corridor", "hospital-wheelchair", "doctor-consult", "doctor-exam", "doctor-vitals", "doctor-sitting",
    "blood-donation", "blood-bag", "blood-beds", "glucose-finger", "glucose-strips", "glucose-meter", "lab-microscope",
    "lab-woman", "lab-notes", "pharmacy-shelves", "pharmacy-bottle", "pharmacy-counter", "nurse-injection", "nurse-bp",
    "nurse-care", "ward-exam", "logo-pmjay", "logo-aarogyasri", "logo-tpa",
    "rithanya-hospital-khammam-building-exterior-signboard",
    "rithanya-hospital-khammam-main-entrance-reception",
    "rithanya-hospital-khammam-outpatient-waiting-area-registration",
    "rithanya-hospital-khammam-doctor-consulting-patient",
    "rithanya-hospital-khammam-doctor-in-consultation-room",
    "rithanya-hospital-khammam-surgeon-reviewing-xray-reports",
    "rithanya-hospital-khammam-child-gifted-plant-with-doctor",
    "rithanya-hospital-khammam-childrens-day-celebration-group-photo",
    "rithanya-hospital-khammam-health-camp-registration-desk",
    "rithanya-hospital-khammam-eenadu-newspaper-clipping-2023",
    "rithanya-hospital-khammam-surya-newspaper-clipping-2024",
    "rithanya-hospital-khammam-hrudaya-spandana-seva-stage-group-photo",
    "rithanya-hospital-khammam-eye-camp-award-ceremony",
    "rithanya-hospital-khammam-health-camp-stage-audience",
    "rithanya-hospital-khammam-speaker-at-dais-floral-backdrop",
  ].map((n) => [`${n}.webp`, "IMAGE"] as [string, "IMAGE"]),
  ["clip-iv-drip.mp4", "VIDEO"],
];

const SEED_EXTENSIONS = new Set([".webp", ".jpg", ".jpeg", ".png", ".mp4", ".webm", ".mov", ".ogv"]);

async function seedMedia(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  const localSeed = path.join(process.cwd(), "public", "seed");

  const entries = new Map<string, "IMAGE" | "VIDEO">();
  try {
    const diskFiles = await fs.readdir(localSeed);
    for (const f of diskFiles) {
      const ext = path.extname(f).toLowerCase();
      if (!SEED_EXTENSIONS.has(ext)) continue;
      entries.set(f, ext === ".mp4" || ext === ".webm" || ext === ".mov" || ext === ".ogv" ? "VIDEO" : "IMAGE");
    }
  } catch {
    console.warn("[seed] Seed asset folder not found; skipping media asset seeding.");
  }
  // Guarantee the referenced fallback names exist even if the dir scan failed.
  for (const [file, kind] of FALLBACK_FILE_NAMES) {
    if (!entries.has(file)) {
      try {
        await fs.access(path.join(localSeed, file));
        entries.set(file, kind);
      } catch {
        // not shipped — skip silently, no placeholder generation
      }
    }
  }

  for (const [file, kind] of entries) {
    let size = 0;
    try {
      size = (await fs.stat(path.join(localSeed, file))).size;
    } catch {
      continue;
    }
    const filename = `seed-${file}`;
    const url = `/seed/${file}`;
    try {
      const row = await withDbTimeout(
        prisma.mediaAsset.upsert({
          where: { filename },
          create: {
            filename,
            originalName: file,
            mimeType: kind === "VIDEO" ? "video/mp4" : "image/webp",
            kind,
            sizeInBytes: size,
            url,
          },
          update: { sizeInBytes: size },
        }),
        DB_WRITE_MS,
      );
      registerAssetInMemory(row as any);
      ids[file.replace(/\.(webp|mp4|jpe?g|png|webm|mov|ogv)$/i, "")] = row.id;
    } catch (err) {
      if (isTransientDbError(err)) reportDbError(err);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Collection content seeding
// ---------------------------------------------------------------------------
type CollectionSeedDef = {
  model: string;
  rows: any[];
  /** field used to identify a row across DB recreations (slug/name/title/patientName) */
  matchKey: string;
  mediaField?: string;
};

const COLLECTION_SEEDS: Array<[string, CollectionSeedDef]> = [
  ["specialties", { model: "specialty", rows: FALLBACK_SPECIALTIES, matchKey: "slug", mediaField: "media" }],
  ["facilities", { model: "facility", rows: FALLBACK_FACILITIES, matchKey: "slug", mediaField: "media" }],
  ["treatments", { model: "treatment", rows: FALLBACK_TREATMENTS, matchKey: "slug", mediaField: "media" }],
  ["services", { model: "service", rows: FALLBACK_SERVICES, matchKey: "slug", mediaField: "media" }],
  ["doctors", { model: "doctor", rows: FALLBACK_DOCTORS, matchKey: "slug", mediaField: "media" }],
  ["insurance", { model: "insuranceProvider", rows: FALLBACK_INSURANCE, matchKey: "name", mediaField: "media" }],
  ["gallery", { model: "galleryItem", rows: FALLBACK_GALLERY, matchKey: "title", mediaField: "media" }],
  ["testimonials", { model: "testimonial", rows: FALLBACK_TESTIMONIALS, matchKey: "patientName", mediaField: "media" }],
  ["blogs", { model: "blogPost", rows: FALLBACK_BLOGS, matchKey: "slug", mediaField: "media" }],
  ["products", { model: "product", rows: FALLBACK_PRODUCTS, matchKey: "slug", mediaField: "media" }],
];

function mediaIdsFor(mediaList: Array<{ originalName: string; kind?: string }>, mediaMap: Record<string, string>): string[] {
  return (mediaList || [])
    .map((x) => mediaMap[String(x.originalName ?? "").replace(/\.(webp|mp4|jpe?g|png|webm|mov|ogv)$/i, "")])
    .filter(Boolean) as string[];
}

/**
 * Seed a CMS collection:
 *  - EMPTY table  → insert every bundled item with its canonical fallback id,
 *                   then link its seeded media. This is the first-install path.
 *  - NON-EMPTY table → only heal legacy duplicate rows that share the same
 *    identity key (an artefact of the old dual id-space seeding): keep the
 *    canonical id when present, otherwise the oldest row; delete the rest.
 *    No content is ever re-inserted, so admin-created/edited/deleted data
 *    survives every restart.
 */
async function seedCollection(entityKey: string, def: CollectionSeedDef, mediaMap: Record<string, string>): Promise<void> {
  const delegate = (prisma as unknown as Record<string, any>)[def.model];
  if (!delegate) return;

  const count = await withDbTimeout(delegate.count(), DB_WRITE_MS);
  if (Number(count) === 0) {
    for (const item of def.rows) {
      const columns: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(item) as Array<[string, unknown]>) {
        if (k === "media" || k === "id") continue;
        columns[k] = v;
      }
      try {
        const inserted = await withDbTimeout(
          delegate.create({ data: { id: item.id, ...columns } }),
          DB_WRITE_MS,
        );
        const ids = mediaIdsFor(item[def.mediaField ?? "media"] ?? [], mediaMap);
        if (ids.length) await setEntityMedia(entityKey as EntityType, (inserted as { id: string }).id, ids);
      } catch (err) {
        if (isTransientDbError(err)) reportDbError(err);
        else console.warn(`[seed] ${entityKey}:${item.id} insert skipped:`, (err as Error)?.message);
      }
    }
    return;
  }

  // Non-empty: heal duplicate identity rows (legacy cuid twins).
  try {
    // Order by id: every seed-managed model has a String id, while optional
    // columns such as createdAt only exist on some models (blogPost has none).
    const rows = (await withDbTimeout(
      delegate.findMany({ orderBy: { id: "asc" } }),
      DB_WRITE_MS,
    )) as Array<Record<string, any>>;
    const groups = new Map<string, Array<Record<string, any>>>();
    const canonicalIds = new Set(def.rows.map((r) => String(r.id)));
    for (const r of rows) {
      const k = String(r[def.matchKey] ?? "").trim().toLowerCase();
      if (!k) continue;
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
    }
    let removed = 0;
    for (const [, group] of groups) {
      if (group.length <= 1) continue;
      const keeper = group.find((r) => canonicalIds.has(String(r.id))) ?? group[0];
      const doomed = group.filter((r) => r.id !== keeper.id).map((r) => String(r.id));
      if (!doomed.length) continue;
      await withDbTimeout(delegate.deleteMany({ where: { id: { in: doomed } } }), DB_WRITE_MS);
      removed += doomed.length;
      // Heal keeper media if it has no links (twin may have owned them).
      const linkCount = await withDbTimeout(
        prisma.mediaLink.count({ where: { entityId: String(keeper.id) } }),
        DB_WRITE_MS,
      );
      if (Number(linkCount) === 0) {
        const item = def.rows.find((r) => String(r[def.matchKey]).trim().toLowerCase() === String(keeper[def.matchKey]).trim().toLowerCase());
        const ids = item ? mediaIdsFor(item[def.mediaField ?? "media"] ?? [], mediaMap) : [];
        if (ids.length) await setEntityMedia(entityKey as EntityType, String(keeper.id), ids);
      }
    }
    if (removed > 0) console.log(`[seed] ${entityKey}: removed ${removed} duplicate row(s) born from the legacy dual-id seed.`);
  } catch (err) {
    if (isTransientDbError(err)) reportDbError(err);
    else console.warn(`[seed] ${entityKey}: reconciliation skipped:`, (err as Error)?.message);
  }
}

/**
 * Base operational data (settings, blood stock). Create-if-missing only:
 * admin edits are never overwritten at boot, and the legacy phantom blood
 * groups (bare "O"/"A"/"B"/"AB") are removed in favour of the 8 canonical ones.
 */
export async function ensureBaseData(): Promise<void> {
  if (isDbOnCooldown()) return;
  try {
    await withDbTimeout(
      prisma.hospitalSetting.upsert({
        where: { id: "PRIMARY_CONFIG" },
        create: { ...DEFAULT_SETTINGS, socialShareThumbnailUrl: "/seed/hospital-corridor.webp" },
        update: {},
      }),
      DB_WRITE_MS,
    );

    const canonicalGroups: Array<[string, [number, number, number, string, string]]> = [
      ["O+", [14, 12, 9, "O", "SKY_BLUE"]],
      ["A+", [11, 9, 7, "A", "YELLOW"]],
      ["B+", [9, 8, 6, "B", "RED"]],
      ["AB+", [4, 4, 3, "AB", "WHITE"]],
      ["O-", [8, 6, 5, "O", "SKY_BLUE"]],
      ["A-", [6, 5, 4, "A", "YELLOW"]],
      ["B-", [5, 4, 3, "B", "RED"]],
      ["AB-", [2, 2, 2, "AB", "WHITE"]],
    ];
    for (const [group, [wb, pc, pl, cat, color]] of canonicalGroups) {
      // Only create when missing — never overwrite admin stock edits.
      const exists = await withDbTimeout(keyExistsBlood(group), DB_WRITE_MS);
      if (exists) continue;
      try {
        await withDbTimeout(
          prisma.bloodStock.create({
            data: {
              bloodGroup: group,
              groupCategory: cat,
              colorCode: color,
              wholeBloodUnits: wb,
              packedCellsUnits: pc,
              plasmaUnits: pl,
            },
          }),
          DB_WRITE_MS,
        );
      } catch (err: any) {
        if (err?.code === "P2002") continue; // created concurrently
        throw err;
      }
    }
    // Remove legacy phantom rows created by the old dual-seed (bare groups).
    const legacy = ["O", "A", "B", "AB"];
    await withDbTimeout(prisma.bloodStock.deleteMany({ where: { bloodGroup: { in: legacy } } }), DB_WRITE_MS);
    reportDbSuccess();
  } catch (err) {
    if (isTransientDbError(err)) reportDbError(err);
    console.warn("[seed] Database offline, skipping DB base data seed:", (err as Error)?.message || err);
  }
}

async function keyExistsBlood(group: string): Promise<boolean> {
  const row = await prisma.bloodStock.findUnique({ where: { bloodGroup: group }, select: { id: true } });
  return Boolean(row);
}

/**
 * One-time first-install seeding. Admin usernames and all collection content
 * are only CREATED when missing — credentials, roles, module permissions and
 * content are never force-updated on boot, so admin changes are permanent.
 */
export async function ensureSeed(): Promise<void> {
  if (isDbOnCooldown()) {
    console.log("[seed] Database is offline or on cooldown, using in-memory resilient collections.");
    return;
  }
  try {
    await ensureColumns();
    await ensureBaseData();
    if (isDbOnCooldown()) return;

    console.log("[seed] Verifying seed accounts and content collections…");
    const m = await seedMedia();
    if (isDbOnCooldown()) return;

    // 1. Admin accounts — create if missing, never reset existing credentials.
    const accounts: Array<[string, string, string, "SUPERADMIN" | "ADMIN" | "STAFF", string]> = [
      ["superadmin", "mgrhameed@gmail.com", "Hospital Superadmin", "SUPERADMIN", "Hameed@2026"],
      ["admin", "admin@rithanyahospital.com", "Administration Desk", "ADMIN", "Rithanya@2026"],
    ];
    for (const [username, email, fullName, role, pw] of accounts) {
      try {
        const existing = await withDbTimeout(
          prisma.user.findFirst({ where: { OR: [{ username }, { email }] } }),
          DB_WRITE_MS,
        );
        if (!existing) {
          const passwordHash = await hashPassword(pw);
          const u = await withDbTimeout(
            prisma.user.create({ data: { username, email, fullName, role, passwordHash } }),
            DB_WRITE_MS,
          );
          const mods = computeModules(role);
          await withDbTimeout(
            prisma.userModuleAccess.upsert({
              where: { userId: u.id },
              create: {
                userId: u.id,
                canManageEMR: mods.emr,
                canManageBloodBank: mods.bloodbank,
                canManageCMS: mods.cms,
                canManageStore: mods.store,
                canManageHR: mods.hr,
                canManageFinance: mods.finance,
                canManageDPDP: mods.dpdp,
                canManageSettings: mods.settings,
              },
              update: {},
            }),
            DB_WRITE_MS,
          );
          console.log(`[seed] Created account: ${username}`);
        }
      } catch (err) {
        if (isTransientDbError(err)) reportDbError(err);
        console.warn(`[seed] Account ${username} seed skipped:`, (err as Error)?.message || err);
      }
    }

    // 2. CMS collections (specialties, facilities, treatments, services, doctors,
    //    insurance, gallery, testimonials, blogs, products)
    for (const [key, def] of COLLECTION_SEEDS) {
      await seedCollection(key, def, m);
      if (isDbOnCooldown()) return;
    }

    // 3. Clinical categories
    const clinicalCatCount = await withDbTimeout(prisma.clinicalCategory.count(), DB_WRITE_MS);
    if (Number(clinicalCatCount) === 0) {
      const cats = [
        "Thalassemia Major",
        "Sickle Cell Disease",
        "Type 1 Diabetes",
        "Type 2 Diabetes",
        "Gestational Diabetes",
        "Viral Fever / Infectious",
        "Hypertension",
        "General Medicine",
      ];
      for (const c of cats) {
        try {
          await withDbTimeout(prisma.clinicalCategory.create({ data: { name: c } }), DB_WRITE_MS);
        } catch (err) {
          if (isTransientDbError(err)) reportDbError(err);
        }
      }
    }

    // 4. Employees (fixed ids matching the HR store)
    const employeeCount = await withDbTimeout(prisma.employee.count(), DB_WRITE_MS);
    if (Number(employeeCount) === 0) {
      try {
        await withDbTimeout(
          prisma.employee.createMany({
            data: SEED_EMPLOYEES.map((e) => ({
              id: e.id,
              entity: e.entity,
              fullName: e.fullName,
              designation: e.designation,
              department: e.department,
              shiftSchedule: e.shiftSchedule,
              contactNumber: e.contactNumber,
              monthlyFixedBaseSalary: e.monthlyFixedBaseSalary,
              isActive: e.isActive,
            })),
          }),
          DB_WRITE_MS,
        );
      } catch (err) {
        if (isTransientDbError(err)) reportDbError(err);
        console.warn("[seed] Employees seed skipped:", (err as Error)?.message || err);
      }
    }

    // 5. Expense categories (fixed ids matching the finance store)
    const expenseCatCount = await withDbTimeout(prisma.expenseCategory.count(), DB_WRITE_MS);
    if (Number(expenseCatCount) === 0) {
      try {
        await withDbTimeout(
          prisma.expenseCategory.createMany({
            data: SEED_CATEGORIES.map((c) => ({
              id: c.id,
              entity: c.entity,
              name: c.name,
              description: c.description,
            })),
          }),
          DB_WRITE_MS,
        );
      } catch (err) {
        if (isTransientDbError(err)) reportDbError(err);
        console.warn("[seed] Expense categories seed skipped:", (err as Error)?.message || err);
      }
    }

    // 6. Sample ledger rows (fixed ids)
    const ledgerCount = await withDbTimeout(prisma.expenseLedger.count(), DB_WRITE_MS);
    if (Number(ledgerCount) === 0) {
      for (const l of SEED_LEDGER) {
        try {
          await withDbTimeout(
            prisma.expenseLedger.create({
              data: {
                id: l.id,
                entity: l.entity,
                type: l.type,
                itemName: l.itemName,
                description: l.description,
                categoryId: l.categoryId,
                vendorPayee: l.vendorPayee,
                amount: l.amount,
                invoiceRef: l.invoiceRef,
                method: l.method,
                entryDate: new Date(l.entryDate),
              },
            }),
            DB_WRITE_MS,
          );
        } catch (err) {
          if (isTransientDbError(err)) reportDbError(err);
        }
      }
    }

    // 7. Sample payroll records (fixed ids, matching seeded employees)
    const payrollCount = await withDbTimeout(prisma.payrollRecord.count(), DB_WRITE_MS);
    if (Number(payrollCount) === 0) {
      for (const r of SEED_RECORDS) {
        try {
          await withDbTimeout(
            prisma.payrollRecord.create({
              data: {
                id: r.id,
                employeeId: r.employeeId,
                month: r.month,
                year: r.year,
                baseSalary: r.baseSalary,
                calendarDays: r.calendarDays,
                lopDays: r.lopDays,
                paidDays: r.paidDays,
                lopDeduction: r.lopDeduction,
                allowances: r.allowances,
                otherDeductions: r.otherDeductions,
                netPayable: r.netPayable,
                authorizerName: r.authorizerName,
                signedAt: new Date(r.signedAt as string),
              },
            }),
            DB_WRITE_MS,
          );
        } catch (err) {
          if (isTransientDbError(err)) reportDbError(err);
        }
      }
    }

    reportDbSuccess();
  } catch (err) {
    if (isTransientDbError(err)) reportDbError(err);
    console.warn(
      "[seed] Notice: Seed aborted due to DB connection issue, using resilient offline caches:",
      (err as Error)?.message || err,
    );
  }

  console.log("[seed] Done.");
}
