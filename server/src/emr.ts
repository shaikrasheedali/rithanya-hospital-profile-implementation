import fs from "node:fs";
import path from "node:path";
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
import { encryptField, decryptField, encryptJson, decryptJson } from "./crypto.js";
import { enqueueOutbox, outboxHasPending, registerOutboxExecutor, wakeOutbox } from "./outbox.js";
import { isTimeSlotColumnReady, ensureColumns } from "./seed.js";

export type VitalDTO = {
  id: string;
  recordedAt: string;
  timeSlot?: "Morning" | "Afternoon" | "Evening" | "Night" | string;
  haemoglobin: number;
  spO2: number;
  pulse: number;
  fastingGlucose: number | null;
  postPrandialGlucose: number | null;
  hbA1c: number | null;
  bpSystolic: number;
  bpDiastolic: number;
  serumFerritin: number | null;
  clinicalNotes: string;
  recordedByStaff: string | null;
};

export type PatientDTO = {
  id: string;
  uhid: string;
  fullName: string;
  contactNumber: string;
  age: number;
  gender: "MALE" | "FEMALE" | "OTHER";
  bloodGroup: string;
  patientType: "INPATIENT" | "OUTPATIENT";
  clinicalCondition: string;
  allergies: string[];
  consentPhotoUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isDischarged: boolean;
  isArchived: boolean;
  createdAt: string;
  roomBedNumber: string | null;
  admissionDate: string | null;
  dischargeDate: string | null;
  dischargeNotes: string;
  vitals: VitalDTO[];
};

export type ClinicalCategoryDTO = {
  id: string;
  name: string;
  description: string;
  patientCount: number;
};

const CACHE_FILE = path.resolve(process.cwd(), "uploads", "patients-cache.json");
const CACHE_CATEGORIES_FILE = path.resolve(process.cwd(), "uploads", "categories-cache.json");

// Default initial clinical categories - start empty so only user-added categories exist
const INITIAL_CATEGORIES: ClinicalCategoryDTO[] = [];

// Initial seeded patients with rich longitudinal vitals
const INITIAL_PATIENTS: PatientDTO[] = [
  {
    id: "pat-lakshmi-devi",
    uhid: "RH-P24020",
    fullName: "Lakshmi Devi",
    contactNumber: "9848012345",
    age: 38,
    gender: "FEMALE",
    bloodGroup: "O+ve",
    patientType: "OUTPATIENT",
    clinicalCondition: "Thalassemia Minor & Chronic Microcytic Hypochromic Anemia with Secondary Iron Deficiency. Regular daycare transfusion review and hematology observation.",
    allergies: ["Sulfa drugs", "Penicillin"],
    consentPhotoUrl: null,
    categoryId: null,
    categoryName: null,
    isDischarged: false,
    isArchived: false,
    createdAt: new Date("2026-07-01T09:30:00.000Z").toISOString(),
    roomBedNumber: null,
    admissionDate: null,
    dischargeDate: null,
    dischargeNotes: "",
    vitals: [
      {
        id: "vit-lakshmi-1",
        recordedAt: new Date("2026-07-15T10:00:00.000Z").toISOString(),
        timeSlot: "Morning",
        haemoglobin: 8.6,
        spO2: 98,
        pulse: 80,
        fastingGlucose: 92,
        postPrandialGlucose: 134,
        hbA1c: 6.5,
        bpSystolic: 116,
        bpDiastolic: 76,
        serumFerritin: 1220,
        clinicalNotes: "[Slot: Morning] Baseline evaluation; scheduled for follow-up transfusion review.",
        recordedByStaff: "Dr. D. Narayana Murthy, M.D.",
      },
      {
        id: "vit-lakshmi-2",
        recordedAt: new Date("2026-08-14T10:30:00.000Z").toISOString(),
        timeSlot: "Morning",
        haemoglobin: 8.9,
        spO2: 98,
        pulse: 78,
        fastingGlucose: 96,
        postPrandialGlucose: 138,
        hbA1c: 6.6,
        bpSystolic: 118,
        bpDiastolic: 78,
        serumFerritin: 1290,
        clinicalNotes: "[Slot: Morning] Nutritional therapy well tolerated; reduced fatigue reported.",
        recordedByStaff: "Staff Nurse Swathi",
      },
      {
        id: "vit-lakshmi-3",
        recordedAt: new Date("2026-09-10T11:00:00.000Z").toISOString(),
        timeSlot: "Morning",
        haemoglobin: 9.1,
        spO2: 99,
        pulse: 75,
        fastingGlucose: 95,
        postPrandialGlucose: 140,
        hbA1c: 6.7,
        bpSystolic: 120,
        bpDiastolic: 80,
        serumFerritin: 1340,
        clinicalNotes: "[Slot: Morning] Stable trajectory; appetite and energy levels improved.",
        recordedByStaff: "Dr. A. Lakshmi Deepa",
      },
      {
        id: "vit-lakshmi-4",
        recordedAt: new Date("2026-10-02T10:00:00.000Z").toISOString(),
        timeSlot: "Morning",
        haemoglobin: 9.2,
        spO2: 99,
        pulse: 76,
        fastingGlucose: 98,
        postPrandialGlucose: 142,
        hbA1c: 6.8,
        bpSystolic: 120,
        bpDiastolic: 80,
        serumFerritin: 1380,
        clinicalNotes: "[Slot: Morning] Optimal stable outpatient daycare checkup; advised regular iron chelation monitoring.",
        recordedByStaff: "Dr. D. Narayana Murthy, M.D.",
      },
    ],
  },
  {
    id: "pat-rajesh-rao",
    uhid: "RH-2026-0001",
    fullName: "K. Rajesh Rao",
    contactNumber: "9848098765",
    age: 54,
    gender: "MALE",
    bloodGroup: "B+ve",
    patientType: "INPATIENT",
    clinicalCondition: "Type 2 Diabetes Mellitus with Severe Hyperglycaemia & Microvascular Complications. Continuous insulin infusion and hemodynamic monitoring.",
    allergies: ["Aspirin", "NSAIDs"],
    consentPhotoUrl: null,
    categoryId: null,
    categoryName: null,
    isDischarged: false,
    isArchived: false,
    createdAt: new Date("2026-09-30T07:30:00.000Z").toISOString(),
    roomBedNumber: "ICU Bed 03",
    admissionDate: new Date("2026-09-30T07:30:00.000Z").toISOString(),
    dischargeDate: null,
    dischargeNotes: "",
    vitals: [
      {
        id: "vit-rajesh-1",
        recordedAt: new Date("2026-09-30T08:00:00.000Z").toISOString(),
        timeSlot: "Morning",
        haemoglobin: 13.8,
        spO2: 97,
        pulse: 88,
        fastingGlucose: 186,
        postPrandialGlucose: 245,
        hbA1c: 9.4,
        bpSystolic: 142,
        bpDiastolic: 90,
        serumFerritin: 210,
        clinicalNotes: "[Slot: Morning] Admitted with high blood sugar spike.",
        recordedByStaff: "Dr. D. Narayana Murthy, M.D.",
      },
      {
        id: "vit-rajesh-2",
        recordedAt: new Date("2026-10-01T08:00:00.000Z").toISOString(),
        timeSlot: "Morning",
        haemoglobin: 13.7,
        spO2: 98,
        pulse: 82,
        fastingGlucose: 142,
        postPrandialGlucose: 190,
        hbA1c: 9.2,
        bpSystolic: 130,
        bpDiastolic: 84,
        serumFerritin: 205,
        clinicalNotes: "[Slot: Morning] Glycemic control improving on sliding scale.",
        recordedByStaff: "Staff Nurse Rajesh",
      },
      {
        id: "vit-rajesh-3",
        recordedAt: new Date("2026-10-02T08:00:00.000Z").toISOString(),
        timeSlot: "Morning",
        haemoglobin: 13.6,
        spO2: 99,
        pulse: 78,
        fastingGlucose: 118,
        postPrandialGlucose: 156,
        hbA1c: 8.9,
        bpSystolic: 124,
        bpDiastolic: 80,
        serumFerritin: 198,
        clinicalNotes: "[Slot: Morning] Responding well to therapy. Hemodynamically stable.",
        recordedByStaff: "Dr. D. Narayana Murthy, M.D.",
      },
    ],
  },
  {
    id: "pat-venkata-subbaiah",
    uhid: "RH-2025-0892",
    fullName: "P. Venkata Subbaiah",
    contactNumber: "9848055443",
    age: 68,
    gender: "MALE",
    bloodGroup: "A+ve",
    patientType: "INPATIENT",
    clinicalCondition: "Total Hip Replacement post-operative rehabilitation.",
    allergies: ["Iodine contrast"],
    consentPhotoUrl: null,
    categoryId: null,
    categoryName: null,
    isDischarged: true,
    isArchived: false,
    createdAt: new Date("2026-09-20T10:00:00.000Z").toISOString(),
    roomBedNumber: "Ward 104",
    admissionDate: new Date("2026-09-20T10:00:00.000Z").toISOString(),
    dischargeDate: new Date("2026-09-28T14:00:00.000Z").toISOString(),
    dischargeNotes: "Recovered with independent mobility. Advised outpatient physiotherapy twice weekly.",
    vitals: [
      {
        id: "vit-venkata-1",
        recordedAt: new Date("2026-09-28T09:00:00.000Z").toISOString(),
        timeSlot: "Morning",
        haemoglobin: 12.1,
        spO2: 99,
        pulse: 74,
        fastingGlucose: 94,
        postPrandialGlucose: 132,
        hbA1c: 5.6,
        bpSystolic: 122,
        bpDiastolic: 78,
        serumFerritin: 180,
        clinicalNotes: "[Slot: Morning] Discharge vitals confirmed optimal.",
        recordedByStaff: "Dr. D. Narayana Murthy, M.D.",
      },
    ],
  },
];

let inMemoryPatients: PatientDTO[] = loadCache();
let inMemoryCategories: ClinicalCategoryDTO[] = loadCategoriesCache();

function loadCache(): PatientDTO[] {
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
        const dec = decryptJson<PatientDTO[]>(raw, null as unknown as PatientDTO[]);
        parsed = Array.isArray(dec) ? dec : null;
      }
      if (Array.isArray(parsed) && (parsed as PatientDTO[]).length > 0) {
        return parsed as PatientDTO[];
      }
    }
  } catch (err) {
    console.warn("[emr] Could not read patients cache file, using seed defaults:", err);
  }
  return [...INITIAL_PATIENTS];
}

function loadCategoriesCache(): ClinicalCategoryDTO[] {
  try {
    if (fs.existsSync(CACHE_CATEGORIES_FILE)) {
      const raw = fs.readFileSync(CACHE_CATEGORIES_FILE, "utf-8");
      // New format: encrypted payload. Legacy: plaintext JSON array.
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      if (!Array.isArray(parsed)) {
        const dec = decryptJson<ClinicalCategoryDTO[]>(raw, null as unknown as ClinicalCategoryDTO[]);
        parsed = Array.isArray(dec) ? dec : null;
      }
      if (Array.isArray(parsed)) {
        return parsed as ClinicalCategoryDTO[];
      }
    }
  } catch (err) {
    console.warn("[emr] Could not read categories cache file:", err);
  }
  return [...INITIAL_CATEGORIES];
}

function persistCache(): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Patient records are PHI — the offline cache must stay encrypted at rest.
    fs.writeFileSync(CACHE_FILE, encryptJson(inMemoryPatients), "utf-8");
  } catch (err) {
    console.warn("[emr] Could not persist patients cache file:", err);
  }
}

function persistCategoriesCache(): void {
  try {
    const dir = path.dirname(CACHE_CATEGORIES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_CATEGORIES_FILE, encryptJson(inMemoryCategories), "utf-8");
  } catch (err) {
    console.warn("[emr] Could not persist categories cache file:", err);
  }
}

/** Awaited EMR persistence helper: DB first, durable outbox on failure. */
async function persistEmrWrite(
  op: {
    module: "emr";
    action: "patient.create" | "patient.update" | "patient.discharge" | "patient.archive" | "patient.delete" | "vitals.create" | "category.create" | "category.update" | "category.delete";
    key: string;
    payload: unknown;
  },
  run: () => Promise<unknown>,
): Promise<void> {
  if (outboxHasPending("emr") || isDbOnCooldown()) {
    enqueueOutbox(op);
    return;
  }
  try {
    await withDbTimeout(run(), DB_WRITE_MS);
    reportDbSuccess();
    wakeOutbox();
  } catch (err) {
    if (isTransientDbError(err)) reportDbError(err);
    console.warn(`[emr] DB write failed (${op.action}) — queued for durable retry:`, (err as Error)?.message || err);
    enqueueOutbox(op);
  }
}

export function getInMemoryPatients(): PatientDTO[] {
  return inMemoryPatients;
}

/**
 * Drops patients (matched by id or UHID) from the in-memory cache and the
 * encrypted on-disk cache. Used by DPDP erasure — without this the erased
 * records keep being served from memory after the DB rows are deleted.
 */
export function prunePatientsFromMemory(ids: string[]): void {
  const wanted = new Set(ids);
  let changed = false;
  for (let i = inMemoryPatients.length - 1; i >= 0; i--) {
    const p = inMemoryPatients[i];
    if (wanted.has(p.id) || wanted.has(p.uhid)) {
      inMemoryPatients.splice(i, 1);
      changed = true;
    }
  }
  if (changed) persistCache();
}

export async function loadPatients(opts: {
  type?: "INPATIENT" | "OUTPATIENT";
  discharged: boolean;
  archived?: boolean;
}): Promise<PatientDTO[]> {
  if (!isDbOnCooldown()) {
    try {
      const rows = await withDbTimeout(
        prisma.patient.findMany({
          where: {
            isDischarged: opts.discharged,
            isArchived: opts.archived ?? false,
            ...(opts.type ? { patientType: opts.type } : {}),
          },
          include: { category: true, stays: { orderBy: { admissionDate: "desc" } }, vitals: { orderBy: { recordedAt: "asc" } } },
          orderBy: { createdAt: "desc" },
        }),
        DB_READ_MS
      );

      const dbMapped = rows.map((p) => {
        const s = p.stays[0];
        return {
          id: p.id,
          uhid: p.uhid,
          fullName: decryptField(p.fullName),
          contactNumber: decryptField(p.contactNumber),
          age: p.age,
          gender: p.gender as PatientDTO["gender"],
          bloodGroup: p.bloodGroup,
          patientType: p.patientType as PatientDTO["patientType"],
          clinicalCondition: decryptField(p.clinicalCondition),
          allergies: decryptJson<string[]>(p.allergies, []),
          consentPhotoUrl: p.consentPhotoUrl,
          categoryId: p.categoryId,
          categoryName: p.category?.name ?? null,
          isDischarged: p.isDischarged,
          isArchived: p.isArchived,
          createdAt: p.createdAt.toISOString(),
          roomBedNumber: s?.roomBedNumber ?? null,
          admissionDate: s?.admissionDate.toISOString() ?? null,
          dischargeDate: s?.dischargeDate?.toISOString() ?? null,
          dischargeNotes: decryptField(s?.dischargeNotes),
          vitals: p.vitals.map((v) => ({
            id: v.id,
            recordedAt: v.recordedAt.toISOString(),
            timeSlot: (v as { timeSlot?: string | null }).timeSlot ?? undefined,
            haemoglobin: v.haemoglobin,
            spO2: v.spO2,
            pulse: v.pulse,
            fastingGlucose: v.fastingGlucose,
            postPrandialGlucose: v.postPrandialGlucose,
            hbA1c: v.hbA1c,
            bpSystolic: v.bpSystolic,
            bpDiastolic: v.bpDiastolic,
            serumFerritin: v.serumFerritin,
            clinicalNotes: decryptField(v.clinicalNotes),
            recordedByStaff: v.recordedByStaff,
          })),
        };
      });

      // Merge newly fetched DB rows into in-memory store so memory stays updated
      for (const row of dbMapped) {
        const idx = inMemoryPatients.findIndex((x) => x.id === row.id || x.uhid === row.uhid);
        if (idx >= 0) {
          inMemoryPatients[idx] = row;
        } else {
          inMemoryPatients.push(row);
        }
      }
      persistCache();
      return dbMapped;
    } catch (err) {
      if (isTransientDbError(err)) reportDbError(err);
      console.warn("[emr] DB query failed, falling back to resilient in-memory store:", (err as Error)?.message || err);
    }
  }

  // Fallback to in-memory store
  return inMemoryPatients
    .filter((p) => {
      if (opts.discharged !== p.isDischarged) return false;
      if (Boolean(opts.archived) !== Boolean(p.isArchived)) return false;
      if (opts.type && p.patientType !== opts.type) return false;
      return true;
    })
    .map((p) => {
      const cat = inMemoryCategories.find((c) => c.id === p.categoryId);
      return {
        ...p,
        categoryId: cat ? cat.id : null,
        categoryName: cat ? cat.name : null,
      };
    });
}

export async function getPatientById(id: string): Promise<PatientDTO | null> {
  const fromMem = inMemoryPatients.find((p) => p.id === id || p.uhid === id);
  if (!isDbOnCooldown()) {
    try {
      const p = await withDbTimeout(
        prisma.patient.findFirst({
          where: { OR: [{ id }, { uhid: id }] },
          include: { category: true, stays: { orderBy: { admissionDate: "desc" } }, vitals: { orderBy: { recordedAt: "asc" } } },
        }),
        DB_READ_MS
      );
      if (p) {
        const s = p.stays[0];
        const mapped: PatientDTO = {
          id: p.id,
          uhid: p.uhid,
          fullName: decryptField(p.fullName),
          contactNumber: decryptField(p.contactNumber),
          age: p.age,
          gender: p.gender as PatientDTO["gender"],
          bloodGroup: p.bloodGroup,
          patientType: p.patientType as PatientDTO["patientType"],
          clinicalCondition: decryptField(p.clinicalCondition),
          allergies: decryptJson<string[]>(p.allergies, []),
          consentPhotoUrl: p.consentPhotoUrl,
          categoryId: p.categoryId,
          categoryName: p.category?.name ?? null,
          isDischarged: p.isDischarged,
          isArchived: p.isArchived,
          createdAt: p.createdAt.toISOString(),
          roomBedNumber: s?.roomBedNumber ?? null,
          admissionDate: s?.admissionDate.toISOString() ?? null,
          dischargeDate: s?.dischargeDate?.toISOString() ?? null,
          dischargeNotes: decryptField(s?.dischargeNotes),
          vitals: p.vitals.map((v) => ({
            id: v.id,
            recordedAt: v.recordedAt.toISOString(),
            timeSlot: (v as { timeSlot?: string | null }).timeSlot ?? undefined,
            haemoglobin: v.haemoglobin,
            spO2: v.spO2,
            pulse: v.pulse,
            fastingGlucose: v.fastingGlucose,
            postPrandialGlucose: v.postPrandialGlucose,
            hbA1c: v.hbA1c,
            bpSystolic: v.bpSystolic,
            bpDiastolic: v.bpDiastolic,
            serumFerritin: v.serumFerritin,
            clinicalNotes: decryptField(v.clinicalNotes),
            recordedByStaff: v.recordedByStaff,
          })),
        };
        const idx = inMemoryPatients.findIndex((x) => x.id === mapped.id);
        if (idx >= 0) inMemoryPatients[idx] = mapped;
        else inMemoryPatients.push(mapped);
        persistCache();
        return mapped;
      }
      // The database answered and holds no such patient — an authoritative
      // miss (e.g. a DPDP-erased record). Drop any stale in-memory copy and
      // never fall back to memory in this case.
      const staleIdx = inMemoryPatients.findIndex((x) => x.id === id || x.uhid === id);
      if (staleIdx >= 0) {
        inMemoryPatients.splice(staleIdx, 1);
        persistCache();
      }
      reportDbSuccess();
      return null;
    } catch (err) {
      if (isTransientDbError(err)) reportDbError(err);
    }
  }
  if (fromMem) {
    const cat = inMemoryCategories.find((c) => c.id === fromMem.categoryId);
    return {
      ...fromMem,
      categoryId: cat ? cat.id : null,
      categoryName: cat ? cat.name : null,
    };
  }
  return null;
}

export async function createPatientRecord(data: {
  patientType: "INPATIENT" | "OUTPATIENT";
  fullName: string;
  contactNumber: string;
  age: number;
  gender: "MALE" | "FEMALE" | "OTHER";
  bloodGroup: string;
  clinicalCondition?: string;
  allergies?: string[];
  consentPhotoUrl?: string | null;
  categoryId?: string | null;
  roomBedNumber?: string | null;
}): Promise<{ id: string; uhid: string }> {
  const id = `pat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  // UHID must be unique forever: derive the next sequence from the highest
  // existing UHID in memory (which mirrors DB truth after successful loads),
  // then loop in case of a memory collision.
  const year = new Date().getFullYear();
  let nextSeq = inMemoryPatients.reduce((acc, p) => {
    const m = new RegExp(`^RH-${year}-(\\d{4})$`).exec(p.uhid ?? "");
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  let uhid = `RH-${year}-${String(nextSeq + 1).padStart(4, "0")}`;
  while (inMemoryPatients.some((p) => p.uhid === uhid)) {
    nextSeq += 1;
    uhid = `RH-${year}-${String(nextSeq + 1).padStart(4, "0")}`;
  }

  const cat = inMemoryCategories.find((c) => c.id === data.categoryId);
  const newPatient: PatientDTO = {
    id,
    uhid,
    fullName: data.fullName,
    contactNumber: data.contactNumber,
    age: data.age,
    gender: data.gender,
    bloodGroup: data.bloodGroup,
    patientType: data.patientType,
    clinicalCondition: data.clinicalCondition ?? "",
    allergies: data.allergies ?? [],
    consentPhotoUrl: data.consentPhotoUrl ?? null,
    categoryId: data.categoryId ?? null,
    categoryName: cat?.name ?? null,
    isDischarged: false,
    isArchived: false,
    createdAt: new Date().toISOString(),
    roomBedNumber: data.roomBedNumber ?? null,
    admissionDate: data.patientType === "INPATIENT" ? new Date().toISOString() : null,
    dischargeDate: null,
    dischargeNotes: "",
    vitals: [],
  };

  inMemoryPatients.unshift(newPatient);
  persistCache();

  // Awaited DB write with encrypted PHI; on failure the full row (still
  // encrypted) is queued in the durable outbox and replayed automatically.
  const op = {
    module: "emr" as const,
    action: "patient.create" as const,
    key: `patient:${id}`,
    payload: {
      id,
      uhid,
      fullName: encryptField(newPatient.fullName),
      contactNumber: encryptField(newPatient.contactNumber),
      age: newPatient.age,
      gender: newPatient.gender,
      bloodGroup: newPatient.bloodGroup,
      patientType: newPatient.patientType,
      clinicalCondition: encryptField(newPatient.clinicalCondition),
      allergies: encryptJson(newPatient.allergies),
      consentPhotoUrl: newPatient.consentPhotoUrl,
      categoryId: newPatient.categoryId,
      roomBedNumber: data.roomBedNumber ?? null,
      inpatientStay: Boolean(data.roomBedNumber && data.patientType === "INPATIENT"),
    },
  };
  await persistEmrWrite(op, () => applyPatientCreate(op.payload as never));

  return { id, uhid };
}

/** Patient creation transaction shared by live writes and outbox replay. */
async function applyPatientCreate(p: {
  id: string;
  uhid: string;
  fullName: string;
  contactNumber: string;
  age: number;
  gender: string;
  bloodGroup: string;
  patientType: string;
  clinicalCondition: string;
  allergies: string;
  consentPhotoUrl: string | null;
  categoryId: string | null;
  roomBedNumber: string | null;
  inpatientStay: boolean;
}): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.patient.create({
        data: {
          id: p.id,
          uhid: p.uhid,
          fullName: p.fullName,
          contactNumber: p.contactNumber,
          age: p.age,
          gender: p.gender as never,
          bloodGroup: p.bloodGroup,
          patientType: p.patientType as never,
          clinicalCondition: p.clinicalCondition,
          allergies: p.allergies,
          consentPhotoUrl: p.consentPhotoUrl,
          categoryId: p.categoryId,
        },
      });
      if (p.inpatientStay) {
        await tx.inpatientStay.create({
          data: {
            patientId: created.id,
            roomBedNumber: p.roomBedNumber ?? "",
          },
        });
      }
    });
    return;
  } catch (err: any) {
    if (err?.code === "P2002") {
      // Unique collision (an earlier partial insert or UHID raced on another
      // process): if the row exists under our id, update it; otherwise file a
      // fresh UHID derived from DB truth and retry once.
      try {
        const data: Record<string, unknown> = {
          uhid: p.uhid,
          fullName: p.fullName,
          contactNumber: p.contactNumber,
          age: p.age,
          gender: p.gender,
          bloodGroup: p.bloodGroup,
          patientType: p.patientType,
          clinicalCondition: p.clinicalCondition,
          allergies: p.allergies,
          consentPhotoUrl: p.consentPhotoUrl,
          categoryId: p.categoryId,
        };
        await prisma.patient.update({ where: { id: p.id }, data: data as never });
        return;
      } catch (updateErr: any) {
        if (updateErr?.code === "P2025") {
          const year = new Date().getFullYear();
          const rows = await prisma.patient.findMany({
            where: { uhid: { startsWith: `RH-${year}-` } },
            select: { uhid: true },
          });
          let max = 0;
          for (const r of rows) {
            const m = /-(\d{4})$/.exec(r.uhid);
            if (m) max = Math.max(max, Number(m[1]));
          }
          const freshUhid = `RH-${year}-${String(max + 1).padStart(4, "0")}`;
          await prisma.patient.create({
            data: {
              id: p.id,
              uhid: freshUhid,
              fullName: p.fullName,
              contactNumber: p.contactNumber,
              age: p.age,
              gender: p.gender as never,
              bloodGroup: p.bloodGroup,
              patientType: p.patientType as never,
              clinicalCondition: p.clinicalCondition,
              allergies: p.allergies,
              consentPhotoUrl: p.consentPhotoUrl,
              categoryId: p.categoryId,
            },
          });
          return;
        }
        throw updateErr;
      }
    }
    throw err;
  }
}

export async function updatePatientRecord(
  id: string,
  data: Partial<{
    fullName: string;
    contactNumber: string;
    age: number;
    gender: "MALE" | "FEMALE" | "OTHER";
    bloodGroup: string;
    clinicalCondition: string;
    allergies: string[];
    consentPhotoUrl: string | null;
    categoryId: string | null;
    roomBedNumber: string | null;
  }>
): Promise<{ ok: boolean }> {
  const p = inMemoryPatients.find((x) => x.id === id || x.uhid === id);
  if (!p) throw new Error("Patient not found");

  if (data.fullName !== undefined) p.fullName = data.fullName;
  if (data.contactNumber !== undefined) p.contactNumber = data.contactNumber;
  if (data.age !== undefined) p.age = data.age;
  if (data.gender !== undefined) p.gender = data.gender;
  if (data.bloodGroup !== undefined) p.bloodGroup = data.bloodGroup;
  if (data.clinicalCondition !== undefined) p.clinicalCondition = data.clinicalCondition;
  if (data.allergies !== undefined) p.allergies = data.allergies;
  if (data.consentPhotoUrl !== undefined) p.consentPhotoUrl = data.consentPhotoUrl;
  if (data.categoryId !== undefined) {
    p.categoryId = data.categoryId;
    const cat = inMemoryCategories.find((c) => c.id === data.categoryId);
    p.categoryName = cat?.name ?? null;
  }
  if (data.roomBedNumber !== undefined) p.roomBedNumber = data.roomBedNumber;

  persistCache();

  if (!isDbOnCooldown()) {
    const set: Record<string, unknown> = {};
    if (data.fullName !== undefined) set.fullName = encryptField(data.fullName);
    if (data.contactNumber !== undefined) set.contactNumber = encryptField(data.contactNumber);
    if (data.age !== undefined) set.age = data.age;
    if (data.gender !== undefined) set.gender = data.gender;
    if (data.bloodGroup !== undefined) set.bloodGroup = data.bloodGroup;
    if (data.clinicalCondition !== undefined) set.clinicalCondition = encryptField(data.clinicalCondition);
    if (data.allergies !== undefined) set.allergies = encryptJson(data.allergies);
    if (data.categoryId !== undefined) set.categoryId = data.categoryId;
    if (data.consentPhotoUrl !== undefined) set.consentPhotoUrl = data.consentPhotoUrl;

    const op = {
      module: "emr" as const,
      action: "patient.update" as const,
      key: `patient:${p.id}`,
      payload: {
        id: p.id,
        set,
        roomBedNumber: data.roomBedNumber !== undefined ? data.roomBedNumber : undefined,
      },
    };
    await persistEmrWrite(op, () => applyPatientUpdate(op.payload as never));
  }

  return { ok: true };
}

async function applyPatientUpdate(p: {
  id: string;
  set: Record<string, unknown>;
  roomBedNumber?: string | null;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (Object.keys(p.set).length) {
      await tx.patient.update({ where: { id: p.id }, data: p.set as never });
    }
    if (p.roomBedNumber) {
      await tx.inpatientStay.updateMany({
        where: { patientId: p.id, status: "ADMITTED" },
        data: { roomBedNumber: p.roomBedNumber },
      });
    }
  });
}

export async function addVitalLog(
  patientId: string,
  data: {
    recordedAt?: string | Date;
    timeSlot?: string;
    haemoglobin: number;
    spO2: number;
    pulse: number;
    fastingGlucose?: number | null;
    postPrandialGlucose?: number | null;
    hbA1c?: number | null;
    bpSystolic: number;
    bpDiastolic: number;
    serumFerritin?: number | null;
    clinicalNotes?: string;
    recordedByStaff?: string;
  }
): Promise<{ ok: boolean; id: string }> {
  const p = inMemoryPatients.find((x) => x.id === patientId || x.uhid === patientId);
  if (!p) throw new Error("Patient not found");

  const vitalId = `vit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const recordedAtStr = data.recordedAt ? new Date(data.recordedAt).toISOString() : new Date().toISOString();

  let notes = data.clinicalNotes ?? "";
  if (data.timeSlot && !notes.includes(`[Slot: ${data.timeSlot}]`)) {
    notes = `[Slot: ${data.timeSlot}] ${notes}`.trim();
  }

  const vital: VitalDTO = {
    id: vitalId,
    recordedAt: recordedAtStr,
    timeSlot: data.timeSlot ?? "Morning",
    haemoglobin: data.haemoglobin,
    spO2: data.spO2,
    pulse: data.pulse,
    fastingGlucose: data.fastingGlucose ?? null,
    postPrandialGlucose: data.postPrandialGlucose ?? null,
    hbA1c: data.hbA1c ?? null,
    bpSystolic: data.bpSystolic,
    bpDiastolic: data.bpDiastolic,
    serumFerritin: data.serumFerritin ?? null,
    clinicalNotes: notes,
    recordedByStaff: data.recordedByStaff ?? "Clinical Staff",
  };

  p.vitals.push(vital);
  persistCache();

  if (!isTimeSlotColumnReady()) {
    // The time_slot column ships via boot ALTER; retry the ensure once if the
    // flag has not been set yet so vitals persist their day-part slot.
    await ensureColumns();
  }

  const op = {
    module: "emr" as const,
    action: "vitals.create" as const,
    key: `vitals:${vitalId}`,
    payload: {
      id: vitalId,
      patientId: p.id,
      recordedAt: recordedAtStr,
      timeSlot: isTimeSlotColumnReady() ? (data.timeSlot ?? "Morning") : undefined,
      haemoglobin: data.haemoglobin,
      spO2: data.spO2,
      pulse: data.pulse,
      fastingGlucose: data.fastingGlucose ?? null,
      postPrandialGlucose: data.postPrandialGlucose ?? null,
      hbA1c: data.hbA1c ?? null,
      bpSystolic: data.bpSystolic,
      bpDiastolic: data.bpDiastolic,
      serumFerritin: data.serumFerritin ?? null,
      clinicalNotes: notes ? encryptField(notes) : null,
      recordedByStaff: data.recordedByStaff ?? "Staff",
    },
  };
  await persistEmrWrite(op, () => applyVitalCreate(op.payload as never));

  return { ok: true, id: vitalId };
}

async function applyVitalCreate(p: {
  id: string;
  patientId: string;
  recordedAt: string;
  timeSlot?: string;
  haemoglobin: number;
  spO2: number;
  pulse: number;
  fastingGlucose: number | null;
  postPrandialGlucose: number | null;
  hbA1c: number | null;
  bpSystolic: number;
  bpDiastolic: number;
  serumFerritin: number | null;
  clinicalNotes: string | null;
  recordedByStaff: string;
}): Promise<void> {
  await prisma.vitalLog.create({
    data: {
      id: p.id,
      patientId: p.patientId,
      recordedAt: new Date(p.recordedAt),
      ...(p.timeSlot ? { timeSlot: p.timeSlot } : {}),
      haemoglobin: p.haemoglobin,
      spO2: p.spO2,
      pulse: p.pulse,
      fastingGlucose: p.fastingGlucose,
      postPrandialGlucose: p.postPrandialGlucose,
      hbA1c: p.hbA1c,
      bpSystolic: p.bpSystolic,
      bpDiastolic: p.bpDiastolic,
      serumFerritin: p.serumFerritin,
      clinicalNotes: p.clinicalNotes,
      recordedByStaff: p.recordedByStaff,
    },
  });
}

export async function dischargePatientRecord(id: string, notes?: string): Promise<{ ok: boolean }> {
  const p = inMemoryPatients.find((x) => x.id === id || x.uhid === id);
  if (!p) throw new Error("Patient not found");

  p.isDischarged = true;
  p.dischargeDate = new Date().toISOString();
  p.dischargeNotes = notes ?? "";
  persistCache();

  const op = {
    module: "emr" as const,
    action: "patient.discharge" as const,
    key: `patient-discharge:${p.id}`,
    payload: { id: p.id, notes: notes ? encryptField(notes) : null },
  };
  await persistEmrWrite(op, () => applyPatientDischarge(op.payload as never));

  return { ok: true };
}

async function applyPatientDischarge(p: { id: string; notes: string | null }): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.patient.update({ where: { id: p.id }, data: { isDischarged: true } });
    await tx.inpatientStay.updateMany({
      where: { patientId: p.id, status: "ADMITTED" },
      data: {
        status: "DISCHARGED",
        dischargeDate: new Date(),
        dischargeNotes: p.notes,
      },
    });
  });
}

export async function archivePatientRecord(id: string, isArchived: boolean): Promise<{ ok: boolean }> {
  const p = inMemoryPatients.find((x) => x.id === id || x.uhid === id);
  if (!p) throw new Error("Patient not found");

  p.isArchived = isArchived;
  persistCache();

  await persistEmrWrite(
    { module: "emr", action: "patient.archive", key: `patient-archive:${p.id}`, payload: { id: p.id, isArchived } },
    () => prisma.patient.update({ where: { id: p.id }, data: { isArchived } }),
  );

  return { ok: true };
}

export async function deletePatientRecord(id: string): Promise<{ ok: boolean }> {
  // Resolve the true patient id first (callers may pass a UHID) so every
  // cascade target — vitals, stays, audit trail — is purged, not just the row.
  const p = inMemoryPatients.find((x) => x.id === id || x.uhid === id);
  const resolvedId = p?.id ?? id;
  const idx = inMemoryPatients.findIndex((x) => x.id === resolvedId || x.uhid === id);
  if (idx >= 0) {
    inMemoryPatients.splice(idx, 1);
  }
  persistCache();

  await persistEmrWrite(
    { module: "emr", action: "patient.delete", key: `patient-delete:${resolvedId}`, payload: { id: resolvedId } },
    () => applyPatientDelete(resolvedId),
  );

  return { ok: true };
}

async function applyPatientDelete(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.vitalLog.deleteMany({ where: { patientId: id } });
    await tx.inpatientStay.deleteMany({ where: { patientId: id } });
    await tx.patient.deleteMany({ where: { id } });
  });
}

export async function loadCategories(): Promise<ClinicalCategoryDTO[]> {
  if (!isDbOnCooldown()) {
    try {
      const rows = await withDbTimeout(prisma.clinicalCategory.findMany({ orderBy: { name: "asc" } }), DB_READ_MS);
      const counts = await withDbTimeout(prisma.patient.groupBy({ by: ["categoryId"], _count: { categoryId: true } }), DB_READ_MS);
      const map = new Map<string, number>();
      for (const c of counts) if (c.categoryId) map.set(c.categoryId, c._count.categoryId);
      const mapped = rows.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? "",
        patientCount: map.get(c.id) ?? 0,
      }));
      inMemoryCategories = mapped;
      persistCategoriesCache();
      reportDbSuccess();
      return mapped;
    } catch (err) {
      if (isTransientDbError(err)) reportDbError(err);
    }
  }

  // Recalculate patient counts from in-memory cache
  const countsMap = new Map<string, number>();
  for (const p of inMemoryPatients) {
    if (p.categoryId) countsMap.set(p.categoryId, (countsMap.get(p.categoryId) ?? 0) + 1);
  }
  return inMemoryCategories.map((c) => ({
    ...c,
    patientCount: countsMap.get(c.id) ?? c.patientCount ?? 0,
  }));
}

export async function createClinicalCategory(data: { name: string; description?: string | null }): Promise<ClinicalCategoryDTO> {
  const name = data.name.trim();
  const existing = inMemoryCategories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    const err = new Error("A category with this name already exists");
    (err as any).status = 409;
    throw err;
  }

  const id = `cat-${crypto.randomUUID()}`;
  const newCat: ClinicalCategoryDTO = {
    id,
    name,
    description: data.description ? data.description.trim() : "",
    patientCount: 0,
  };

  inMemoryCategories.push(newCat);
  persistCategoriesCache();

  await persistEmrWrite(
    {
      module: "emr",
      action: "category.create",
      key: `category:${id}`,
      payload: { id, name: newCat.name, description: newCat.description || null },
    },
    () => prisma.clinicalCategory.create({ data: { id, name: newCat.name, description: newCat.description || null } }),
  );

  return newCat;
}

export async function updateClinicalCategory(id: string, data: { name: string; description?: string | null }): Promise<ClinicalCategoryDTO> {
  const cat = inMemoryCategories.find((c) => c.id === id);
  if (!cat) throw new Error("Category not found");

  const name = data.name.trim();
  const duplicate = inMemoryCategories.find((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    const err = new Error("A category with this name already exists");
    (err as any).status = 409;
    throw err;
  }

  cat.name = name;
  if (data.description !== undefined) cat.description = data.description ? data.description.trim() : "";
  persistCategoriesCache();

  await persistEmrWrite(
    {
      module: "emr",
      action: "category.update",
      key: `category:${id}`,
      payload: { id, name: cat.name, description: cat.description || null },
    },
    () => prisma.clinicalCategory.update({ where: { id }, data: { name: cat.name, description: cat.description || null } }),
  );

  return cat;
}

export async function deleteClinicalCategory(id: string): Promise<void> {
  const idx = inMemoryCategories.findIndex((c) => c.id === id);
  if (idx >= 0) inMemoryCategories.splice(idx, 1);
  persistCategoriesCache();

  await persistEmrWrite(
    { module: "emr", action: "category.delete", key: `category-delete:${id}`, payload: { id } },
    () => prisma.clinicalCategory.delete({ where: { id } }),
  );
}

// ---------------------------------------------------------------------------
// Durable outbox replay for EMR (patients, vitals, categories)
// ---------------------------------------------------------------------------
registerOutboxExecutor("emr", async (op) => {
  switch (op.action) {
    case "patient.create":
      await applyPatientCreate(op.payload as never);
      return;
    case "patient.update":
      await applyPatientUpdate(op.payload as never);
      return;
    case "patient.discharge":
      await applyPatientDischarge(op.payload as never);
      return;
    case "patient.archive": {
      const p = op.payload as { id: string; isArchived: boolean };
      await withDbTimeout(prisma.patient.update({ where: { id: p.id }, data: { isArchived: p.isArchived } }), DB_WRITE_MS);
      return;
    }
    case "patient.delete": {
      const p = op.payload as { id: string };
      await applyPatientDelete(p.id);
      return;
    }
    case "vitals.create": {
      const p = op.payload as { timeSlot?: string };
      if (p.timeSlot && !isTimeSlotColumnReady()) {
        await ensureColumns();
      }
      await applyVitalCreate(op.payload as never);
      return;
    }
    case "category.create": {
      const p = op.payload as { id: string; name: string; description: string | null };
      await prisma.clinicalCategory.create({ data: { id: p.id, name: p.name, description: p.description } });
      return;
    }
    case "category.update": {
      const p = op.payload as { id: string; name: string; description: string | null };
      await prisma.clinicalCategory.update({ where: { id: p.id }, data: { name: p.name, description: p.description } });
      return;
    }
    /** category.delete replay: deleteMany is idempotent when the row is gone. */
    case "category.delete": {
      const p = op.payload as { id: string };
      await prisma.clinicalCategory.deleteMany({ where: { id: p.id } });
      return;
    }
  }
});

