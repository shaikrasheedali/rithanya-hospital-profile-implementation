"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle, RefreshCw, Upload } from "lucide-react";

/** WebRTC optical consent capture. Falls back to a file picker if no camera is available. */
export function ConsentCameraModal({ onCaptureComplete, onCancel }: { onCaptureComplete: (dataUrl: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access needs a secure (HTTPS) connection or a device with a camera.");
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (e) {
        setError("Unable to interface with the camera: " + (e instanceof Error ? e.message : "permission denied"));
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    setCaptured(c.toDataURL("image/webp", 0.85));
  }

  function commit() {
    if (!captured) return;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCaptureComplete(captured);
  }

  function fromFile(f: File | undefined) {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setCaptured(String(r.result));
    r.readAsDataURL(f);
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-navy/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Patient consent photo capture">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-navy px-5 py-4 text-white">
          <div className="flex items-center gap-2"><Camera className="h-5 w-5 text-sky-300" /><h3 className="font-heading text-base font-semibold !text-white">Patient consent photo</h3></div>
          <button onClick={onCancel} className="text-base text-white/75 hover:text-white">Dismiss</button>
        </div>
        <div className="flex flex-col items-center p-5">
          {error && !captured && (
            <div className="w-full">
              <div className="flex items-start gap-2 rounded-xl bg-red-50 p-4 text-base text-red-800"><AlertTriangle className="mt-0.5 h-5 w-5 flex-none" /><span>{error}</span></div>
              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-royal bg-canvas py-4 font-semibold text-royal hover:bg-royal/5">
                <Upload className="h-5 w-5" /> Use a photo from this device instead
                <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => fromFile(e.target.files?.[0])} />
              </label>
            </div>
          )}
          <div className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${error && !captured ? "hidden" : ""}`}>
            <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${captured ? "hidden" : ""}`} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {captured && <img src={captured} alt="Captured patient consent" className="h-full w-full object-cover" />}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <p className="mt-3 text-center text-sm text-ink/65">The photo records the patient’s consent at admission. It is stored privately and visible only to authorised staff.</p>
          <div className="mt-4 flex w-full justify-end gap-3">
            {!captured ? (
              !error && (
                <button type="button" disabled={!ready} onClick={capture} className="flex w-full items-center justify-center gap-2 rounded-xl bg-royal py-3 text-base font-semibold text-white hover:bg-navy disabled:opacity-50">
                  <Camera className="h-5 w-5" /> {ready ? "Capture photo" : "Starting camera…"}
                </button>
              )
            ) : (
              <>
                <button type="button" onClick={() => setCaptured(null)} className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-200"><RefreshCw className="h-5 w-5" /> Retake</button>
                <button type="button" onClick={commit} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white hover:bg-emerald-700"><CheckCircle className="h-5 w-5" /> Save consent</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
