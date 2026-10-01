"use client";

import { useMemo } from "react";
import type { VitalDTO } from "@/lib/emr";

type Key = "haemoglobin" | "fastingGlucose" | "postPrandialGlucose" | "hbA1c";
type Series = { key: Key; label: string; color: string };

const W = 640;
const H = 260;
const PAD_L = 52;
const PAD_R = 24;
const PAD_T = 20;
const PAD_B = 44;

function bounds(values: number[], floor?: number[], ceil?: number[]) {
  const all = values.filter((v) => Number.isFinite(v));
  if (!all.length) return { min: 0, max: 10 };
  const lo = Math.min(...all, ...(floor ?? [Infinity]));
  const hi = Math.max(...all, ...(ceil ?? [-Infinity]));
  const pad = (hi - lo || hi * 0.1 || 1) * 0.12;
  return { min: Math.max(0, Math.floor(lo - pad)), max: Math.ceil(hi + pad) };
}

function Chart({ title, subtitle, series, data, band, refMin, refMax }: { title: string; subtitle: string; series: Series[]; data: VitalDTO[]; band?: [number, number]; refMin?: number[]; refMax?: number[] }) {
  const values = series.flatMap((s) => data.map((d) => d[s.key]).filter((v): v is number => typeof v === "number"));
  const b = useMemo(() => bounds(values, refMin, refMax), [values, refMin, refMax]);
  const x = (i: number) => PAD_L + (i / Math.max(data.length - 1, 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => H - PAD_B - ((v - b.min) / (b.max - b.min || 1)) * (H - PAD_T - PAD_B);
  const ticks = Array.from({ length: 5 }, (_, i) => b.min + ((b.max - b.min) * i) / 4);
  const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const labelIdx = data.length <= 4 ? data.map((_, i) => i) : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  const path = (key: Key) => {
    let d = "";
    let pen = false;
    data.forEach((p, i) => {
      const v = p[key];
      if (typeof v !== "number") {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };

  return (
    <figure className="rounded-xl border border-line bg-white p-5">
      <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <span>
          <span className="block text-base font-semibold text-navy">{title}</span>
          <span className="text-sm text-ink/65">{subtitle}</span>
        </span>
        <span className="flex flex-wrap gap-4 text-sm font-medium">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: s.color }} /> {s.label}</span>
          ))}
        </span>
      </figcaption>
      {data.length === 0 ? (
        <p className="py-16 text-center text-base text-ink/60">No vitals logged yet.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={`${title} chart`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="#E2E8F0" strokeWidth="1" />
              <text x={PAD_L - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#475569">{Math.round(t * 10) / 10}</text>
            </g>
          ))}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#CBD5E1" />
          <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#CBD5E1" />
          {band && (
            <rect x={PAD_L} y={y(band[1])} width={W - PAD_L - PAD_R} height={Math.max(0, y(band[0]) - y(band[1]))} fill="#10B981" fillOpacity="0.09">
              <title>{`Target range ${band[0]}–${band[1]}`}</title>
            </rect>
          )}
          {series.map((s) => (
            <g key={s.key}>
              <path d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {data.map((d, i) => {
                const v = d[s.key];
                return typeof v === "number" ? (
                  <circle key={d.id} cx={x(i)} cy={y(v)} r="4" fill={s.color} stroke="#fff" strokeWidth="1.5">
                    <title>{`${s.label}: ${v} (${dateLabel(d.recordedAt)})`}</title>
                  </circle>
                ) : null;
              })}
            </g>
          ))}
          {labelIdx.map((i) => (
            <text key={i} x={x(i)} y={H - PAD_B + 20} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize="12" fill="#475569">{dateLabel(data[i].recordedAt)}</text>
          ))}
        </svg>
      )}
    </figure>
  );
}

/** Auto-scaling longitudinal trajectories (bounds derived from each patient's own data range). */
export function TrajectoryGraphs({ vitals }: { vitals: VitalDTO[] }) {
  const sorted = useMemo(() => [...vitals].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()), [vitals]);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Chart
        title="Longitudinal blood glucose trends"
        subtitle="Fasting vs post-prandial (mg/dL) — green band: 70–140 target"
        data={sorted}
        series={[
          { key: "fastingGlucose", label: "Fasting", color: "#F59E0B" },
          { key: "postPrandialGlucose", label: "PP", color: "#F43F5E" },
        ]}
        band={[70, 140]}
        refMin={[70]}
        refMax={[180]}
      />
      <Chart
        title="Haemoglobin & glycated trajectory"
        subtitle="Hb (g/dL) and HbA1c (%)"
        data={sorted}
        series={[
          { key: "haemoglobin", label: "Hb", color: "#0284C7" },
          { key: "hbA1c", label: "HbA1c", color: "#9333EA" },
        ]}
        refMin={[5]}
        refMax={[14]}
      />
    </div>
  );
}
