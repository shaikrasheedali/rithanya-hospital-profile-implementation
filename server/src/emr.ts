import { prisma } from "./db.js";
import { decryptField, decryptJson } from "./crypto.js";

export type VitalDTO = {
  id: string;
  recordedAt: string;
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

export async function loadPatients(opts: {
  type?: "INPATIENT" | "OUTPATIENT";
  discharged: boolean;
  archived?: boolean;
}): Promise<PatientDTO[]> {
  const rows = await prisma.patient.findMany({
    where: {
      isDischarged: opts.discharged,
      isArchived: opts.archived ?? false,
      ...(opts.type ? { patientType: opts.type } : {}),
    },
    include: { category: true, stays: { orderBy: { admissionDate: "desc" } }, vitals: { orderBy: { recordedAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((p) => {
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
}

export async function loadCategories() {
  const rows = await prisma.clinicalCategory.findMany({ orderBy: { name: "asc" } });
  const counts = await prisma.patient.groupBy({ by: ["categoryId"], _count: { categoryId: true } });
  const map = new Map<string, number>();
  for (const c of counts) if (c.categoryId) map.set(c.categoryId, c._count.categoryId);
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? "",
    patientCount: map.get(c.id) ?? 0,
  }));
}
