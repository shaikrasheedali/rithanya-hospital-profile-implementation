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
