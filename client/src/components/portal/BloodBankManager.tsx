"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Droplet, Minus, Plus, RefreshCw, Save } from "lucide-react";
import { Btn, PageHeader, api, useToast } from "@/components/portal/ui";
import { formatDate } from "@/lib/utils";

type Row = { bloodGroup: string; groupCategory: string; wholeBloodUnits: number; plasmaUnits: number; lastUpdated: string };

const THEME: Record<string, { bg: string; fg: string }> = {
  O: { bg: "#38BDF8", fg: "#0A2540" },
  A: { bg: "#FACC15", fg: "#0A2540" },
  B: { bg: "#EF4444", fg: "#FFFFFF" },
  AB: { bg: "#F8FAFC", fg: "#0A2540" },
};

function Stepper({ label, value, onChange, low, fg }: { label: string; value: number; onChange: (n: number) => void; low: boolean; fg: string }) {
  return (
    <div>
      <p className="text-base font-semibold" style={{ color: fg }}>{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="rounded-lg bg-white/90 p-2.5 text-navy shadow hover:bg-white"><Minus className="h-4 w-4" /></button>
        <input aria-label={label} type="number" min={0} value={value} onChange={(e) => onChange(Math.max(0, Math.trunc(Number(e.target.value) || 0)))} className="w-20 rounded-lg border-0 bg-white/90 py-2 text-center font-heading text-2xl font-bold text-navy shadow" />
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(value + 1)} className="rounded-lg bg-white/90 p-2.5 text-navy shadow hover:bg-white"><Plus className="h-4 w-4" /></button>
      </div>
      {low && <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-navy px-2.5 py-0.5 text-sm font-semibold text-white"><AlertTriangle className="h-3.5 w-3.5 text-gold" /> Below threshold</p>}
    </div>
  );
}

export function BloodBankManager({ initial, threshold }: { initial: Row[]; threshold: number }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(rows.map((r) => [r.bloodGroup, r.wholeBloodUnits, r.plasmaUnits])) !== JSON.stringify(initial.map((r) => [r.bloodGroup, r.wholeBloodUnits, r.plasmaUnits]));
  const latest = initial.reduce<string>((a, r) => (r.lastUpdated > a ? r.lastUpdated : a), "");

  const set = (g: string, key: "wholeBloodUnits" | "plasmaUnits", v: number) => setRows((rs) => rs.map((r) => (r.bloodGroup === g ? { ...r, [key]: v } : r)));

  async function save() {
    setBusy(true);
    const r = await api("/api/portal/r/bloodbank", "POST", { stocks: rows.map((x) => ({ bloodGroup: x.bloodGroup, wholeBloodUnits: x.wholeBloodUnits, plasmaUnits: x.plasmaUnits })) });
    setBusy(false);
    if (!r.ok) return toast(r.error || "Save failed", "err");
    toast("Stock saved — public website is now in sync");
    window.location.reload();
  }

  return (
    <>
      <PageHeader title="Live blood bank stock" desc={`Update whole blood and plasma units per group. Saving publishes instantly to the public home page (refreshes every 30 s). Critical alert threshold: ${threshold} units (change in System → Master identity).`}>
        <p className="flex items-center gap-2 text-base text-ink/70"><RefreshCw className="h-4 w-4" /> Last sync: {latest ? formatDate(latest, true) : "—"}</p>
        <Btn onClick={save} disabled={busy || !dirty}><Save className="h-5 w-5" /> {busy ? "Saving…" : "Save & sync to website"}</Btn>
      </PageHeader>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((r) => {
          const t = THEME[r.groupCategory] ?? THEME.AB;
          return (
            <section key={r.bloodGroup} className="relative overflow-hidden rounded-2xl border border-black/5 p-6 shadow-lg" style={{ background: t.bg, color: t.fg }} aria-label={`Group ${r.groupCategory}`}>
              <Droplet className="absolute -right-5 -top-5 h-32 w-32 opacity-15" />
              <p className="font-heading text-6xl font-bold leading-none">{r.groupCategory}</p>
              <p className="mb-5 mt-1 text-sm font-semibold uppercase tracking-widest opacity-80">Blood group</p>
              <div className="space-y-5">
                <Stepper label="Whole blood units" value={r.wholeBloodUnits} onChange={(v) => set(r.bloodGroup, "wholeBloodUnits", v)} low={r.wholeBloodUnits <= threshold} fg={t.fg} />
                <Stepper label="Plasma units" value={r.plasmaUnits} onChange={(v) => set(r.bloodGroup, "plasmaUnits", v)} low={r.plasmaUnits <= threshold} fg={t.fg} />
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
