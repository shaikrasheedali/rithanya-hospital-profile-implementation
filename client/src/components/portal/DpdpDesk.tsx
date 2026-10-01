"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eraser, FileCheck2, Paperclip, ScanSearch, XCircle } from "lucide-react";
import { Badge, Btn, Card, Empty, Field, Modal, PageHeader, api, inputCls, useToast } from "@/components/portal/ui";
import { formatDate } from "@/lib/utils";

export type DpdpDTO = {
  id: string; trackingCode: string; fullName: string; phoneNumber: string; identificationRef: string | null; recordsNature: string;
  requestDetails: string; identityProofFile: string | null; status: string; resolutionNotes: string | null; createdAt: string;
};
type Match = { id: string; uhid: string; name: string; type: string; createdAt: string };

const TONE: Record<string, "amber" | "red" | "green" | "slate"> = { PENDING: "amber", MATCHED_AND_ERASED: "green", MANUALLY_RESOLVED: "slate", REJECTED: "red" };

export function DpdpDesk({ rows }: { rows: DpdpDTO[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useState("PENDING");
  const [sel, setSel] = useState<DpdpDTO | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const list = rows.filter((r) => f === "ALL" || r.status === f);

  async function run(action: string) {
    if (!sel) return;
    setBusy(true);
    const r = await api<{ matches?: Match[]; erased?: number }>(`/api/portal/r/dpdp/${sel.id}`, "POST", { action, notes });
    setBusy(false);
    if (!r.ok) return toast(r.error || "Action failed", "err");
    if (action === "match") return setMatches(r.data?.matches ?? []);
    toast(action === "erase" ? `${r.data?.erased} record(s) erased` : "Request updated");
    setSel(null);
    setMatches(null);
    window.location.reload();
  }

  return (
    <>
      <PageHeader title="DPDP data erasure desk" desc="Citizen erasure requests. The matcher requires a registered mobile number match AND a name or UHID match before any record can be erased; erasure cascades to stays and vitals." />
      <div className="mb-4 flex flex-wrap gap-2">
        {["PENDING", "MATCHED_AND_ERASED", "MANUALLY_RESOLVED", "REJECTED", "ALL"].map((s) => (
          <button key={s} onClick={() => setF(s)} aria-pressed={f === s} className={`rounded-full border px-4 py-1.5 font-medium ${f === s ? "border-royal bg-royal text-white" : "border-line bg-white hover:border-royal"}`}>{s === "ALL" ? "All" : s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} ({s === "ALL" ? rows.length : rows.filter((r) => r.status === s).length})</button>
        ))}
      </div>
      <Card>
        {list.length === 0 ? <Empty text="No requests in this state." /> : (
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-navy">{r.fullName} <Badge tone={TONE[r.status]}>{r.status.replace(/_/g, " ")}</Badge></p>
                  <p className="text-base text-ink/75">{r.phoneNumber}{r.identificationRef && ` · ${r.identificationRef}`} · {r.trackingCode} · {formatDate(r.createdAt, true)}</p>
                  <p className="mt-1 line-clamp-1 text-base">“{r.requestDetails}”</p>
                </div>
                <Btn variant={r.status === "PENDING" ? "primary" : "secondary"} onClick={() => { setSel(r); setMatches(null); setNotes(""); }}>{r.status === "PENDING" ? "Review" : "View"}</Btn>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {sel && (
        <Modal size="lg" title={`Request ${sel.trackingCode}`} onClose={() => setSel(null)}
          footer={sel.status === "PENDING" ? (
            <>
              <Btn variant="secondary" disabled={busy} onClick={() => run("reject")}><XCircle className="h-4 w-4" /> Dismiss</Btn>
              <Btn variant="secondary" disabled={busy} onClick={() => run("resolve")}><FileCheck2 className="h-4 w-4" /> Resolve manually</Btn>
              <Btn variant="danger" disabled={busy || !matches?.length} onClick={() => confirm(`Permanently erase ${matches?.length} patient record(s) with all stays and vitals? This cannot be undone.`) && run("erase")}><Eraser className="h-4 w-4" /> One-click cascade erasure</Btn>
            </>
          ) : undefined}>
          <dl className="grid gap-3 text-base sm:grid-cols-2">
            {[["Name", sel.fullName], ["Mobile", sel.phoneNumber], ["UHID / ref", sel.identificationRef || "—"], ["Records held", sel.recordsNature || "—"]].map(([k, v]) => <div key={k} className="rounded-lg bg-canvas p-3"><dt className="text-sm font-semibold text-ink/60">{k}</dt><dd className="font-semibold text-navy">{v}</dd></div>)}
            <div className="rounded-lg bg-canvas p-3 sm:col-span-2"><dt className="text-sm font-semibold text-ink/60">Reason</dt><dd>{sel.requestDetails}</dd></div>
          </dl>
          {sel.identityProofFile && <a href={`/api/portal/dpdp-proof/${sel.identityProofFile}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 font-semibold text-royal hover:text-alert"><Paperclip className="h-4 w-4" /> View identity proof</a>}
          {sel.status !== "PENDING" ? (
            <p className="mt-5 rounded-lg border border-line bg-canvas p-4 text-base"><strong>Resolution:</strong> {sel.resolutionNotes}</p>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <Btn variant="secondary" onClick={() => run("match")} disabled={busy}><ScanSearch className="h-4 w-4" /> Run automated EMR record matcher</Btn>
                {matches && (
                  <div className="mt-3 rounded-lg border border-line">
                    {matches.length === 0 ? <p className="p-4 text-base text-ink/70">No verified match found (phone and name/UHID must both match). Resolve manually or dismiss.</p> : (
                      <ul className="divide-y divide-line">{matches.map((m) => <li key={m.id} className="flex justify-between p-3 text-base"><span><strong>{m.uhid}</strong> · {m.name}</span><Badge>{m.type}</Badge></li>)}</ul>
                    )}
                  </div>
                )}
              </div>
              <Field label="Resolution notes (shown to the requester)"><textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
