"use client";
import { Link } from "react-router-dom";


import { useState } from "react";
import { Eye, EyeOff, HeartPulse, Lock, ShieldCheck, User } from "lucide-react";
import { api, inputCls } from "@/components/portal/ui";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await api("/api/auth/login", "POST", { username, password });
    if (!r.ok) {
      setError(r.error || "Sign-in failed");
      setBusy(false);
      return;
    }
    window.location.href = "/portal/dashboard";
    window.location.reload();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="on-dark bg-mesh relative hidden overflow-hidden p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="absolute -right-20 top-1/4 h-96 w-96 animate-float rounded-full bg-royal/50 blur-3xl" aria-hidden />
        <Link to="/" className="relative flex items-center gap-3 font-heading text-2xl font-semibold text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-navy"><HeartPulse className="h-6 w-6" /></span> Rithanya Hospital
        </Link>
        <div className="relative">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-gold">Hospital management system</p>
          <h1 className="max-w-lg text-5xl font-semibold leading-tight tracking-tight !text-white">Care, records and operations — in one secure place.</h1>
          <ul className="mt-8 space-y-3 text-lg text-white/85">
            {["Role-based access: Superadmin, Admin, Staff", "EMR fields encrypted at rest with AES-256-GCM", "Argon2id-hashed credentials, audit-logged actions"].map((t) => (
              <li key={t} className="flex gap-3"><ShieldCheck className="mt-1 h-5 w-5 flex-none text-gold" />{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-base text-white/60">Authorised personnel only. Activity is monitored.</p>
      </div>

      <div className="flex items-center justify-center bg-canvas p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-block text-base font-semibold text-royal hover:text-alert lg:hidden">← Back to website</Link>
          <h2 className="text-3xl font-semibold">Staff sign in</h2>
          <p className="mt-2 text-base text-ink/75">Enter your credentials to access the portal.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-navy">Username or email</span>
              <span className="relative block">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink/50" />
                <input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" className={`${inputCls} !py-3 pl-11`} />
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-navy">Password</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink/50" />
                <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className={`${inputCls} !py-3 pl-11 pr-12`} />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink/60 hover:text-royal">
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>
            {error && <p role="alert" className="rounded-lg bg-alert/10 p-3 text-base font-medium text-alert">{error}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-royal px-6 py-3.5 text-lg font-semibold text-white hover:bg-navy disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
          </form>
          <details className="mt-8 rounded-xl border border-line bg-white p-4 text-base">
            <summary className="cursor-pointer font-semibold text-navy">Demo accounts</summary>
            <ul className="mt-3 space-y-1.5 text-ink/80">
              <li><strong>superadmin</strong> / Rithanya@2026 — everything</li>
              <li><strong>admin</strong> / Admin@2026 — CMS, HR, finance, DPDP, staff users</li>
              <li><strong>staff</strong> / Staff@2026 — EMR, blood bank, store</li>
            </ul>
            <p className="mt-2 text-sm text-ink/60">Change these passwords after first sign-in (Access control → User accounts).</p>
          </details>
        </div>
      </div>
    </div>
  );
}
