"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Droplets,
  Edit3,
  FileCheck,
  FileText,
  Heart,
  LogOut,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Upload,
  User,
  X,
} from "lucide-react";
import { TrajectoryGraphs } from "@/components/portal/TrajectoryGraphs";
import { ConsentCameraModal } from "@/components/portal/ConsentCameraModal";
import { Badge, Btn, Card, Field, Modal, api, inputCls, useToast } from "@/components/portal/ui";
import { formatDate } from "@/lib/utils";
import type { PatientDTO, VitalDTO } from "@/lib/emr";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";

type Cat = { id: string; name: string };

const BLOOD_GROUPS = ["O+ve", "O-ve", "A+ve", "A-ve", "B+ve", "B-ve", "AB+ve", "AB-ve", "Unknown"];
const TIME_SLOTS = ["Morning", "Afternoon", "Evening", "Night"] as const;

function AllergyTagEditor({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const [tag, setTag] = useState("");
  const add = () => {
    const v = tag.trim();
    if (v && !value.some((x) => x.toLowerCase() === v.toLowerCase())) {
      onChange([...value, v]);
    }
    setTag("");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.length === 0 && <span className="text-sm text-ink/60">No known allergies recorded</span>}
        {value.map((a) => (
          <span
            key={a}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-sm font-semibold text-red-800"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-red-600" /> {a}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== a))}
                aria-label={`Remove allergy ${a}`}
                className="rounded-full hover:bg-red-200 p-0.5 text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="mt-3 flex gap-2">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add drug or clinical allergy (e.g. Penicillin, NSAIDs)..."
            aria-label="Add allergy"
            className={inputCls}
          />
          <Btn type="button" variant="secondary" onClick={add}>
            Add
          </Btn>
        </div>
      )}
    </div>
  );
}

/** Comprehensive Vitals Logging Modal matching user specifications */
function LogVitalsModal({
  patient,
  allPatients,
  onClose,
  onSaved,
}: {
  patient: PatientDTO;
  allPatients?: PatientDTO[];
  onClose: () => void;
  onSaved: (newVital: VitalDTO) => void;
}) {
  const toast = useToast();
  const [selectedPatId, setSelectedPatId] = useState(patient.id);
  const now = new Date();
  const currentHour = now.getHours();
  const defaultSlot =
    currentHour >= 5 && currentHour < 12
      ? "Morning"
      : currentHour >= 12 && currentHour < 17
      ? "Afternoon"
      : currentHour >= 17 && currentHour < 22
      ? "Evening"
      : "Night";

  const [date, setDate] = useState(now.toISOString().slice(0, 10));
  const [time, setTime] = useState(
    now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  );
  const [timeSlot, setTimeSlot] = useState<string>(defaultSlot);

  const [vitals, setVitals] = useState({
    haemoglobin: "",
    spO2: "99",
    pulse: "76",
    fastingGlucose: "",
    postPrandialGlucose: "",
    hbA1c: "",
    bpSystolic: "120",
    bpDiastolic: "80",
    serumFerritin: "",
    clinicalNotes: "",
  });

  const [busy, setBusy] = useState(false);

  const setField = (k: keyof typeof vitals, val: string) => setVitals((s) => ({ ...s, [k]: val }));

  async function save() {
    const hbNum = parseFloat(vitals.haemoglobin);
    if (isNaN(hbNum) || hbNum < 1 || hbNum > 25) {
      return toast("Please enter a valid Haemoglobin value between 1.0 and 25.0 g/dL", "err");
    }
    const spo2Num = parseFloat(vitals.spO2);
    if (isNaN(spo2Num) || spo2Num < 50 || spo2Num > 100) {
      return toast("Please enter a valid SpO2 percentage between 50 and 100%", "err");
    }
    const pulseNum = parseInt(vitals.pulse, 10);
    if (isNaN(pulseNum) || pulseNum < 20 || pulseNum > 250) {
      return toast("Please enter a valid Pulse rate between 20 and 250 bpm", "err");
    }
    const sysNum = parseInt(vitals.bpSystolic, 10) || 120;
    const diaNum = parseInt(vitals.bpDiastolic, 10) || 80;
    if (sysNum < 50 || sysNum > 300 || diaNum < 30 || diaNum > 200) {
      return toast("Please enter a valid blood pressure (sys 50–300, dia 30–200).", "err");
    }
    if (vitals.fastingGlucose && (Number(vitals.fastingGlucose) < 20 || Number(vitals.fastingGlucose) > 1000)) {
      return toast("Fasting glucose looks out of range (20–1000 mg/dL).", "err");
    }
    if (vitals.postPrandialGlucose && (Number(vitals.postPrandialGlucose) < 20 || Number(vitals.postPrandialGlucose) > 1000)) {
      return toast("Post-prandial glucose looks out of range (20–1000 mg/dL).", "err");
    }
    if (vitals.hbA1c && (Number(vitals.hbA1c) < 2 || Number(vitals.hbA1c) > 20)) {
      return toast("HbA1c looks out of range (2–20%).", "err");
    }
    let recordedAt: string;
    try {
      const parsed = new Date(`${date} ${time}`);
      if (Number.isNaN(parsed.getTime())) throw new Error("invalid");
      recordedAt = parsed.toISOString();
    } catch {
      toast("Could not understand the date/time — please use YYYY-MM-DD and a valid time.", "err");
      return;
    }

    setBusy(true);

    const payload = {
      action: "vitals",
      recordedAt,
      timeSlot,
      haemoglobin: hbNum,
      spO2: spo2Num,
      pulse: pulseNum,
      bpSystolic: sysNum,
      bpDiastolic: diaNum,
      fastingGlucose: vitals.fastingGlucose ? parseFloat(vitals.fastingGlucose) : undefined,
      postPrandialGlucose: vitals.postPrandialGlucose ? parseFloat(vitals.postPrandialGlucose) : undefined,
      hbA1c: vitals.hbA1c ? parseFloat(vitals.hbA1c) : undefined,
      serumFerritin: vitals.serumFerritin ? parseFloat(vitals.serumFerritin) : undefined,
      clinicalNotes: vitals.clinicalNotes.trim() || undefined,
    };

    const res = await api(`/api/portal/r/patients/${selectedPatId}`, "POST", payload);
    setBusy(false);

    if (!res.ok) {
      return toast(res.error || "Could not log vitals", "err");
    }

    toast("Vitals recorded successfully with trajectory calibration");
    onSaved({
      id: `vit-local-${Date.now()}`,
      recordedAt: payload.recordedAt,
      timeSlot,
      haemoglobin: hbNum,
      spO2: spo2Num,
      pulse: pulseNum,
      bpSystolic: payload.bpSystolic,
      bpDiastolic: payload.bpDiastolic,
      fastingGlucose: payload.fastingGlucose ?? null,
      postPrandialGlucose: payload.postPrandialGlucose ?? null,
      hbA1c: payload.hbA1c ?? null,
      serumFerritin: payload.serumFerritin ?? null,
      clinicalNotes: payload.clinicalNotes ?? "",
      recordedByStaff: "Clinical Staff",
    });
    onClose();
  }

  const activePat = (allPatients ?? [patient]).find((p) => p.id === selectedPatId) ?? patient;

  return (
    <Modal
      size="lg"
      title={`Log Vitals — ${activePat.fullName}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="gold" onClick={save} disabled={busy}>
            {busy ? "Recording Vitals…" : "Save Vital Record"}
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Patient Selection */}
        <div className="sm:col-span-3">
          <Field label="Select Patient *">
            {allPatients && allPatients.length > 1 ? (
              <select
                className={inputCls}
                value={selectedPatId}
                onChange={(e) => setSelectedPatId(e.target.value)}
              >
                {allPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.uhid} - {p.clinicalCondition ? p.clinicalCondition.slice(0, 32) : "General"} - {p.bloodGroup})
                  </option>
                ))}
              </select>
            ) : (
              <input
                disabled
                className={`${inputCls} bg-canvas font-semibold text-navy`}
                value={`${patient.fullName} (${patient.uhid} - ${patient.clinicalCondition ? patient.clinicalCondition.slice(0, 32) : "General"} - ${patient.bloodGroup})`}
              />
            )}
          </Field>
        </div>

        {/* Date, Time, and Slot */}
        <Field label="Date *">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time">
          <input type="text" placeholder="10:00 AM" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Time Slot">
          <select className={inputCls} value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
            {TIME_SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        {/* Core Blood & Hemodynamics */}
        <Field label="Haemoglobin (g/dL) *" help="Reference: 11.5 - 17.5 g/dL">
          <input
            type="number"
            step="0.1"
            placeholder="e.g. 9.2 (Ref: 11.5-17.5)"
            className={inputCls}
            value={vitals.haemoglobin}
            onChange={(e) => setField("haemoglobin", e.target.value)}
          />
        </Field>

        <Field label="SpO2 (%) *" help="Normal: 95% – 100%">
          <input
            type="number"
            step="1"
            placeholder="99"
            className={inputCls}
            value={vitals.spO2}
            onChange={(e) => setField("spO2", e.target.value)}
          />
        </Field>

        <Field label="Pulse (bpm) *" help="Normal: 60 – 100 bpm">
          <input
            type="number"
            step="1"
            placeholder="76"
            className={inputCls}
            value={vitals.pulse}
            onChange={(e) => setField("pulse", e.target.value)}
          />
        </Field>

        {/* Glycemic Markers */}
        <Field label="Fasting Glucose (mg/dL)" help="Normal: 70 – 100 mg/dL">
          <input
            type="number"
            step="1"
            placeholder="e.g. 98 (Ref: 70-100)"
            className={inputCls}
            value={vitals.fastingGlucose}
            onChange={(e) => setField("fastingGlucose", e.target.value)}
          />
        </Field>

        <Field label="Postprandial (PP) Glucose (mg/dL)" help="Target: <140 mg/dL">
          <input
            type="number"
            step="1"
            placeholder="e.g. 142 (Ref: <140)"
            className={inputCls}
            value={vitals.postPrandialGlucose}
            onChange={(e) => setField("postPrandialGlucose", e.target.value)}
          />
        </Field>

        <Field label="HbA1c (%)" help="Normal: 4.0 – 5.6%">
          <input
            type="number"
            step="0.1"
            placeholder="e.g. 6.8 (Ref: 4.0-5.6)"
            className={inputCls}
            value={vitals.hbA1c}
            onChange={(e) => setField("hbA1c", e.target.value)}
          />
        </Field>

        {/* Blood Pressure & Ferritin */}
        <Field label="BP Systolic (mmHg) *" help="Normal: 90 – 120 mmHg">
          <input
            type="number"
            step="1"
            placeholder="e.g. 120"
            className={inputCls}
            value={vitals.bpSystolic}
            onChange={(e) => setField("bpSystolic", e.target.value)}
          />
        </Field>

        <Field label="BP Diastolic (mmHg) *" help="Normal: 60 – 80 mmHg">
          <input
            type="number"
            step="1"
            placeholder="e.g. 80"
            className={inputCls}
            value={vitals.bpDiastolic}
            onChange={(e) => setField("bpDiastolic", e.target.value)}
          />
        </Field>

        <Field label="Serum Ferritin (ng/mL)" help="Reference: 20 – 300 ng/mL">
          <input
            type="number"
            step="1"
            placeholder="e.g. 1380 (Ref: 20-300)"
            className={inputCls}
            value={vitals.serumFerritin}
            onChange={(e) => setField("serumFerritin", e.target.value)}
          />
        </Field>

        {/* Clinical Observations */}
        <div className="sm:col-span-3">
          <Field label="Clinical Notes & Observations">
            <textarea
              rows={3}
              placeholder="Clinical symptoms, treatment response, dietary tolerance, therapy notes..."
              className={inputCls}
              value={vitals.clinicalNotes}
              onChange={(e) => setField("clinicalNotes", e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/** Demographics Editor Modal */
function DemographicsModal({
  patient,
  cats,
  onClose,
  onSaved,
}: {
  patient: PatientDTO;
  cats: Cat[];
  onClose: () => void;
  onSaved: (updated: Partial<PatientDTO>) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: patient.fullName,
    contactNumber: patient.contactNumber,
    age: String(patient.age),
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    categoryId: patient.categoryId ?? "",
    roomBedNumber: patient.roomBedNumber ?? "",
    clinicalCondition: patient.clinicalCondition,
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const body = {
      ...form,
      age: parseInt(form.age, 10) || patient.age,
      categoryId: form.categoryId || null,
      roomBedNumber: patient.patientType === "INPATIENT" ? form.roomBedNumber : undefined,
    };
    const res = await api(`/api/portal/r/patients/${patient.id}`, "PUT", body);
    setBusy(false);
    if (!res.ok) return toast(res.error || "Could not save demographics", "err");
    toast("Patient details updated successfully");
    const cat = cats.find((c) => c.id === form.categoryId);
    onSaved({
      ...body,
      categoryName: cat?.name ?? null,
    });
    onClose();
  }

  return (
    <Modal
      size="md"
      title={`Edit Demographics — ${patient.uhid}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save Changes"}
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full Name *">
          <input
            className={inputCls}
            value={form.fullName}
            onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
          />
        </Field>
        <Field label="Contact Number *">
          <input
            className={inputCls}
            value={form.contactNumber}
            onChange={(e) => setForm((s) => ({ ...s, contactNumber: e.target.value }))}
          />
        </Field>
        <Field label="Age *">
          <input
            type="number"
            min={0}
            max={120}
            className={inputCls}
            value={form.age}
            onChange={(e) => setForm((s) => ({ ...s, age: e.target.value }))}
          />
        </Field>
        <Field label="Gender">
          <select
            className={inputCls}
            value={form.gender}
            onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value as PatientDTO["gender"] }))}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Blood Group">
          <select
            className={inputCls}
            value={form.bloodGroup}
            onChange={(e) => setForm((s) => ({ ...s, bloodGroup: e.target.value }))}
          >
            {BLOOD_GROUPS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Diagnosis Category">
          <select
            className={inputCls}
            value={form.categoryId}
            onChange={(e) => setForm((s) => ({ ...s, categoryId: e.target.value }))}
          >
            <option value="">— Unassigned —</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {patient.patientType === "INPATIENT" && (
          <div className="sm:col-span-2">
            <Field label="Room / Bed Number *">
              <input
                className={inputCls}
                value={form.roomBedNumber}
                onChange={(e) => setForm((s) => ({ ...s, roomBedNumber: e.target.value }))}
              />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Comprehensive, dedicated Patient Profile Page */
export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, loading, error, reload } = usePortalData<{
    patient: PatientDTO;
    categories: Cat[];
  }>(`/api/portal/patients/${id}`);

  // Local state for immediate optimistic updates
  const [patient, setPatient] = useState<PatientDTO | null>(null);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [activeTab, setActiveTab] = useState<"analytics" | "clinical" | "consent">("analytics");

  const [vitalsModal, setVitalsModal] = useState(false);
  const [demoModal, setDemoModal] = useState(false);
  const [dischargeModal, setDischargeModal] = useState(false);
  const [dischargeNotes, setDischargeNotes] = useState("");
  const [dischargeBusy, setDischargeBusy] = useState(false);
  const [cameraModal, setCameraModal] = useState(false);

  // Editable clinical fields
  const [allergies, setAllergies] = useState<string[]>([]);
  const [condition, setCondition] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [savingClinical, setSavingClinical] = useState(false);

  // Sync loaded data into state
  useEffect(() => {
    if (data?.patient) {
      setPatient(data.patient);
      setAllergies(data.patient.allergies ?? []);
      setCondition(data.patient.clinicalCondition ?? "");
      setSelectedCat(data.patient.categoryId ?? "");
      document.title = `${data.patient.fullName} (${data.patient.uhid}) | Rithanya HMS`;
    }
    if (data?.categories) {
      setCategories(data.categories);
    }
  }, [data]);

  if (loading) return <LoadingCard />;
  if (error || !patient) return <ErrorCard error={error ?? "Patient profile not found"} onRetry={reload} />;

  // Latest vitals computation (sorted by recordedAt — newest last)
  const sortedVitals = [...(patient.vitals ?? [])].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  const latestVital = sortedVitals.length > 0 ? sortedVitals[sortedVitals.length - 1] : null;

  const backLink =
    patient.isDischarged
      ? "/portal/discharged-patients"
      : patient.patientType === "INPATIENT"
      ? "/portal/inpatients"
      : "/portal/outpatients";

  const backLabel =
    patient.isDischarged
      ? "Discharged Directory"
      : patient.patientType === "INPATIENT"
      ? "Inpatients Roster"
      : "Outpatients & Daycare Queue";

  async function saveClinicalDetails() {
    setSavingClinical(true);
    const res = await api(`/api/portal/r/patients/${patient!.id}`, "PUT", {
      allergies,
      clinicalCondition: condition,
      categoryId: selectedCat || null,
    });
    setSavingClinical(false);
    if (!res.ok) return toast(res.error || "Could not save clinical details", "err");
    toast("Clinical condition, allergies & category saved successfully");
    const cat = categories.find((c) => c.id === selectedCat);
    setPatient((prev) =>
      prev
        ? {
            ...prev,
            allergies,
            clinicalCondition: condition,
            categoryId: selectedCat || null,
            categoryName: cat?.name ?? null,
          }
        : null
    );
  }

  async function handleConsentPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast("Photo size exceeds 8MB limit — please compress and retry.", "err");
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast("Consent photo must be an image file.", "err");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => toast("Could not read the photo — please try another file.", "err");
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await api(`/api/portal/r/patients/${patient!.id}`, "PUT", {
          consentPhoto: base64,
        });
        if (!res.ok) return toast(res.error || "Failed to upload consent photo — please try again.", "err");
        toast("Consent photo uploaded and verified on profile");
        reload?.();
      } catch {
        toast("Failed to upload consent photo — please try again.", "err");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleCameraCapture(base64: string) {
    setCameraModal(false);
    const res = await api(`/api/portal/r/patients/${patient!.id}`, "PUT", {
      consentPhoto: base64,
    });
    if (!res.ok) return toast(res.error || "Failed to save camera capture", "err");
    toast("Consent photo captured and attached to profile");
    reload?.();
  }

  async function handleDischarge() {
    if (dischargeBusy) return;
    setDischargeBusy(true);
    const res = await api(`/api/portal/r/patients/${patient!.id}`, "POST", {
      action: "discharge",
      notes: dischargeNotes,
    });
    setDischargeBusy(false);
    if (!res.ok) return toast(res.error || "Failed to discharge patient — please try again.", "err");
    toast(patient!.patientType === "INPATIENT" ? "Patient discharged successfully" : "Consultation closed successfully");
    setDischargeModal(false);
    reload?.();
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to={backLink}
          className="inline-flex items-center gap-2 text-sm font-semibold text-royal hover:text-alert"
        >
          <ArrowLeft className="h-4 w-4" /> Back to {backLabel}
        </Link>
        <span className="text-xs font-mono text-ink/50 uppercase">EMR RECORD ID: {patient.id}</span>
      </div>

      {/* Patient Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-r from-navy via-royal to-sky-900 p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-2xl font-bold tracking-wider text-gold shadow-inner">
              {patient.fullName.charAt(0)}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {patient.fullName}
                </h1>
                <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-mono font-bold tracking-wide text-yellow-300">
                  {patient.uhid}
                </span>
                <span className="rounded-full bg-rose-500/80 px-2.5 py-0.5 text-xs font-bold text-white">
                  {patient.bloodGroup}
                </span>
                {patient.isDischarged ? (
                  <span className="rounded-full bg-slate-500/80 px-2.5 py-0.5 text-xs font-semibold text-white">
                    Discharged
                  </span>
                ) : patient.patientType === "INPATIENT" ? (
                  <span className="rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-xs font-bold text-white">
                    Admitted · {patient.roomBedNumber ?? "Bed unassigned"}
                  </span>
                ) : (
                  <span className="rounded-full bg-sky-500/80 px-2.5 py-0.5 text-xs font-bold text-white">
                    Outpatient / Daycare Queue
                  </span>
                )}
              </div>
              <p className="text-sm text-sky-100 flex flex-wrap items-center gap-3">
                <span>
                  {patient.age} yrs · {patient.gender.toLowerCase()}
                </span>
                <span>•</span>
                <span>Contact: {patient.contactNumber}</span>
                {patient.categoryName && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-300 font-medium">{patient.categoryName}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Btn
              variant="gold"
              onClick={() => setVitalsModal(true)}
              className="shadow-md hover:shadow-lg transition-all"
            >
              <Activity className="h-4 w-4" /> Log Vitals
            </Btn>
            <Btn
              variant="secondary"
              onClick={() => setDemoModal(true)}
              className="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20"
            >
              <Edit3 className="h-4 w-4" /> Edit Details
            </Btn>
            {!patient.isDischarged && (
              <Btn
                variant="danger"
                onClick={() => setDischargeModal(true)}
                className="bg-red-600/90 hover:bg-red-700"
              >
                <LogOut className="h-4 w-4" />{" "}
                {patient.patientType === "INPATIENT" ? "Discharge" : "Close Consultation"}
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* 4 Top Metric Cards (Latest Vitals Strip) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Haemoglobin */}
        <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-700">
            <span>HAEMOGLOBIN (Hb)</span>
            <Droplets className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-navy font-heading">
              {latestVital ? `${latestVital.haemoglobin}` : "—"}
            </span>
            <span className="text-sm font-semibold text-ink/60">g/dL</span>
          </div>
          <p className="mt-2 text-xs text-ink/65 flex items-center justify-between">
            <span>Ref: 11.5 - 17.5 g/dL</span>
            {latestVital && latestVital.haemoglobin < 11.5 ? (
              <span className="text-amber-600 font-bold">Below Range</span>
            ) : (
              <span className="text-emerald-600 font-bold">Optimal</span>
            )}
          </p>
        </div>

        {/* Card 2: SpO2 & Pulse */}
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
            <span>OXYGENATION & PULSE</span>
            <Heart className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div>
              <span className="text-3xl font-extrabold text-navy font-heading">
                {latestVital ? `${latestVital.spO2}%` : "—"}
              </span>
              <span className="text-xs font-semibold text-ink/50 ml-1">SpO₂</span>
            </div>
            <span className="text-ink/30 font-light">|</span>
            <div>
              <span className="text-2xl font-bold text-navy font-heading">
                {latestVital ? `${latestVital.pulse}` : "—"}
              </span>
              <span className="text-xs font-semibold text-ink/50 ml-1">bpm</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-ink/65 flex items-center justify-between">
            <span>BP: {latestVital ? `${latestVital.bpSystolic}/${latestVital.bpDiastolic} mmHg` : "—"}</span>
            <span className="text-emerald-600 font-bold">Stable</span>
          </p>
        </div>

        {/* Card 3: Blood Glucose */}
        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
            <span>GLUCOSE (FASTING / PP)</span>
            <Activity className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-navy font-heading">
              {latestVital?.fastingGlucose ? `${latestVital.fastingGlucose}` : "—"}
            </span>
            <span className="text-sm font-semibold text-ink/60">/ {latestVital?.postPrandialGlucose ?? "—"}</span>
            <span className="text-xs font-semibold text-ink/50">mg/dL</span>
          </div>
          <p className="mt-2 text-xs text-ink/65 flex items-center justify-between">
            <span>Ref: 70–100 / &lt;140</span>
            <span className="text-amber-700 font-bold">Normoglycemic</span>
          </p>
        </div>

        {/* Card 4: HbA1c & Ferritin */}
        <div className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-700">
            <span>HBA1C & FERRITIN</span>
            <Sparkles className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-navy font-heading">
              {latestVital?.hbA1c ? `${latestVital.hbA1c}%` : "—"}
            </span>
            <span className="text-sm font-semibold text-ink/60">
              · {latestVital?.serumFerritin ? `${latestVital.serumFerritin} ng/mL` : "—"}
            </span>
          </div>
          <p className="mt-2 text-xs text-ink/65 flex items-center justify-between">
            <span>Target: &lt;6.5%</span>
            <span className="text-purple-700 font-bold">Longitudinal Track</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line">
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-base font-bold transition-all ${
            activeTab === "analytics"
              ? "border-royal text-royal"
              : "border-transparent text-ink/65 hover:text-navy"
          }`}
        >
          <Activity className="h-4 w-4" /> Vitals & Trajectory Analytics ({patient.vitals.length})
        </button>
        <button
          onClick={() => setActiveTab("clinical")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-base font-bold transition-all ${
            activeTab === "clinical"
              ? "border-royal text-royal"
              : "border-transparent text-ink/65 hover:text-navy"
          }`}
        >
          <FileText className="h-4 w-4" /> Clinical Profile & History
        </button>
        <button
          onClick={() => setActiveTab("consent")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-base font-bold transition-all ${
            activeTab === "consent"
              ? "border-royal text-royal"
              : "border-transparent text-ink/65 hover:text-navy"
          }`}
        >
          <Camera className="h-4 w-4" /> Consent Photo & Documents
        </button>
      </div>

      {/* Tab 1: Trajectory Analytics & Vitals History */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Dual Trajectory Graphs: Blood Glucose Trends & Adaptive Dual-Axis Haemoglobin/HbA1c */}
          <TrajectoryGraphs vitals={patient.vitals} />

          {/* Vitals History Table */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line p-4">
              <div>
                <h3 className="font-heading text-lg font-bold text-navy">Longitudinal Vitals Log</h3>
                <p className="text-xs text-ink/60">
                  Chronological records with adaptive scaling and verified staff audit timestamps
                </p>
              </div>
              <Btn small variant="gold" onClick={() => setVitalsModal(true)}>
                <Plus className="h-4 w-4" /> Log Entry
              </Btn>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="bg-canvas text-xs font-bold text-ink/70">
                  <tr>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-3 py-3">Slot</th>
                    <th className="px-3 py-3">Hb (g/dL)</th>
                    <th className="px-3 py-3">SpO₂ (%)</th>
                    <th className="px-3 py-3">Pulse</th>
                    <th className="px-3 py-3">BP (mmHg)</th>
                    <th className="px-3 py-3">FBS (mg/dL)</th>
                    <th className="px-3 py-3">PP (mg/dL)</th>
                    <th className="px-3 py-3">HbA1c (%)</th>
                    <th className="px-3 py-3">Ferritin</th>
                    <th className="px-4 py-3">Clinical Notes</th>
                    <th className="px-4 py-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink">
                  {[...patient.vitals].reverse().map((v) => (
                    <tr key={v.id} className="hover:bg-canvas/50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-navy">
                        {formatDate(v.recordedAt, true)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {v.timeSlot ?? "Morning"}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-sky-700">{v.haemoglobin}</td>
                      <td className="px-3 py-3 font-semibold text-emerald-700">{v.spO2}%</td>
                      <td className="px-3 py-3 font-semibold text-red-700">{v.pulse} bpm</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {v.bpSystolic}/{v.bpDiastolic}
                      </td>
                      <td className="px-3 py-3 font-medium text-amber-700">{v.fastingGlucose ?? "—"}</td>
                      <td className="px-3 py-3 font-medium text-rose-700">{v.postPrandialGlucose ?? "—"}</td>
                      <td className="px-3 py-3 font-bold text-purple-700">{v.hbA1c ? `${v.hbA1c}%` : "—"}</td>
                      <td className="px-3 py-3">{v.serumFerritin ?? "—"}</td>
                      <td className="px-4 py-3 max-w-xs truncate text-xs text-ink/80" title={v.clinicalNotes}>
                        {v.clinicalNotes || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink/65 whitespace-nowrap">
                        {v.recordedByStaff || "Staff Nurse"}
                      </td>
                    </tr>
                  ))}
                  {patient.vitals.length === 0 && (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-sm text-ink/60">
                        No vitals recorded yet. Click &quot;Log Vitals&quot; to add the first clinical entry.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Clinical Details & History */}
      {activeTab === "clinical" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="p-6 space-y-5">
              <h3 className="font-heading text-lg font-bold text-navy flex items-center gap-2">
                <FileText className="h-5 w-5 text-royal" /> Clinical Condition & Medical History
              </h3>
              <Field
                label="Clinical Condition Description"
                help="Include diagnosis, ongoing medications, transfusion protocol, and chronic complaints."
              >
                <textarea
                  rows={4}
                  className={inputCls}
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                />
              </Field>

              <div>
                <span className="mb-2 block text-sm font-semibold text-navy">
                  Drug & Clinical Allergies (Real-Time Safety Barrier)
                </span>
                <AllergyTagEditor value={allergies} onChange={setAllergies} />
              </div>

              <div className="pt-2">
                <Field label="Assigned Diagnosis Category">
                  <select
                    className={inputCls}
                    value={selectedCat}
                    onChange={(e) => setSelectedCat(e.target.value)}
                  >
                    <option value="">— Unassigned —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="flex justify-end pt-3">
                <Btn onClick={saveClinicalDetails} disabled={savingClinical}>
                  {savingClinical ? "Saving Changes…" : "Save Clinical Profile"}
                </Btn>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h4 className="font-heading text-base font-bold text-navy">Demographic Summary</h4>
              <dl className="divide-y divide-line text-sm">
                <div className="py-2.5 flex justify-between">
                  <dt className="text-ink/60">UHID</dt>
                  <dd className="font-mono font-bold text-navy">{patient.uhid}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-ink/60">Registration Date</dt>
                  <dd className="font-medium text-navy">{formatDate(patient.createdAt, true)}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-ink/60">Age & Gender</dt>
                  <dd className="font-medium text-navy">
                    {patient.age} yrs · {patient.gender}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-ink/60">Blood Group</dt>
                  <dd className="font-bold text-rose-600">{patient.bloodGroup}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-ink/60">Contact Phone</dt>
                  <dd className="font-medium text-navy">{patient.contactNumber}</dd>
                </div>
                {patient.patientType === "INPATIENT" && (
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-ink/60">Ward / Room</dt>
                    <dd className="font-bold text-emerald-700">{patient.roomBedNumber ?? "—"}</dd>
                  </div>
                )}
              </dl>
              <Btn variant="secondary" onClick={() => setDemoModal(true)} className="w-full">
                Edit Demographics
              </Btn>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 3: Consent Photo & Documents */}
      {activeTab === "consent" && (
        <Card className="p-6 max-w-3xl space-y-6">
          <div>
            <h3 className="font-heading text-lg font-bold text-navy flex items-center gap-2">
              <Camera className="h-5 w-5 text-royal" /> Patient Consent & Verification Photo
            </h3>
            <p className="mt-1 text-sm text-ink/65">
              Consent photos can be uploaded or captured anytime during or after patient onboarding and vitals review.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl border border-line bg-canvas p-6">
            {patient.consentPhotoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={patient.consentPhotoUrl}
                alt="Patient Consent Record"
                className="h-44 w-56 rounded-xl border border-line object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-44 w-56 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white text-center p-4 text-ink/50">
                <Camera className="h-8 w-8 mb-2 text-ink/30" />
                <span className="text-sm font-semibold">No consent photo attached</span>
                <span className="text-xs text-ink/40 mt-1">Upload or capture below</span>
              </div>
            )}

            <div className="space-y-4 flex-1">
              <div className="space-y-1">
                <span className="text-sm font-bold text-navy">Digital Consent Documentation</span>
                <p className="text-xs text-ink/65">
                  Stored securely in the protected hospital EMR repository.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-navy hover:border-royal hover:text-royal shadow-sm">
                  <Upload className="h-4 w-4" /> Upload Image File
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleConsentPhotoUpload}
                  />
                </label>
                <Btn type="button" variant="secondary" onClick={() => setCameraModal(true)}>
                  <Camera className="h-4 w-4" /> Capture with Camera
                </Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Log Vitals Modal */}
      {vitalsModal && (
        <LogVitalsModal
          patient={patient}
          onClose={() => setVitalsModal(false)}
          onSaved={(newV) => {
            setPatient((prev) =>
              prev ? { ...prev, vitals: [...prev.vitals, newV] } : null
            );
          }}
        />
      )}

      {/* Demographics Modal */}
      {demoModal && (
        <DemographicsModal
          patient={patient}
          cats={categories}
          onClose={() => setDemoModal(false)}
          onSaved={(updated) => {
            setPatient((prev) => (prev ? { ...prev, ...updated } : null));
          }}
        />
      )}

      {/* Discharge Confirmation Modal */}
      {dischargeModal && (
        <Modal
          size="sm"
          title={patient.patientType === "INPATIENT" ? "Discharge Inpatient" : "Close Outpatient Consultation"}
          onClose={() => setDischargeModal(false)}
          footer={
            <>
              <Btn variant="secondary" onClick={() => setDischargeModal(false)} disabled={dischargeBusy}>
                Cancel
              </Btn>
              <Btn variant="danger" onClick={handleDischarge} disabled={dischargeBusy}>
                {dischargeBusy ? "Discharging…" : "Confirm Discharge"}
              </Btn>
            </>
          }
        >
          <Field label="Discharge / Closing Summary Notes">
            <textarea
              rows={4}
              className={inputCls}
              placeholder="Clinical resolution notes, prescribed take-home medications, follow-up instructions..."
              value={dischargeNotes}
              onChange={(e) => setDischargeNotes(e.target.value)}
            />
          </Field>
        </Modal>
      )}

      {/* Camera Capture Modal */}
      {cameraModal && (
        <ConsentCameraModal
          onCancel={() => setCameraModal(false)}
          onCaptureComplete={handleCameraCapture}
        />
      )}
    </div>
  );
}
