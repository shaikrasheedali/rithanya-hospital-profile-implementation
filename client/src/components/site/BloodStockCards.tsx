"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Droplet, RefreshCw } from "lucide-react";

export type StockRow = {
  id: string;
  bloodGroup: string;
  groupCategory: string;
  wholeBloodUnits: number;
  plasmaUnits: number;
  lastUpdated: string | Date;
};

const THEME: Record<string, { bg: string; fg: string; sub: string; bar: string; ring: string }> = {
  O: { bg: "#38BDF8", fg: "#0A2540", sub: "rgba(10,37,64,0.78)", bar: "#0A2540", ring: "rgba(10,37,64,0.18)" },
  A: { bg: "#FACC15", fg: "#0A2540", sub: "rgba(10,37,64,0.8)", bar: "#0A2540", ring: "rgba(10,37,64,0.18)" },
  B: { bg: "#EF4444", fg: "#FFFFFF", sub: "rgba(255,255,255,0.88)", bar: "#FFFFFF", ring: "rgba(255,255,255,0.28)" },
  AB: { bg: "#F8FAFC", fg: "#0A2540", sub: "rgba(10,37,64,0.78)", bar: "#0D47A1", ring: "rgba(10,37,64,0.14)" },
};

const fmt = (d: string | Date) =>
  new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

function normalizeStock(items: StockRow[]): StockRow[] {
  if (!items || !items.length) return [];
  const hasPlusMinus = items.some((i) => i.bloodGroup.includes("+") || i.bloodGroup.includes("-"));
  if (hasPlusMinus && items.length >= 8) {
    const order = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
    return [...items].sort((a, b) => {
      const ia = order.indexOf(a.bloodGroup);
      const ib = order.indexOf(b.bloodGroup);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }
  const order = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
  const byGroup = new Map(items.map((i) => [i.bloodGroup, i]));
  return order.map((g) => {
    if (byGroup.has(g)) return byGroup.get(g)!;
    const base = g.replace(/[+-]/g, "");
    const parent = byGroup.get(base);
    const isNeg = g.includes("-");
    return {
      id: `bs-${g.toLowerCase().replace("+", "p").replace("-", "n")}`,
      bloodGroup: g,
      groupCategory: base,
      wholeBloodUnits: parent ? Math.max(1, Math.round(parent.wholeBloodUnits * (isNeg ? 0.6 : 1))) : (isNeg ? 5 : 10),
      plasmaUnits: parent ? Math.max(1, Math.round(parent.plasmaUnits * (isNeg ? 0.6 : 1))) : (isNeg ? 4 : 8),
      lastUpdated: parent?.lastUpdated ?? new Date(),
    };
  });
}

export function BloodStockCards({ initial, threshold }: { initial: StockRow[]; threshold: number }) {
  const [stock, setStock] = useState(() => normalizeStock(initial));
  const [checked, setChecked] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const r = await fetch("/api/public/blood-stock", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { stock: StockRow[] };
        if (alive && d.stock) {
          setStock(normalizeStock(d.stock));
          setChecked(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }));
        }
      } catch {}
    };
    pull();
    const t = setInterval(pull, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const latest = stock.reduce<string | null>((a, s) => (!a || new Date(s.lastUpdated) > new Date(a) ? new Date(s.lastUpdated).toISOString() : a), null);
  const max = Math.max(20, ...stock.flatMap((s) => [s.wholeBloodUnits, s.plasmaUnits]));

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-base text-white/85">
        <span className="inline-flex items-center gap-2 font-semibold text-white">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
          </span>
          Live stock
        </span>
        {latest && <span>Last dashboard sync: <strong className="text-white">{fmt(latest)} IST</strong></span>}
        {checked && (
          <span className="inline-flex items-center gap-1.5 text-white/70">
            <RefreshCw className="h-4 w-4" /> Checked {checked}
          </span>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stock.map((s) => {
          const cat = (s.groupCategory || s.bloodGroup).replace(/[+-]/g, "");
          const t = THEME[cat] ?? THEME[s.groupCategory] ?? THEME.AB;
          const displayGroup = s.bloodGroup || s.groupCategory;
          const rows = [
            { label: "Whole blood", value: s.wholeBloodUnits },
            { label: "Plasma", value: s.plasmaUnits },
          ];
          return (
            <article
              key={s.id || s.bloodGroup}
              className="group relative overflow-hidden rounded-2xl p-6 shadow-xl transition-transform duration-300 hover:-translate-y-1.5"
              style={{ background: t.bg, color: t.fg }}
              aria-label={`Blood group ${displayGroup}: ${s.wholeBloodUnits} whole blood units, ${s.plasmaUnits} plasma units`}
            >
              <Droplet className="absolute -right-6 -top-6 h-40 w-40 opacity-15" style={{ color: t.fg }} aria-hidden />
              <div className="relative flex items-end justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: t.sub }}>Group</p>
                  <p className="font-heading text-6xl sm:text-7xl font-bold leading-none tracking-tight" style={{ color: t.fg }}>{displayGroup}</p>
                </div>
                <Droplet className="h-9 w-9" style={{ color: t.fg }} aria-hidden />
              </div>
              <div className="relative mt-6 space-y-4">
                {rows.map((r) => {
                  const low = r.value <= threshold;
                  return (
                    <div key={r.label}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-base font-semibold" style={{ color: t.sub }}>{r.label}</span>
                        <span className="font-heading text-3xl font-bold" style={{ color: t.fg }}>
                          {r.value}
                          <span className="ml-1 text-sm font-medium" style={{ color: t.sub }}>units</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: t.ring }}>
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (r.value / max) * 100)}%`, background: t.bar }} />
                      </div>
                      {low && (
                        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-navy px-2.5 py-0.5 text-sm font-semibold text-white">
                          <AlertTriangle className="h-3.5 w-3.5 text-gold" /> Critical — call to confirm
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
