"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

export async function api<T = unknown>(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const entityMatch = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )rh_entity=([^;]*)/) : null;
    const entity = entityMatch ? entityMatch[1] : "RITHANYA_HOSPITAL";
    const headers: Record<string, string> = {
      "x-rh-entity": entity,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(url, {
      method,
      headers,
      credentials: "same-origin",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error || `Request failed (${res.status})` };
    return { ok: true, data: (json.data ?? json) as T };
  } catch {
    return { ok: false, error: "Network error — please try again." };
  }
}

/* ---------- Toasts (sonner-backed; keeps legacy useToast API) ---------- */
type Toast = (msg: string, kind?: "ok" | "err") => void;
const ToastCtx = createContext<Toast>((msg, kind = "ok") => {
  if (kind === "err") toast.error(msg);
  else toast.success(msg);
});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const push = useCallback<Toast>((msg, kind = "ok") => {
    if (kind === "err") toast.error(msg || "Something went wrong — please try again.");
    else toast.success(msg);
  }, []);
  return <ToastCtx.Provider value={push}>{children}</ToastCtx.Provider>;
}

/* ---------- Modal ---------- */
export function Modal({
  title,
  onClose,
  children,
  size = "md",
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  const w = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" }[size];
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative flex max-h-[94vh] w-full ${w} flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl`}>
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-heading text-xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-canvas"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-line bg-canvas px-6 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------- Form bits ---------- */
export const inputCls =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-ink/40 focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20 disabled:bg-canvas";

export function Field({ label, children, help, className = "" }: { label: string; children: React.ReactNode; help?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-semibold text-navy">{label}</span>
      {children}
      {help && <span className="mt-1 block text-sm text-ink/65">{help}</span>}
    </label>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" | "gold"; small?: boolean };
export function Btn({ variant = "primary", small, className = "", ...p }: BtnProps) {
  const v = {
    primary: "bg-royal text-white hover:bg-navy",
    secondary: "border border-line bg-white text-navy hover:border-royal hover:text-royal",
    danger: "bg-alert text-white hover:bg-red-800",
    ghost: "text-royal hover:bg-royal/10",
    gold: "bg-gold text-navy hover:bg-yellow-300",
  }[variant];
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${small ? "px-3 py-1.5 text-sm" : "px-5 py-2.5 text-base"} ${v} ${className}`}
    />
  );
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "red" | "blue" | "amber" | "purple" }) {
  const t = {
    slate: "bg-slate-100 text-slate-800",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-900",
    amber: "bg-amber-100 text-amber-900",
    purple: "bg-purple-100 text-purple-900",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${t}`}>{children}</span>;
}

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {desc && <p className="mt-1 max-w-3xl text-base text-ink/75">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

export const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-line bg-white ${className}`}>{children}</div>
);

export const Empty = ({ text }: { text: string }) => <p className="p-10 text-center text-base text-ink/65">{text}</p>;

export function EntityPicker({
  value,
  onChange,
  className = "",
}: {
  value?: "RITHANYA_HOSPITAL" | "RVBC" | string;
  onChange?: (v: "RITHANYA_HOSPITAL" | "RVBC") => void;
  className?: string;
}) {
  const getEntityFromCookie = () =>
    document.cookie.match(/(?:^|; )rh_entity=([^;]*)/)?.[1] === "RVBC"
      ? "RVBC"
      : "RITHANYA_HOSPITAL";

  const [val, setVal] = useState<string>(value || getEntityFromCookie());

  useEffect(() => {
    if (value && value !== val) setVal(value);
  }, [value]);

  function handleChange(next: "RITHANYA_HOSPITAL" | "RVBC") {
    setVal(next);
    document.cookie = `rh_entity=${next}; path=/; max-age=31536000; samesite=lax`;
    if (onChange) {
      onChange(next);
    } else {
      window.location.reload();
    }
  }

  return (
    <label className={`inline-flex items-center gap-2 text-sm font-semibold text-ink/70 ${className}`}>
      Entity
      <select
        value={val}
        onChange={(e) => handleChange(e.target.value as "RITHANYA_HOSPITAL" | "RVBC")}
        className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm font-semibold text-navy shadow-sm"
      >
        <option value="RITHANYA_HOSPITAL">Rithanya Hospital</option>
        <option value="RVBC">RVBC (Voluntary Blood Centre)</option>
      </select>
    </label>
  );
}

