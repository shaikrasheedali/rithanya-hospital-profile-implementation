"use client";

import { useState } from "react";
import { Globe, ImagePlus, Save, X } from "lucide-react";
import { MediaPickerModal } from "@/components/portal/MediaPicker";
import { Btn, Card, Field, PageHeader, api, inputCls, useToast } from "@/components/portal/ui";
import type { Settings } from "@/lib/settings";

type S = Pick<Settings, "legalName" | "clinicalTagline" | "emergencyHotline" | "secondaryHotline" | "whatsappNumber" | "email" | "physicalAddress" | "opdTimings" | "noticeBanner" | "criticalBloodAlertThreshold" | "seoPageTitle" | "metaDescription" | "targetKeywords" | "canonicalUrl" | "robotsIndexFollow" | "faviconUrl" | "socialShareThumbnailUrl">;

export function MasterSettingsForm({ s }: { s: S }) {
  const toast = useToast();
  const [v, setV] = useState({
    legalName: s.legalName, clinicalTagline: s.clinicalTagline, emergencyHotline: s.emergencyHotline, secondaryHotline: s.secondaryHotline ?? "",
    whatsappNumber: s.whatsappNumber, email: s.email, physicalAddress: s.physicalAddress, opdTimings: s.opdTimings, noticeBanner: s.noticeBanner,
    criticalBloodAlertThreshold: String(s.criticalBloodAlertThreshold),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string) => setV((x) => ({ ...x, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const phoneDigits = v.emergencyHotline.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      toast("Emergency hotline must contain at least 10 digits.", "err");
      return;
    }
    if (v.secondaryHotline && v.secondaryHotline.replace(/\D/g, "").length < 10) {
      toast("Secondary line must contain at least 10 digits (or be left blank).", "err");
      return;
    }
    const threshold = Number(v.criticalBloodAlertThreshold);
    if (!Number.isFinite(threshold) || threshold < 0) {
      toast("Blood bank threshold must be 0 or more.", "err");
      return;
    }
    setBusy(true);
    const r = await api("/api/portal/r/settings/master", "PUT", { ...v, criticalBloodAlertThreshold: threshold });
    setBusy(false);
    if (!r.ok) return toast(r.error || "Save failed — please try again.", "err");
    toast("Master identity saved");
    setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <form onSubmit={save}>
      <PageHeader title="Hospital master identity" desc="Legal identity, contact lines, timings and blood-stock alert threshold used across the public site.">
        <Btn disabled={busy}><Save className="h-5 w-5" /> {busy ? "Saving…" : "Save changes"}</Btn>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Identity</h2>
          <Field label="Legal name"><input required className={inputCls} value={v.legalName} onChange={(e) => set("legalName", e.target.value)} /></Field>
          <Field label="Clinical tagline"><input className={inputCls} value={v.clinicalTagline} onChange={(e) => set("clinicalTagline", e.target.value)} /></Field>
          <Field label="Physical address"><textarea rows={3} className={inputCls} value={v.physicalAddress} onChange={(e) => set("physicalAddress", e.target.value)} /></Field>
          <Field label="Notice banner (yellow strip; leave blank to hide)"><textarea rows={2} className={inputCls} value={v.noticeBanner} onChange={(e) => set("noticeBanner", e.target.value)} /></Field>
        </Card>
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Contact & timings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Emergency hotline"><input required className={inputCls} value={v.emergencyHotline} onChange={(e) => set("emergencyHotline", e.target.value)} /></Field>
            <Field label="Secondary / enquiry line"><input className={inputCls} value={v.secondaryHotline} onChange={(e) => set("secondaryHotline", e.target.value)} /></Field>
            <Field label="WhatsApp number (with country code)" help="e.g. 918328581019"><input className={inputCls} value={v.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} /></Field>
            <Field label="Email"><input type="email" className={inputCls} value={v.email} onChange={(e) => set("email", e.target.value)} /></Field>
          </div>
          <Field label="OPD & daycare timing specification"><input className={inputCls} value={v.opdTimings} onChange={(e) => set("opdTimings", e.target.value)} /></Field>
          <Field label="Blood bank critical threshold (units)" help="Stock at or below this number shows a critical alert on the public site and dashboard."><input type="number" min={0} className={inputCls} value={v.criticalBloodAlertThreshold} onChange={(e) => set("criticalBloodAlertThreshold", e.target.value)} /></Field>
        </Card>
      </div>
    </form>
  );
}

function AssetPick({ label, help, value, onChange }: { label: string; help: string; value: string; onChange: (u: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <span className="mb-1 block text-sm font-semibold text-navy">{label}</span>
      <div className="flex items-center gap-4 rounded-lg border border-line bg-canvas p-3">
        {value ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={value} alt="" className="h-16 w-24 rounded border border-line bg-white object-cover" /> : <div className="flex h-16 w-24 items-center justify-center rounded border border-dashed border-line text-sm text-ink/55">None</div>}
        <div className="flex flex-wrap gap-2">
          <Btn type="button" small variant="secondary" onClick={() => setOpen(true)}><ImagePlus className="h-4 w-4" /> Choose / upload</Btn>
          {value && <Btn type="button" small variant="ghost" onClick={() => onChange("")}><X className="h-4 w-4" /> Remove</Btn>}
        </div>
      </div>
      <span className="mt-1 block text-sm text-ink/65">{help}</span>
      {open && <MediaPickerModal single imagesOnly onClose={() => setOpen(false)} onPick={(a) => { onChange(a[0].url); setOpen(false); }} />}
    </div>
  );
}

function host(u: string) {
  try {
    return new URL(u || "https://rithanyahospital.com").hostname;
  } catch {
    return "rithanyahospital.com";
  }
}

export function SeoSettingsForm({ s }: { s: S }) {
  const toast = useToast();
  const [v, setV] = useState({ seoPageTitle: s.seoPageTitle, metaDescription: s.metaDescription, targetKeywords: s.targetKeywords, canonicalUrl: s.canonicalUrl, robotsIndexFollow: s.robotsIndexFollow, faviconUrl: s.faviconUrl ?? "", socialShareThumbnailUrl: s.socialShareThumbnailUrl ?? "" });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((x) => ({ ...x, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (v.canonicalUrl) {
      try {
        const u = new URL(v.canonicalUrl);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad protocol");
      } catch {
        toast("Canonical URL must be a valid http(s) URL.", "err");
        return;
      }
    }
    if (v.seoPageTitle.length > 70) {
      toast("SEO title should be under 70 characters.", "err");
      return;
    }
    setBusy(true);
    const r = await api("/api/portal/r/settings/seo", "PUT", v);
    setBusy(false);
    if (!r.ok) return toast(r.error || "Save failed — please try again.", "err");
    toast("SEO & social metadata saved");
    setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <form onSubmit={save}>
      <PageHeader title="SEO & social metadata" desc="Control how the site appears in Google results and when shared on WhatsApp or social media. Previews update live.">
        <Btn disabled={busy}><Save className="h-5 w-5" /> {busy ? "Saving…" : "Save changes"}</Btn>
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4 p-6">
          <Field label="SEO page title" help={`${v.seoPageTitle.length} characters — aim for under 60`}><input className={inputCls} value={v.seoPageTitle} onChange={(e) => set("seoPageTitle", e.target.value)} /></Field>
          <Field label="Meta description" help={`${v.metaDescription.length} characters — aim for 120–160`}><textarea rows={4} className={inputCls} value={v.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} /></Field>
          <Field label="Target keywords (comma separated)"><textarea rows={2} className={inputCls} value={v.targetKeywords} onChange={(e) => set("targetKeywords", e.target.value)} /></Field>
          <Field label="Canonical URL"><input type="url" className={inputCls} value={v.canonicalUrl} onChange={(e) => set("canonicalUrl", e.target.value)} /></Field>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-4 py-3">
            <input type="checkbox" className="h-5 w-5 accent-[#0D47A1]" checked={v.robotsIndexFollow} onChange={(e) => set("robotsIndexFollow", e.target.checked)} />
            <span><span className="block text-base font-medium">Allow search engines to index & follow</span><span className="text-sm text-ink/65">{v.robotsIndexFollow ? "robots: index, follow" : "robots: noindex, nofollow — site will be hidden from search"}</span></span>
          </label>
          <AssetPick label="Favicon (32×32 or 64×64 square image)" help="Pick a square image from the media library or upload one." value={v.faviconUrl} onChange={(u) => set("faviconUrl", u)} />
          <AssetPick label="Open Graph share image (1200×630)" help="Shown when the link is shared on WhatsApp, Facebook and X." value={v.socialShareThumbnailUrl} onChange={(u) => set("socialShareThumbnailUrl", u)} />
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink/65"><Globe className="h-4 w-4 text-royal" /> Google search preview</p>
            <div className="max-w-xl font-sans">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {v.faviconUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.faviconUrl} alt="" className="h-full w-full object-cover" /> : "R"}
                </span>
                <span className="text-sm leading-tight text-slate-800"><span className="font-medium">{s.legalName}</span><span className="ml-1 text-slate-500">· {v.canonicalUrl}</span></span>
              </div>
              <h3 className="truncate text-xl font-medium leading-snug text-[#1a0dab] hover:underline">{v.seoPageTitle || s.legalName}</h3>
              <p className="mt-1 line-clamp-2 text-base leading-normal text-[#4d5156]">{v.metaDescription || "Add a meta description to control the snippet shown below your title."}</p>
              <p className="mt-2 text-sm text-[#006621]">24/7 Blood Bank · Thalassemia Daycare · Diabetology Care</p>
            </div>
          </Card>
          <Card className="p-6">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink/65"><Globe className="h-4 w-4 text-emerald-600" /> Social / WhatsApp card preview</p>
            <div className="max-w-md overflow-hidden rounded-xl border border-line bg-slate-50 shadow-sm">
              <div className="relative aspect-[1200/630] overflow-hidden bg-slate-200">
                {v.socialShareThumbnailUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.socialShareThumbnailUrl} alt="Social preview" className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center bg-slate-100 text-slate-500"><span className="text-sm font-medium">1200 × 630 Open Graph image</span><span className="text-sm">Choose one on the left</span></div>}
              </div>
              <div className="border-t border-slate-100 bg-white p-4">
                <span className="mb-0.5 block text-sm font-semibold uppercase tracking-wider text-slate-500">{host(v.canonicalUrl)}</span>
                <h4 className="line-clamp-1 text-base font-bold text-slate-900">{v.seoPageTitle || s.legalName}</h4>
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">{v.metaDescription || "Description preview"}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
