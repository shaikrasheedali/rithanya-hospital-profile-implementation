"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Archive, Camera, CheckCircle2, LogOut, Plus, RotateCcw, Search, ShieldAlert, Stethoscope, Trash2, X } from "lucide-react";
import { ConsentCameraModal } from "@/components/portal/ConsentCameraModal";
import { TrajectoryGraphs } from "@/components/portal/TrajectoryGraphs";
import { Badge, Btn, Card, Empty, Field, Modal, PageHeader, api, inputCls, useToast } from "@/components/portal/ui";
import type { PatientDTO } from "@/lib/emr";
import { formatDate } from "@/lib/utils";

type Mode = "INPATIENT" | "OUTPATIENT" | "DISCHARGED";
type Cat = { id: string; name: string };

const BLOOD = ["O+ve", "O-ve", "A+ve", "A-ve", "B+ve", "B-ve", "AB+ve", "AB-ve", "Unknown"];

type FormState = {
  fullName: string; contactNumber: string; age: string; gender: string; bloodGroup: string; clinicalCondition: string;
  allergies: string[]; categoryId: string; roomBedNumber: string; consentPhoto: string;
};

function AllergyTags({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const [t, setT] = useState("");
  const add = () => {
    const v = t.trim();
    if (v && !value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setT("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.length === 0 && <span className="text-base text-ink/60">No known allergies recorded</span>}
        {value.map((a) => (
          <span key={a} className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">
            <ShieldAlert className="h-3.5 w-3.5" /> {a}
            {!disabled && <button type="button" onClick={() => onChange(value.filter((x) => x !== a))} aria-label={`Remove ${a}`} className="rounded-full hover:bg-red-200"><X className="h-4 w-4" /></button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="mt-2 flex gap-2">
          <input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Add drug / clinical allergy…" aria-label="Add allergy" className={inputCls} />
          <Btn type="button" variant="secondary" onClick={add}>Add</Btn>
        </div>
      )}
    </div>
  );
}

function PatientForm({ initial, type, cats, onDone, onCancel }: { initial?: PatientDTO; type: "INPATIENT" | "OUTPATIENT"; cats: Cat[]; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<FormState>({
    fullName: initial?.fullName ?? "", contactNumber: initial?.contactNumber ?? "", age: String(initial?.age ?? ""), gender: initial?.gender ?? "MALE",
    bloodGroup: initial?.bloodGroup ?? "Unknown", clinicalCondition: initial?.clinicalCondition ?? "", allergies: initial?.allergies ?? [],
    categoryId: initial?.categoryId ?? "", roomBedNumber: initial?.roomBedNumber ?? "", consentPhoto: "",
  });
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (f.fullName.trim().length < 2) {
      toast("Full name must be at least 2 characters.", "err");
      return;
    }
    if (f.contactNumber.replace(/\D/g, "").length < 10) {
      toast("Contact number must contain at least 10 digits.", "err");
      return;
    }
    const ageNum = Number(f.age);
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120) {
      toast("Age must be between 0 and 120.", "err");
      return;
    }
    if (type === "INPATIENT" && !f.roomBedNumber.trim()) {
      toast("Room / bed number is required for inpatients.", "err");
      return;
    }
    setBusy(true);
    const body = { ...f, age: ageNum, patientType: type, consentPhoto: f.consentPhoto || undefined };
    const r = initial ? await api(`/api/portal/r/patients/${initial.id}`, "PUT", body) : await api("/api/portal/r/patients", "POST", body);
    setBusy(false);
    if (!r.ok) return toast(r.error || "Could not save — please try again.", "err");
    toast(initial ? "Record updated" : type === "INPATIENT" ? "Patient admitted" : "Outpatient registered");
    onDone();
  }

  const photo = f.consentPhoto || initial?.consentPhotoUrl || "";
  return (
    <Modal
      size="lg"
      title={initial ? `Edit ${initial.uhid}` : type === "INPATIENT" ? "Admit new inpatient" : "Register outpatient"}
      onClose={onCancel}
      footer={<><Btn variant="secondary" onClick={onCancel}>Cancel</Btn><Btn onClick={save} disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : type === "INPATIENT" ? "Admit patient" : "Register"}</Btn></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name *"><input required minLength={2} className={inputCls} value={f.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
        <Field label="Contact number *"><input required type="tel" pattern="[0-9+()\-\s]{10,15}" title="Enter a valid phone number" className={inputCls} value={f.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} /></Field>
        <Field label="Age *"><input required type="number" min={0} max={120} className={inputCls} value={f.age} onChange={(e) => set("age", e.target.value)} /></Field>
        <Field label="Gender"><select className={inputCls} value={f.gender} onChange={(e) => set("gender", e.target.value)}><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></Field>
        <Field label="Blood group"><select className={inputCls} value={f.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}>{BLOOD.map((b) => <option key={b}>{b}</option>)}</select></Field>
        <Field label="Diagnosis category"><select className={inputCls} value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}><option value="">— Unassigned —</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        {type === "INPATIENT" && <Field label="Room / bed number *" className="sm:col-span-2"><input className={inputCls} placeholder="e.g. Ward-2 / Bed 4" value={f.roomBedNumber} onChange={(e) => set("roomBedNumber", e.target.value)} /></Field>}
        <Field label="Clinical condition & history" className="sm:col-span-2"><textarea rows={3} className={inputCls} value={f.clinicalCondition} onChange={(e) => set("clinicalCondition", e.target.value)} /></Field>
        <div className="sm:col-span-2"><span className="mb-1 block text-sm font-semibold text-navy">Drug & clinical allergies</span><AllergyTags value={f.allergies} onChange={(v) => set("allergies", v)} /></div>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-navy">Consent photo (optional — can be uploaded anytime later in profile)</span>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-canvas p-4">
            {photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo} alt="Consent" className="h-24 w-36 rounded-lg border border-line object-cover" /> : <div className="flex h-24 w-36 items-center justify-center rounded-lg border border-dashed border-line text-sm text-ink/60">No photo yet</div>}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:border-royal hover:text-royal">
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 8 * 1024 * 1024) {
                      toast("Photo must be under 8MB.", "err");
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
                    reader.onload = () => set("consentPhoto", reader.result as string);
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <Btn type="button" variant="secondary" onClick={() => setCamera(true)}><Camera className="h-5 w-5" /> {photo ? "Retake camera" : "Capture camera"}</Btn>
            </div>
          </div>
        </div>
      </div>
      {camera && <ConsentCameraModal onCancel={() => setCamera(false)} onCaptureComplete={(d) => { set("consentPhoto", d); setCamera(false); }} />}
    </Modal>
  );
}

function VitalsModal({ patient, onClose, onDone }: { patient: PatientDTO; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [v, setV] = useState<Record<string, string>>({ haemoglobin: "", spO2: "", pulse: "", fastingGlucose: "", postPrandialGlucose: "", hbA1c: "", bpSystolic: "", bpDiastolic: "", serumFerritin: "", clinicalNotes: "" });
  const [busy, setBusy] = useState(false);
  const fields: Array<[string, string, string, boolean]> = [
    ["haemoglobin", "Haemoglobin (g/dL)", "0.1", true], ["spO2", "SpO₂ (%)", "1", true], ["pulse", "Pulse (bpm)", "1", true],
    ["bpSystolic", "BP systolic (mmHg)", "1", true], ["bpDiastolic", "BP diastolic (mmHg)", "1", true], ["fastingGlucose", "Fasting glucose (mg/dL)", "1", false],
    ["postPrandialGlucose", "PP glucose (mg/dL)", "1", false], ["hbA1c", "HbA1c (%)", "0.1", false], ["serumFerritin", "Serum ferritin (ng/mL)", "1", false],
  ];
  async function save() {
    setBusy(true);
    const r = await api(`/api/portal/r/patients/${patient.id}`, "POST", { action: "vitals", ...v });
    setBusy(false);
    if (!r.ok) return toast(r.error || "Could not log vitals", "err");
    toast("Vitals logged");
    onDone();
  }
  return (
    <Modal title={`Log vitals — ${patient.fullName}`} onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={save} disabled={busy}>{busy ? "Saving…" : "Save record"}</Btn></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        {fields.map(([k, label, step, req]) => (
          <Field key={k} label={label + (req ? " *" : "")}><input type="number" step={step} className={inputCls} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
        ))}
        <Field label="Clinical notes" className="sm:col-span-3"><textarea rows={2} className={inputCls} value={v.clinicalNotes} onChange={(e) => setV({ ...v, clinicalNotes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function Profile({ p, mode, cats, onClose, onChanged }: { p: PatientDTO; mode: Mode; cats: Cat[]; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<"profile" | "vitals">("profile");
  const [edit, setEdit] = useState(false);
  const [vitals, setVitals] = useState(false);
  const [notes, setNotes] = useState("");
  const [discharging, setDischarging] = useState(false);
  const [allergies, setAllergies] = useState(p.allergies);
  const [category, setCategory] = useState(p.categoryId ?? "");
  const readOnly = p.isDischarged;

  async function quickSave() {
    const r = await api(`/api/portal/r/patients/${p.id}`, "PUT", { allergies, categoryId: category });
    if (!r.ok) return toast(r.error || "Could not save", "err");
    toast("Allergies & category saved");
    onChanged();
  }
  async function action(a: string, extra: object = {}) {
    const r = await api(`/api/portal/r/patients/${p.id}`, "POST", { action: a, ...extra });
    if (!r.ok) return toast(r.error || "Action failed", "err");
    toast(a === "discharge" ? "Discharged" : a === "archive" ? "Archived" : "Restored");
    onChanged();
    onClose();
  }

  const latest = p.vitals[p.vitals.length - 1];
  return (
    <Modal
      size="xl"
      title={`${p.fullName} · ${p.uhid}`}
      onClose={onClose}
      footer={
        <>
          {!readOnly && <Btn variant="secondary" onClick={() => setEdit(true)}>Edit demographics</Btn>}
          {!readOnly && <Btn variant="gold" onClick={() => setVitals(true)}><Activity className="h-4 w-4" /> Log vitals</Btn>}
          {!readOnly && <Btn variant="danger" onClick={() => setDischarging(true)}><LogOut className="h-4 w-4" /> {p.patientType === "INPATIENT" ? "Discharge" : "Close consultation"}</Btn>}
          {readOnly && !p.isArchived && <Btn variant="secondary" onClick={() => action("archive")}><Archive className="h-4 w-4" /> Archive (soft remove)</Btn>}
          {readOnly && p.isArchived && <Btn variant="secondary" onClick={() => action("unarchive")}><RotateCcw className="h-4 w-4" /> Restore</Btn>}
        </>
      }
    >
      <div className="mb-5 flex gap-2 border-b border-line">
        {(["profile", "vitals"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2.5 text-base font-semibold ${tab === t ? "border-royal text-royal" : "border-transparent text-ink/70 hover:text-royal"}`}>{t === "profile" ? "Live medical record" : `Vitals & trajectories (${p.vitals.length})`}</button>
        ))}
      </div>

      {tab === "profile" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
          <div className="space-y-5">
            <dl className="grid gap-4 sm:grid-cols-3">
              {[["Age / gender", `${p.age} · ${p.gender.charAt(0)}${p.gender.slice(1).toLowerCase()}`], ["Blood group", p.bloodGroup], ["Contact", p.contactNumber], ["Type", p.patientType === "INPATIENT" ? "Inpatient" : "Outpatient"], ["Room / bed", p.roomBedNumber ?? "—"], ["Registered", formatDate(p.createdAt, true)]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-canvas p-3"><dt className="text-sm font-semibold text-ink/60">{k}</dt><dd className="text-base font-semibold text-navy">{v}</dd></div>
              ))}
            </dl>
            {p.isDischarged && <div className="rounded-lg border border-line bg-canvas p-4 text-base"><p className="font-semibold text-navy">Discharged {formatDate(p.dischargeDate, true)}</p>{p.dischargeNotes && <p className="mt-1 text-ink/80">{p.dischargeNotes}</p>}</div>}
            <div><h3 className="mb-1 text-base font-semibold">Clinical condition</h3><p className="whitespace-pre-wrap rounded-lg border border-line p-3 text-base">{p.clinicalCondition || "—"}</p></div>
            <div>
              <h3 className="mb-2 text-base font-semibold">Drug & clinical allergies</h3>
              <AllergyTags value={allergies} onChange={setAllergies} disabled={readOnly} />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Assigned diagnosis category" className="min-w-64 flex-1"><select disabled={readOnly} className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">— Unassigned —</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              {!readOnly && <Btn onClick={quickSave} disabled={JSON.stringify(allergies) === JSON.stringify(p.allergies) && category === (p.categoryId ?? "")}>Save changes</Btn>}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-base font-semibold">Consent photo</h3>
            {p.consentPhotoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.consentPhotoUrl} alt="Consent" className="w-full rounded-xl border border-line object-cover" /> : <p className="rounded-xl border border-dashed border-line p-6 text-center text-base text-ink/60">No consent photo</p>}
            {latest && (
              <div className="mt-4 rounded-xl border border-line p-4 text-base">
                <p className="mb-1 font-semibold text-navy">Latest vitals</p>
                <p>Hb {latest.haemoglobin} · SpO₂ {latest.spO2}% · Pulse {latest.pulse}</p>
                <p>BP {latest.bpSystolic}/{latest.bpDiastolic}</p>
                <p className="text-sm text-ink/60">{formatDate(latest.recordedAt, true)}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <TrajectoryGraphs vitals={p.vitals} />
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-canvas text-ink/70"><tr>{["Recorded", "Hb", "SpO₂", "Pulse", "BP", "FBS", "PPBS", "HbA1c", "Ferritin", "By"].map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {[...p.vitals].reverse().map((v) => (
                  <tr key={v.id}>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(v.recordedAt, true)}</td><td className="px-3 py-2.5">{v.haemoglobin}</td><td className="px-3 py-2.5">{v.spO2}</td><td className="px-3 py-2.5">{v.pulse}</td>
                    <td className="px-3 py-2.5">{v.bpSystolic}/{v.bpDiastolic}</td><td className="px-3 py-2.5">{v.fastingGlucose ?? "—"}</td><td className="px-3 py-2.5">{v.postPrandialGlucose ?? "—"}</td><td className="px-3 py-2.5">{v.hbA1c ?? "—"}</td><td className="px-3 py-2.5">{v.serumFerritin ?? "—"}</td><td className="px-3 py-2.5">{v.recordedByStaff ?? "—"}</td>
                  </tr>
                ))}
                {p.vitals.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-ink/60">No vitals logged yet.</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {edit && <PatientForm initial={p} type={p.patientType} cats={cats} onCancel={() => setEdit(false)} onDone={() => { setEdit(false); onChanged(); onClose(); }} />}
      {vitals && <VitalsModal patient={p} onClose={() => setVitals(false)} onDone={() => { setVitals(false); onChanged(); }} />}
      {discharging && (
        <Modal size="sm" title={p.patientType === "INPATIENT" ? "Discharge patient" : "Close consultation"} onClose={() => setDischarging(false)} footer={<><Btn variant="secondary" onClick={() => setDischarging(false)}>Cancel</Btn><Btn variant="danger" onClick={() => action("discharge", { notes })}>Confirm</Btn></>}>
          <Field label="Discharge / closing notes (encrypted)"><textarea rows={4} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </Modal>
      )}
    </Modal>
  );
}

export function PatientsManager({ mode, patients, cats, showArchived = false }: { mode: Mode; patients: PatientDTO[]; cats: Cat[]; showArchived?: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [typeF, setTypeF] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();

  async function handleDelete(patient: PatientDTO) {
    if (!window.confirm(`Are you sure you want to permanently delete patient ${patient.fullName} (${patient.uhid})? This action cannot be undone.`)) {
      return;
    }
    setDeletingId(patient.id);
    const r = await api(`/api/portal/r/patients/${patient.id}`, "DELETE");
    setDeletingId(null);
    if (!r.ok) {
      return toast(r.error || "Failed to delete patient record", "err");
    }
    toast(`Patient ${patient.fullName} deleted successfully`);
    refresh();
  }

  const title = mode === "INPATIENT" ? "Inpatients" : mode === "OUTPATIENT" ? "Outpatients & daycare queue" : "Discharged patients archive";
  const desc =
    mode === "INPATIENT" ? "Active admitted patients roster with live medical records, allergies and vitals."
    : mode === "OUTPATIENT" ? "Active daycare and outpatient consultation queue."
    : "Permanent record retention — full vitals and history stay available after discharge.";

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return patients.filter(
      (p) =>
        (!cat || p.categoryId === cat) &&
        (!typeF || p.patientType === typeF) &&
        (!s || p.fullName.toLowerCase().includes(s) || p.contactNumber.includes(s) || p.uhid.toLowerCase().includes(s)),
    );
  }, [patients, q, cat, typeF]);
  const open = patients.find((p) => p.id === openId) ?? null;
  const refresh = () => window.location.reload();

  return (
    <>
      <PageHeader title={title} desc={desc}>
        {mode !== "DISCHARGED" && <Btn onClick={() => setCreating(true)}><Plus className="h-5 w-5" /> {mode === "INPATIENT" ? "Admit patient" : "Register OP"}</Btn>}
        {mode === "DISCHARGED" && <a href={showArchived ? "/portal/discharged-patients" : "/portal/discharged-patients?archived=1"} className="text-base font-semibold text-royal hover:text-alert">{showArchived ? "← Back to directory" : "View archived records"}</a>}
      </PageHeader>

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, mobile or UHID…" aria-label="Search patients" className={`${inputCls} pl-9`} />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Diagnosis filter" className={`${inputCls} !w-auto`}><option value="">All conditions</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          {mode === "DISCHARGED" && <select value={typeF} onChange={(e) => setTypeF(e.target.value)} aria-label="Type filter" className={`${inputCls} !w-auto`}><option value="">Inpatients & OP</option><option value="INPATIENT">Inpatients</option><option value="OUTPATIENT">Outpatients</option></select>}
        </div>
        {list.length === 0 ? <Empty text="No patients found." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-base">
              <thead className="bg-canvas text-sm text-ink/70"><tr>{["Patient", "UHID", "Age / sex", "Condition", mode === "OUTPATIENT" ? "Registered" : "Room / bed", "Allergies", ""].map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {list.map((p) => (
                  <tr key={p.id} className="hover:bg-canvas/60">
                    <td className="px-4 py-3"><button onClick={() => navigate(`/portal/patients/${p.id}`)} className="text-left font-semibold text-royal hover:text-alert">{p.fullName}</button><p className="text-sm text-ink/65">{p.contactNumber} · {p.bloodGroup}</p></td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{p.uhid}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.age} · {p.gender.charAt(0)}</td>
                    <td className="px-4 py-3">{p.categoryName ? <Badge tone="blue">{p.categoryName}</Badge> : <span className="text-ink/50">—</span>}{mode === "DISCHARGED" && <span className="ml-1.5"><Badge>{p.patientType === "INPATIENT" ? "IP" : "OP"}</Badge></span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{mode === "OUTPATIENT" ? formatDate(p.createdAt) : mode === "DISCHARGED" ? formatDate(p.dischargeDate) : p.roomBedNumber ?? "—"}</td>
                    <td className="px-4 py-3">{p.allergies.length ? <Badge tone="red">{p.allergies.length} allerg{p.allergies.length === 1 ? "y" : "ies"}</Badge> : <span className="text-ink/50">None</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Btn small variant="secondary" onClick={() => navigate(`/portal/patients/${p.id}`)}>
                          <Stethoscope className="h-4 w-4" /> Open Profile
                        </Btn>
                        <Btn
                          small
                          variant="danger"
                          onClick={() => handleDelete(p)}
                          disabled={deletingId === p.id}
                          title="Delete patient record"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && mode !== "DISCHARGED" && <PatientForm type={mode} cats={cats} onCancel={() => setCreating(false)} onDone={() => { setCreating(false); refresh(); }} />}
      {open && <Profile key={open.id + open.vitals.length} p={open} mode={mode} cats={cats} onClose={() => setOpenId(null)} onChanged={refresh} />}
      <span className="hidden"><CheckCircle2 /></span>
    </>
  );
}
