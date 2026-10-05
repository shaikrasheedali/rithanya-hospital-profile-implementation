"use client";
import { Link } from "react-router-dom";


import { useState } from "react";
import { Eye, EyeOff, HeartPulse, Lock, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { api, inputCls } from "@/components/portal/ui";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      const msg = "Enter your username and password.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    setError("");
    const r = await api("/api/auth/login", "POST", { username: username.trim(), password });
    if (!r.ok) {
      const msg = r.error || "Sign-in failed — please try again.";
      setError(msg);
      toast.error(msg);
      setBusy(false);
      return;
    }
    toast.success("Signed in successfully.");
    window.location.href = "/portal/dashboard";
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="on-dark bg-mesh relative hidden overflow-hidden p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="absolute -right-20 top-1/4 h-96 w-96 animate-float rounded-full bg-royal/50 blur-3xl" aria-hidden />
        <Link to="/" className="relative flex items-center gap-3 font-heading text-2xl font-semibold text-white">
          <img src="/logo.png" alt="Rithanya Hospital logo" className="h-11 w-11 flex-none object-contain drop-shadow" />
          Rithanya Hospital
        </Link>
        <div className="relative">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-gold">Hospital management system</p>
          <h1 className="max-w-lg text-5xl font-semibold leading-tight tracking-tight !text-white">Care, records and operations — in one secure place.</h1>
          <ul className="mt-8 space-y-3 text-lg text-white/85">
            {["Role-based hospital staff access", "EMR fields encrypted at rest with AES-256-GCM", "Argon2id-hashed credentials, audit-logged actions"].map((t) => (
              <li key={t} className="flex gap-3"><ShieldCheck className="mt-1 h-5 w-5 flex-none text-gold" />{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-base text-white/60">Authorised personnel only. Activity is monitored.</p>
      </div>

      <div className="flex items-center justify-center bg-canvas p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 text-base font-semibold text-royal hover:text-alert lg:hidden">
            <img src="/logo.png" alt="Rithanya Hospital" className="h-7 w-7 object-contain" />
            <span>← Back to website</span>
          </Link>
          <div className="mb-6 flex items-center gap-3.5">
            <img src="/logo.png" alt="Rithanya Hospital logo" className="h-12 w-12 flex-none object-contain drop-shadow-sm" />
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-tight text-[#0A2540]">Staff sign in</h2>
              <p className="text-xs font-semibold uppercase tracking-wider text-royal">HMS Staff Portal</p>
            </div>
          </div>
          <p className="mt-1 text-base text-ink/75">Enter your credentials to access the portal.</p>
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
        </div>
      </div>
    </div>
  );
}
