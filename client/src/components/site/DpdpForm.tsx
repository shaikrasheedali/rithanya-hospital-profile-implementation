"use client";

import { useState } from "react";
import { CheckCircle2, Search, Upload } from "lucide-react";

const input = "w-full rounded-lg border border-line bg-white px-3.5 py-3 text-base focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Received — under verification",
  MATCHED_AND_ERASED: "Completed — matching records erased",
  MANUALLY_RESOLVED: "Resolved by the compliance desk",
  REJECTED: "Closed — could not be verified",
};

export function DpdpForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [file, setFile] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/public/dpdp", { method: "POST", body: new FormData(e.currentTarget) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setCode(data.trackingCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  if (code)
    return (
      <div className="rounded-xl border border-line bg-white p-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <h3 className="mt-3 text-2xl font-semibold">Erasure request submitted</h3>
        <p className="mt-2">Keep this tracking code to verify the status of your request:</p>
        <p className="mt-2 select-all font-heading text-3xl font-bold tracking-wider text-royal">{code}</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-line bg-white p-7 sm:p-9">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-semibold text-navy">Full name of patient *</span><input name="fullName" required minLength={2} className={input} autoComplete="name" /></label>
        <label className="block"><span className="mb-1 block text-sm font-semibold text-navy">Registered mobile number *</span><input name="phoneNumber" required type="tel" inputMode="tel" className={input} autoComplete="tel" /></label>
        <label className="block"><span className="mb-1 block text-sm font-semibold text-navy">UHID / IP / OP number</span><input name="identificationRef" placeholder="e.g. RH-2026-0001" className={input} /></label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-navy">Nature of records held</span>
          <select name="recordsNature" className={input} defaultValue="EMR, Consultation & Billing">
            <option>EMR, Consultation & Billing</option><option>EMR (clinical records) only</option><option>Consultation records only</option><option>Billing records only</option>
          </select>
        </label>
      </div>
      <label className="block"><span className="mb-1 block text-sm font-semibold text-navy">Reason for erasure *</span><textarea name="requestDetails" required rows={4} minLength={5} className={input} /></label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-navy">Identity proof (image or PDF, max 8MB)</span>
        <span className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-royal bg-canvas px-4 py-4 text-royal hover:bg-royal/5">
          <Upload className="h-5 w-5" /> {file || "Choose file…"}
          <input name="identityProof" type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
        </span>
      </label>
      {error && <p role="alert" className="rounded-lg bg-alert/10 p-3 font-medium text-alert">{error}</p>}
      <button disabled={busy} className="w-full rounded-full bg-royal px-6 py-3.5 font-semibold text-white hover:bg-alert disabled:opacity-60 sm:w-auto">{busy ? "Submitting…" : "Submit erasure request"}</button>
    </form>
  );
}

export function DpdpStatus() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [res, setRes] = useState<{ status: string; submittedAt: string; updatedAt: string; note: string | null } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setRes(null);
    try {
      const r = await fetch(`/api/public/dpdp?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Not found");
      setRes(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Not found");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={check} className="space-y-4 rounded-xl border border-line bg-white p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-semibold text-navy">Tracking code</span><input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="DPDP-XXXXXXXX" className={input} /></label>
        <label className="block"><span className="mb-1 block text-sm font-semibold text-navy">Registered mobile</span><input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" className={input} /></label>
      </div>
      <button disabled={busy} className="flex items-center gap-2 rounded-full bg-navy px-6 py-3 font-semibold text-white hover:bg-royal disabled:opacity-60"><Search className="h-5 w-5" /> {busy ? "Checking…" : "Verify status"}</button>
      {error && <p role="alert" className="rounded-lg bg-alert/10 p-3 font-medium text-alert">{error}</p>}
      {res && (
        <div className="rounded-lg border border-line bg-canvas p-4">
          <p className="font-semibold text-navy">{STATUS_LABEL[res.status] ?? res.status}</p>
          <p className="text-base text-ink/70">Submitted {new Date(res.submittedAt).toLocaleDateString("en-IN")} · Updated {new Date(res.updatedAt).toLocaleDateString("en-IN")}</p>
          {res.note && <p className="mt-2">{res.note}</p>}
        </div>
      )}
    </form>
  );
}
