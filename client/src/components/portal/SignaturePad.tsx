"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export const SIG_W = 480;
export const SIG_H = 160;

/** Digital signature pad. Emits vector path strings (no raster) for secure storage. */
export function SignaturePad({ onChange }: { onChange: (paths: string[]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const paths = useRef<number[][][]>([]);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const ctx = () => ref.current?.getContext("2d") ?? null;
  const pt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * SIG_W), Math.round(((e.clientY - r.top) / r.height) * SIG_H)];
  };

  useEffect(() => {
    const c = ctx();
    if (!c) return;
    c.lineWidth = 2.4;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "#0A2540";
  }, []);

  const emit = () => onChange(paths.current.map((s) => s.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ")));

  function down(e: React.PointerEvent) {
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pt(e);
    paths.current.push([p]);
    const c = ctx();
    c?.beginPath();
    c?.moveTo(p[0], p[1]);
    c?.lineTo(p[0] + 0.1, p[1] + 0.1);
    c?.stroke();
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const p = pt(e);
    paths.current[paths.current.length - 1].push(p);
    const c = ctx();
    c?.lineTo(p[0], p[1]);
    c?.stroke();
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    setEmpty(false);
    emit();
  }
  function clear() {
    paths.current = [];
    ctx()?.clearRect(0, 0, SIG_W, SIG_H);
    setEmpty(true);
    onChange([]);
  }

  return (
    <div>
      <canvas
        ref={ref}
        width={SIG_W}
        height={SIG_H}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label="Signature drawing area"
        className="w-full touch-none rounded-lg border-2 border-dashed border-line bg-white"
        style={{ aspectRatio: `${SIG_W}/${SIG_H}` }}
      />
      <div className="mt-2 flex items-center justify-between text-sm text-ink/65">
        <span>{empty ? "Sign above with mouse, finger or stylus" : "Signature captured"}</span>
        <button type="button" onClick={clear} className="flex items-center gap-1 font-semibold text-royal hover:text-alert"><Eraser className="h-4 w-4" /> Clear</button>
      </div>
    </div>
  );
}
