"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Trash2 } from "lucide-react";
import { Badge, Btn, Card, Empty, PageHeader, api, inputCls, useToast } from "@/components/portal/ui";
import { formatDate, telHref } from "@/lib/utils";

type A = { id: string; fullName: string; phone: string; department: string; preferredDate: string; message: string; source: string; status: string; createdAt: string };
const TONE: Record<string, "blue" | "green" | "slate" | "red"> = { NEW: "blue", CONFIRMED: "green", COMPLETED: "slate", CANCELLED: "red" };

export function AppointmentsDesk({ rows = [] }: { rows?: A[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useState("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const safeRows = rows ?? [];
  const list = safeRows.filter((r) => f === "ALL" || r.status === f);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    const r = await api(`/api/portal/r/appointments/${id}`, "PUT", { status });
    setBusyId(null);
    if (!r.ok) return toast(r.error || "Update failed — please try again.", "err");
    toast(`Appointment marked ${status.toLowerCase()}`);
    setTimeout(() => window.location.reload(), 1200);
  }
  async function del(id: string) {
    if (!confirm("Delete this request?")) return;
    setBusyId(id);
    const r = await api(`/api/portal/r/appointments/${id}`, "DELETE");
    setBusyId(null);
    if (!r.ok) return toast(r.error || "Delete failed — please try again.", "err");
    toast("Appointment request deleted");
    setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <>
      <PageHeader title="Appointment requests" desc="Requests from the website hero, contact form and Thalassemia daycare CTA. Call back to confirm the slot." />
      <div className="mb-4 flex flex-wrap gap-2">
        {["ALL", "NEW", "CONFIRMED", "COMPLETED", "CANCELLED"].map((s) => (
          <button key={s} onClick={() => setF(s)} aria-pressed={f === s} className={`rounded-full border px-4 py-1.5 font-medium ${f === s ? "border-royal bg-royal text-white" : "border-line bg-white hover:border-royal"}`}>{s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} ({s === "ALL" ? safeRows.length : safeRows.filter((r) => r.status === s).length})</button>
        ))}
      </div>
      <Card>
        {list.length === 0 ? <Empty text="No requests." /> : (
          <ul className="divide-y divide-line">
            {list.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-navy">{a.fullName} <Badge tone={TONE[a.status]}>{a.status}</Badge> <Badge tone={a.source === "THALASSEMIA" ? "red" : "purple"}>{a.source}</Badge></p>
                  <p className="mt-1 text-base">{a.department || "General consultation"}{a.preferredDate && ` · preferred ${a.preferredDate}`}</p>
                  {a.message && <p className="mt-1 text-base text-ink/75">“{a.message}”</p>}
                  <p className="mt-1 text-sm text-ink/60">{formatDate(a.createdAt, true)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={telHref(a.phone)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"><Phone className="h-4 w-4" /> {a.phone}</a>
                  <select aria-label="Status" value={a.status} disabled={busyId === a.id} onChange={(e) => setStatus(a.id, e.target.value)} className={`${inputCls} !w-auto`}>{["NEW", "CONFIRMED", "COMPLETED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}</select>
                  <Btn small variant="ghost" disabled={busyId === a.id} onClick={() => del(a.id)} aria-label="Delete" className="!text-alert"><Trash2 className="h-4 w-4" /></Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
