"use client";

import { useMemo } from "react";
import type { VitalDTO } from "@/lib/emr";

type Key = "haemoglobin" | "fastingGlucose" | "postPrandialGlucose" | "hbA1c" | "spO2" | "pulse" | "bpSystolic" | "bpDiastolic" | "serumFerritin";
type Series = { key: Key; label: string; color: string; unit?: string };

const W = 640;
const H = 270;
const PAD_L = 54;
const PAD_R = 24;
const PAD_T = 28;
const PAD_B = 44;

function bounds(values: number[], floor?: number[], ceil?: number[]) {
  const all = values.filter((v) => Number.isFinite(v));
  if (!all.length) return { min: 0, max: 10 };
  const lo = Math.min(...all, ...(floor ?? [Infinity]));
  const hi = Math.max(...all, ...(ceil ?? [-Infinity]));
  const pad = (hi - lo || hi * 0.1 || 1) * 0.12;
  return { min: Math.max(0, Math.floor(lo - pad)), max: Math.ceil(hi + pad) };
}

function dateLabel(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

/** Standard single-axis longitudinal chart with optional target band */
function StandardChart({
  title,
  subtitle,
  series,
  data,
  band,
  refMin,
  refMax,
  unit,
}: {
  title: string;
  subtitle: string;
  series: Series[];
  data: VitalDTO[];
  band?: [number, number];
  refMin?: number[];
  refMax?: number[];
  unit?: string;
}) {
  const values = series.flatMap((s) => data.map((d) => d[s.key]).filter((v): v is number => typeof v === "number"));
  const b = useMemo(() => bounds(values, refMin, refMax), [values, refMin, refMax]);
  const x = (i: number) => PAD_L + (i / Math.max(data.length - 1, 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => H - PAD_B - ((v - b.min) / (b.max - b.min || 1)) * (H - PAD_T - PAD_B);
  const ticks = Array.from({ length: 5 }, (_, i) => b.min + ((b.max - b.min) * i) / 4);
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
    <figure className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="block text-base font-bold text-navy">{title}</span>
          <span className="text-sm text-ink/65">{subtitle}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-ink/80">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      </figcaption>
      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-ink/60">No vitals logged yet.</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={`${title} chart`}>
          {/* Grid lines and Left Y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="#F1F5F9" strokeWidth="1" />
              <text x={PAD_L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fontWeight="500" fill="#64748B">
                {Math.round(t)}
                {unit ? ` ${unit}` : ""}
              </text>
            </g>
          ))}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#CBD5E1" strokeWidth="1.2" />
          <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#CBD5E1" strokeWidth="1.2" />

          {/* Normal Target Band */}
          {band && (
            <g>
              <rect
                x={PAD_L}
                y={y(band[1])}
                width={W - PAD_L - PAD_R}
                height={Math.max(0, y(band[0]) - y(band[1]))}
                fill="#10B981"
                fillOpacity="0.12"
              />
              <text x={W - PAD_R - 6} y={y(band[1]) + 13} textAnchor="end" fontSize="10" fontWeight="600" fill="#059669">
                Target {band[0]}–{band[1]} mg/dL
              </text>
            </g>
          )}

          {/* Series lines & points */}
          {series.map((s) => (
            <g key={s.key}>
              <path d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
              {data.map((d, i) => {
                const v = d[s.key];
                return typeof v === "number" ? (
                  <g key={d.id} className="group cursor-pointer">
                    <circle cx={x(i)} cy={y(v)} r="4.5" fill={s.color} stroke="#FFFFFF" strokeWidth="2" />
                    <title>{`${s.label}: ${v} ${unit ?? "mg/dL"} (${dateLabel(d.recordedAt)})`}</title>
                  </g>
                ) : null;
              })}
            </g>
          ))}

          {/* X axis date labels */}
          {labelIdx.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - PAD_B + 20}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              fontSize="11"
              fontWeight="500"
              fill="#64748B"
            >
              {dateLabel(data[i].recordedAt)}
            </text>
          ))}
        </svg>
      )}
    </figure>
  );
}

/** Adaptive Dual-Axis Scale Chart: Left axis for Haemoglobin (g/dL), Right axis for HbA1c (%) */
function DualAxisChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: VitalDTO[];
}) {
  const DUAL_PAD_L = 58;
  const DUAL_PAD_R = 54;

  const hbValues = data.map((d) => d.haemoglobin).filter((v): v is number => typeof v === "number");
  const a1cValues = data.map((d) => d.hbA1c).filter((v): v is number => typeof v === "number");

  const bHb = useMemo(() => bounds(hbValues, [7], [16]), [hbValues]);
  const bA1c = useMemo(() => bounds(a1cValues, [4], [10]), [a1cValues]);

  const x = (i: number) => DUAL_PAD_L + (i / Math.max(data.length - 1, 1)) * (W - DUAL_PAD_L - DUAL_PAD_R);
  const yHb = (v: number) => H - PAD_B - ((v - bHb.min) / (bHb.max - bHb.min || 1)) * (H - PAD_T - PAD_B);
  const yA1c = (v: number) => H - PAD_B - ((v - bA1c.min) / (bA1c.max - bA1c.min || 1)) * (H - PAD_T - PAD_B);

  const ticksHb = Array.from({ length: 5 }, (_, i) => bHb.min + ((bHb.max - bHb.min) * i) / 4);
  const ticksA1c = Array.from({ length: 5 }, (_, i) => bA1c.min + ((bA1c.max - bA1c.min) * i) / 4);

  const labelIdx = data.length <= 4 ? data.map((_, i) => i) : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  const pathHb = useMemo(() => {
    let d = "";
    let pen = false;
    data.forEach((p, i) => {
      const v = p.haemoglobin;
      if (typeof v !== "number") {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"} ${x(i).toFixed(1)} ${yHb(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  }, [data, bHb]);

  const pathA1c = useMemo(() => {
    let d = "";
    let pen = false;
    data.forEach((p, i) => {
      const v = p.hbA1c;
      if (typeof v !== "number") {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"} ${x(i).toFixed(1)} ${yA1c(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  }, [data, bA1c]);

  return (
    <figure className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="block text-base font-bold text-navy">{title}</span>
          <span className="text-sm text-ink/65">{subtitle}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-sm font-semibold">
          <span className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-800">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-600" /> Left Axis: Hb (g/dL)
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-purple-800">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-600" /> Right Axis: HbA1c (%)
          </span>
        </div>
      </figcaption>

      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-ink/60">No vitals logged yet.</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={`${title} dual axis chart`}>
          {/* Horizontal gridlines */}
          {ticksHb.map((t, idx) => (
            <line
              key={t}
              x1={DUAL_PAD_L}
              x2={W - DUAL_PAD_R}
              y1={yHb(t)}
              y2={yHb(t)}
              stroke={idx === 0 ? "#CBD5E1" : "#F1F5F9"}
              strokeWidth="1"
            />
          ))}

          {/* Left Y Axis (Haemoglobin - Sky Blue) */}
          <line x1={DUAL_PAD_L} y1={PAD_T} x2={DUAL_PAD_L} y2={H - PAD_B} stroke="#0284C7" strokeWidth="1.5" />
          <text x={DUAL_PAD_L - 6} y={PAD_T - 10} textAnchor="end" fontSize="11" fontWeight="700" fill="#0284C7">
            Hb (g/dL)
          </text>
          {ticksHb.map((t) => (
            <text key={`hb-${t}`} x={DUAL_PAD_L - 8} y={yHb(t) + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="#0284C7">
              {t.toFixed(1)}
            </text>
          ))}

          {/* Right Y Axis (HbA1c - Royal Purple) */}
          <line x1={W - DUAL_PAD_R} y1={PAD_T} x2={W - DUAL_PAD_R} y2={H - PAD_B} stroke="#9333EA" strokeWidth="1.5" />
          <text x={W - DUAL_PAD_R + 6} y={PAD_T - 10} textAnchor="start" fontSize="11" fontWeight="700" fill="#9333EA">
            HbA1c (%)
          </text>
          {ticksA1c.map((t) => (
            <text key={`a1c-${t}`} x={W - DUAL_PAD_R + 8} y={yA1c(t) + 4} textAnchor="start" fontSize="11" fontWeight="600" fill="#9333EA">
              {t.toFixed(1)}%
            </text>
          ))}

          {/* Bottom X Axis */}
          <line x1={DUAL_PAD_L} y1={H - PAD_B} x2={W - DUAL_PAD_R} y2={H - PAD_B} stroke="#CBD5E1" strokeWidth="1.2" />

          {/* Haemoglobin Series (Left Axis - Blue) */}
          <path d={pathHb} fill="none" stroke="#0284C7" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((d, i) => {
            const v = d.haemoglobin;
            return typeof v === "number" ? (
              <g key={`hb-pt-${d.id}`} className="cursor-pointer">
                <circle cx={x(i)} cy={yHb(v)} r="4.5" fill="#0284C7" stroke="#FFFFFF" strokeWidth="2" />
                <title>{`Haemoglobin: ${v} g/dL (Ref: 11.5–17.5) [${dateLabel(d.recordedAt)}]`}</title>
              </g>
            ) : null;
          })}

          {/* HbA1c Series (Right Axis - Purple) */}
          <path d={pathA1c} fill="none" stroke="#9333EA" strokeWidth="2.75" strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((d, i) => {
            const v = d.hbA1c;
            return typeof v === "number" ? (
              <g key={`a1c-pt-${d.id}`} className="cursor-pointer">
                <circle cx={x(i)} cy={yA1c(v)} r="4.5" fill="#9333EA" stroke="#FFFFFF" strokeWidth="2" />
                <title>{`HbA1c: ${v}% (Ref: 4.0–5.6) [${dateLabel(d.recordedAt)}]`}</title>
              </g>
            ) : null;
          })}

          {/* X axis date labels */}
          {labelIdx.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - PAD_B + 20}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              fontSize="11"
              fontWeight="500"
              fill="#64748B"
            >
              {dateLabel(data[i].recordedAt)}
            </text>
          ))}
        </svg>
      )}
    </figure>
  );
}

/** Auto-scaling longitudinal trajectories component with Adaptive Dual-Axis Scale */
export function TrajectoryGraphs({ vitals }: { vitals: VitalDTO[] }) {
  const sorted = useMemo(
    () => [...vitals].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()),
    [vitals]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <StandardChart
        title="Longitudinal Blood Glucose Trends"
        subtitle="Fasting vs PP (mg/dL) · Target Normal Range: 70–140 mg/dL"
        data={sorted}
        series={[
          { key: "fastingGlucose", label: "Fasting Glucose", color: "#F59E0B" },
          { key: "postPrandialGlucose", label: "PP Glucose", color: "#F43F5E" },
        ]}
        band={[70, 140]}
        refMin={[70]}
        refMax={[180]}
        unit="mg/dL"
      />
      <DualAxisChart
        title="Haemoglobin & Glycated Trajectory"
        subtitle="Adaptive Dual-Axis Scale · Calibrated for clinical precision"
        data={sorted}
      />
    </div>
  );
}
