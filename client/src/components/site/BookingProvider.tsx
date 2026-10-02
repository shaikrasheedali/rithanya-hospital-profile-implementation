"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

type Ctx = { open: (department?: string, source?: string) => void };
const BookingCtx = createContext<Ctx>({ open: () => {} });
export const useBooking = () => useContext(BookingCtx);

export const DEPARTMENTS = [
  "Diabetology & Endocrinology",
  "General & Internal Medicine",
  "Thalassemia & Sickle Cell Daycare",
  "Diagnostics & Pathology",
  "Senior Citizen Wellness",
  "Visiting Specialties",
];

export function AppointmentForm({
  defaultDepartment = "",
  source = "WEBSITE",
  onDone,
  compact = false,
}: {
  defaultDepartment?: string;
  source?: string;
  onDone?: () => void;
  compact?: boolean;
}) {
  const [f, setF] = useState({ fullName: "", phone: "", department: defaultDepartment, preferredDate: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const input =
    "w-full rounded-lg border border-line bg-white px-3.5 py-3 text-base text-ink focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = f.phone.replace(/\D/g, "");
    if (digits.length < 10) {
      const msg = "Please enter a valid 10-digit mobile number.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (f.preferredDate) {
      const today = new Date().toISOString().slice(0, 10);
      if (f.preferredDate < today) {
        const msg = "Preferred date cannot be in the past.";
        setError(msg);
        toast.error(msg);
        return;
      }
    }
    setState("busy");
    setError("");
    try {
      const res = await fetch("/api/public/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Could not submit — please try again.");
      setState("done");
      toast.success("Appointment request received. Our front desk will call you shortly.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not submit — please try again.";
      setError(msg);
      toast.error(msg);
      setState("idle");
    }
  }

  if (state === "done")
    return (
      <div className="py-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <h3 className="mt-3 text-xl font-semibold">Request received</h3>
        <p className="mt-1 text-ink/80">Our front desk will call you shortly to confirm your slot. For emergencies call +91 83285 81019.</p>
        {onDone && (
          <button onClick={onDone} className="mt-5 rounded-full bg-royal px-6 py-2.5 font-medium text-white hover:bg-alert">
            Close
          </button>
        )}
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-navy">Full name *</span>
          <input required minLength={2} className={input} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} autoComplete="name" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-navy">Mobile number *</span>
          <input required type="tel" inputMode="tel" pattern="[0-9+()\\-\\s]{10,15}" title="Enter a valid 10-digit mobile number" className={input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-navy">Department</span>
          <select className={input} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>
            <option value="">General consultation</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-navy">Preferred date</span>
          <input type="date" className={input} min={new Date().toISOString().slice(0, 10)} value={f.preferredDate} onChange={(e) => setF({ ...f, preferredDate: e.target.value })} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-navy">How can we help?</span>
        <textarea rows={3} className={input} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-alert/10 p-3 text-sm font-medium text-alert">
          {error}
        </p>
      )}
      <button
        disabled={state === "busy"}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-royal px-6 py-3.5 font-semibold text-white hover:bg-alert disabled:opacity-60"
      >
        <CalendarCheck className="h-5 w-5" /> {state === "busy" ? "Sending…" : "Request appointment"}
      </button>
    </form>
  );
}

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [dept, setDept] = useState("");
  const [source, setSource] = useState("WEBSITE");

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <BookingCtx.Provider
      value={{
        open: (d = "", s = "WEBSITE") => {
          setDept(d);
          setSource(s);
          setOpen(true);
        },
      }}
    >
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Book an appointment">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-line bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
            <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 hover:bg-canvas">
              <X className="h-5 w-5" />
            </button>
            <p className="text-sm font-semibold uppercase tracking-wider text-royal">Rapid OPD booking</p>
            <h2 className="mt-1 mb-5 text-2xl font-semibold">Book your consultation</h2>
            <AppointmentForm defaultDepartment={dept} source={source} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </BookingCtx.Provider>
  );
}
