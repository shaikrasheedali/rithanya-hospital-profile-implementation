"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Droplet, Minus, Plus, RefreshCw, Save } from "lucide-react";
import { Btn, PageHeader, api, useToast } from "@/components/portal/ui";
import { formatDate } from "@/lib/utils";

type Row = {
  bloodGroup: string;
  groupCategory: string;
  wholeBloodUnits: number;
  packedCellsUnits: number;
  plasmaUnits: number;
  lastUpdated: string;
};

const THEME: Record<string, { bg: string; fg: string }> = {
  O: { bg: "#38BDF8", fg: "#0A2540" },
  A: { bg: "#FACC15", fg: "#0A2540" },
  B: { bg: "#EF4444", fg: "#FFFFFF" },
  AB: { bg: "#F8FAFC", fg: "#0A2540" },
};

const ORDER = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"] as const;

function Stepper({ label, value, onChange, fg }: { label: string; value: number; onChange: (n: number) => void; fg: string }) {
  return (
    <div>
      <p className="text-sm font-semibold sm:text-base leading-tight" style={{ color: fg }}>{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="rounded-lg bg-white/90 p-2 text-navy shadow hover:bg-white"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          aria-label={label}
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
          className="w-20 rounded-lg border-0 bg-white/90 py-1.5 text-center font-heading text-2xl font-bold text-navy shadow"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(value + 1)}
          className="rounded-lg bg-white/90 p-2 text-navy shadow hover:bg-white"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function normalizeRows(items: Row[]): Row[] {
  const map = new Map<string, Row>();
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item && item.bloodGroup) {
        map.set(item.bloodGroup, item);
      }
    }
  }
  return ORDER.map((g) => {
    const existing = map.get(g);
    const cat = g.replace(/[+-]/g, "");
    return {
      bloodGroup: g,
      groupCategory: cat,
      wholeBloodUnits: existing?.wholeBloodUnits ?? 0,
      packedCellsUnits: existing?.packedCellsUnits ?? 0,
      plasmaUnits: existing?.plasmaUnits ?? 0,
      lastUpdated: existing?.lastUpdated ? String(existing.lastUpdated) : "",
    };
  });
}

export function BloodBankManager({ initial, threshold }: { initial: Row[]; threshold: number }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState(() => normalizeRows(initial));
  const [busy, setBusy] = useState(false);
  const initialNormalized = normalizeRows(initial);
  const dirty =
    JSON.stringify(rows.map((r) => [r.bloodGroup, r.wholeBloodUnits, r.packedCellsUnits, r.plasmaUnits])) !==
    JSON.stringify(initialNormalized.map((r) => [r.bloodGroup, r.wholeBloodUnits, r.packedCellsUnits, r.plasmaUnits]));
  const latest = initial.reduce<string>((a, r) => (r.lastUpdated > a ? r.lastUpdated : a), "");

  const set = (g: string, key: "wholeBloodUnits" | "packedCellsUnits" | "plasmaUnits", v: number) =>
    setRows((rs) => rs.map((r) => (r.bloodGroup === g ? { ...r, [key]: v } : r)));

  async function save() {
    for (const x of rows) {
      if (
        !Number.isFinite(x.wholeBloodUnits) || x.wholeBloodUnits < 0 ||
        !Number.isFinite(x.packedCellsUnits) || x.packedCellsUnits < 0 ||
        !Number.isFinite(x.plasmaUnits) || x.plasmaUnits < 0
      ) {
        toast(`Units for ${x.bloodGroup} must be 0 or more.`, "err");
        return;
      }
    }
    setBusy(true);
    const r = await api("/api/portal/r/bloodbank", "POST", {
      stocks: rows.map((x) => ({
        bloodGroup: x.bloodGroup,
        wholeBloodUnits: Math.trunc(x.wholeBloodUnits),
        packedCellsUnits: Math.trunc(x.packedCellsUnits),
        plasmaUnits: Math.trunc(x.plasmaUnits),
      })),
    });
    setBusy(false);
    if (!r.ok) return toast(r.error || "Save failed — please try again.", "err");
    toast("Stock saved — public website is now in sync");
    setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <>
      <PageHeader
        title="Live blood bank stock"
        desc={`Update Whole Blood (WB), Packed Cells (PC / PRBC), and Fresh Frozen Plasma (FFP) units per group. Saving publishes instantly to the public home page (refreshes every 30 s). Critical alert threshold: ${threshold} units (change in System → Master identity).`}
      >
        <p className="flex items-center gap-2 text-base text-ink/70">
          <RefreshCw className="h-4 w-4" /> Last sync: {latest ? formatDate(latest, true) : "—"}
        </p>
        <Btn onClick={save} disabled={busy || !dirty}>
          <Save className="h-5 w-5" /> {busy ? "Saving…" : "Save & sync to website"}
        </Btn>
      </PageHeader>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((r) => {
          const cat = (r.groupCategory || r.bloodGroup).replace(/[+-]/g, "");
          const t = THEME[cat] ?? THEME[r.groupCategory] ?? THEME.AB;
          const displayGroup = r.bloodGroup || r.groupCategory;
          return (
            <section
              key={r.bloodGroup}
              className="relative overflow-hidden rounded-2xl border border-black/5 p-6 shadow-lg"
              style={{ background: t.bg, color: t.fg }}
              aria-label={`Group ${displayGroup}`}
            >
              <Droplet className="absolute -right-5 -top-5 h-32 w-32 opacity-15" />
              <p className="font-heading text-6xl font-bold leading-none">{displayGroup}</p>
              <p className="mb-5 mt-1 text-sm font-semibold uppercase tracking-widest opacity-80">Blood group</p>
              <div className="space-y-4">
                <Stepper
                  label="WB: Whole Blood"
                  value={r.wholeBloodUnits}
                  onChange={(v) => set(r.bloodGroup, "wholeBloodUnits", v)}
                  fg={t.fg}
                />
                <Stepper
                  label="PC: Packed Cells (PRBC)"
                  value={r.packedCellsUnits}
                  onChange={(v) => set(r.bloodGroup, "packedCellsUnits", v)}
                  fg={t.fg}
                />
                <Stepper
                  label="FFP: Fresh Frozen Plasma"
                  value={r.plasmaUnits}
                  onChange={(v) => set(r.bloodGroup, "plasmaUnits", v)}
                  fg={t.fg}
                />
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
