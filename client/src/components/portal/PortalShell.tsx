"use client";
import { Link, useLocation } from "react-router-dom";


import { useEffect, useState } from "react";
import {
  Banknote, BedDouble, BookOpen, Building2, CalendarCheck, ClipboardList, Droplets, FileSearch, FolderTree, Gauge, Globe, HeartPulse, ImageIcon,
  Images, KeyRound, Landmark, LogOut, Menu, Newspaper, PackageSearch, Receipt, Scale, Settings2, ShieldCheck, ShoppingBag, Stethoscope,
  Archive, Users, UserCog, Wallet, X, Quote, Sparkles, Activity, Handshake, Truck, UserRound, Siren, BarChart3, ListChecks, Search,
} from "lucide-react";
import { ToastProvider } from "@/components/portal/ui";
import type { ModuleKey, Role } from "@/lib/auth";

type Item = { label: string; href: string; icon: React.ComponentType<{ className?: string }>; module?: ModuleKey };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  { title: "Overview", items: [{ label: "Dashboard", href: "/portal/dashboard", icon: Gauge }, { label: "Appointments", href: "/portal/appointments", icon: CalendarCheck, module: "emr" }] },
  {
    title: "Clinical & EMR",
    items: [
      { label: "Inpatients", href: "/portal/inpatients", icon: BedDouble, module: "emr" },
      { label: "Outpatients", href: "/portal/outpatients", icon: UserRound, module: "emr" },
      { label: "Discharged patients", href: "/portal/discharged-patients", icon: Archive, module: "emr" },
      { label: "Diagnosis categories", href: "/portal/diagnosis-categories", icon: FolderTree, module: "emr" },
    ],
  },
  { title: "Blood bank", items: [{ label: "Live stock", href: "/portal/blood-bank", icon: Droplets, module: "bloodbank" }] },
  {
    title: "Website CMS",
    items: [
      { label: "Specialties", href: "/portal/cms/specialties", icon: HeartPulse, module: "cms" },
      { label: "Treatments", href: "/portal/cms/treatments", icon: Activity, module: "cms" },
      { label: "Services", href: "/portal/cms/services", icon: Siren, module: "cms" },
      { label: "Doctors", href: "/portal/cms/doctors", icon: Stethoscope, module: "cms" },
      { label: "Insurance", href: "/portal/cms/insurance", icon: Handshake, module: "cms" },
      { label: "Gallery", href: "/portal/cms/gallery", icon: Images, module: "cms" },
      { label: "Insights / blogs", href: "/portal/cms/blogs", icon: Newspaper, module: "cms" },
      { label: "Testimonials", href: "/portal/cms/testimonials", icon: Quote, module: "cms" },
      { label: "Media library", href: "/portal/cms/media-library", icon: ImageIcon, module: "cms" },
    ],
  },
  {
    title: "Pharmacy store",
    items: [
      { label: "Products", href: "/portal/store/products", icon: PackageSearch, module: "store" },
      { label: "Orders desk", href: "/portal/store/orders", icon: Truck, module: "store" },
    ],
  },
  {
    title: "HR & payroll",
    items: [
      { label: "Employees", href: "/portal/hr/employees", icon: Users, module: "hr" },
      { label: "Payroll", href: "/portal/hr/payroll", icon: Wallet, module: "hr" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Ledger", href: "/portal/finance/ledger", icon: Receipt, module: "finance" },
      { label: "Categories", href: "/portal/finance/categories", icon: ListChecks, module: "finance" },
      { label: "Cash-flow overview", href: "/portal/finance/overview", icon: BarChart3, module: "finance" },
    ],
  },
  { title: "Compliance", items: [{ label: "DPDP erasure desk", href: "/portal/compliance/dpdp-requests", icon: Scale, module: "dpdp" }] },
  {
    title: "Access control",
    items: [
      { label: "User accounts", href: "/portal/access/users", icon: UserCog, module: "access" },
      { label: "Permission matrix", href: "/portal/access/permissions", icon: KeyRound, module: "access" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Master identity", href: "/portal/settings/master", icon: Building2, module: "settings" },
      { label: "SEO & social", href: "/portal/settings/seo", icon: Search, module: "settings" },
      { label: "Audit logs", href: "/portal/settings/audit-logs", icon: FileSearch, module: "settings" },
    ],
  },
];
void [Banknote, BookOpen, ClipboardList, Globe, Landmark, Settings2, ShoppingBag, Sparkles];

const ROLE_TONE: Record<Role, string> = { SUPERADMIN: "bg-gold text-navy", ADMIN: "bg-sky-300 text-navy", STAFF: "bg-white/20 text-white" };

function shiftNow() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" })) % 24;
  if (h >= 6 && h < 14) return "Morning shift (6 AM – 2 PM)";
  if (h >= 14 && h < 22) return "Evening shift (2 PM – 10 PM)";
  return "Night shift (10 PM – 6 AM)";
}

export function PortalShell({
  user,
  entity,
  children,
}: {
  user: { fullName: string; username: string; role: Role; modules: Record<ModuleKey, boolean> };
  entity: "RITHANYA_HOSPITAL" | "RVBC";
  children: React.ReactNode;
}) {
  const pathname = useLocation().pathname;
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState("");

  useEffect(() => {
    setShift(shiftNow());
    const t = setInterval(() => setShift(shiftNow()), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.module || user.modules[i.module]) })).filter((g) => g.items.length);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/portal/login";
    window.location.reload();
  }
  function switchEntity(v: string) {
    document.cookie = `rh_entity=${v}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  const nav = (
    <nav aria-label="Portal" className="portal-nav no-scrollbar flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.16em] text-white/55">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = pathname === i.href || pathname.startsWith(i.href + "/");
              return (
                <li key={i.href}>
                  <Link to={i.href} className={`flex items-center gap-3 rounded-lg border-l-4 px-3 py-2.5 text-base font-medium ${active ? "border-gold bg-white/12 text-white" : "border-transparent text-white/80 hover:bg-white/8 hover:text-white"}`}>
                    <i.icon className={`h-5 w-5 flex-none ${active ? "text-gold" : ""}`} /> {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <ToastProvider>
      <div className="on-dark flex min-h-screen bg-canvas">
        <aside className="no-print sticky top-0 hidden h-screen w-72 flex-none flex-col bg-navy text-white lg:flex">
          <Link to="/portal/dashboard" className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
            <img src="/logo.png" alt="Rithanya HMS" className="h-10 w-10 flex-none object-contain drop-shadow" />
            <span><span className="block font-heading text-lg font-semibold leading-tight">Rithanya HMS</span><span className="text-sm text-white/65">Staff portal</span></span>
          </Link>
          {nav}
          <Link to="/" className="border-t border-white/10 px-6 py-4 text-base text-white/75 hover:text-gold">← View public website</Link>
        </aside>

        {open && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <div className="absolute inset-0 bg-navy/60" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-navy text-white">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <img src="/logo.png" alt="Rithanya HMS" className="h-8 w-8 object-contain drop-shadow" />
                  <span className="font-heading text-lg font-semibold">Rithanya HMS</span>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
              </div>
              {nav}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 hover:bg-canvas lg:hidden"><Menu className="h-6 w-6" /></button>
              <p className="hidden items-center gap-2 rounded-full bg-gold/30 px-3 py-1.5 text-sm font-semibold text-navy md:flex" aria-live="polite">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" /> Active shift: {shift || "…"}
              </p>
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-3 text-right">
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold leading-tight text-navy">{user.fullName}</p>
                    <p className="text-sm text-ink/60">@{user.username}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${ROLE_TONE[user.role]} ${user.role === "STAFF" ? "!bg-navy" : ""}`}>{user.role}</span>
                </div>
                <button onClick={logout} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-navy hover:border-alert hover:text-alert"><LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span></button>
              </div>
            </div>
            <p className="border-t border-line bg-gold/30 px-4 py-1.5 text-center text-sm font-semibold text-navy md:hidden">Active shift: {shift || "…"}</p>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
          <p className="no-print flex items-center justify-center gap-2 border-t border-line px-4 py-4 text-sm text-ink/60"><ShieldCheck className="h-4 w-4" /> Patient data is encrypted at rest (AES-256-GCM) · All actions are audit-logged</p>
        </div>
      </div>
    </ToastProvider>
  );
}
