"use client";

import { useMemo, useRef, useState } from "react";
import { Copy, Loader2, Search, Trash2, Upload } from "lucide-react";
import { Thumb, fmtSize, type Asset } from "@/components/portal/MediaPicker";
import { SafeImg, SafeVideo } from "@/components/site/ui";
import { Badge, Btn, Card, Empty, Modal, PageHeader, api, inputCls, useToast } from "@/components/portal/ui";

const LABEL: Record<string, string> = {
  specialties: "Specialties", treatments: "Treatments", services: "Services", doctors: "Doctors", insurance: "Insurance", gallery: "Gallery",
  blogs: "Insights", products: "Products", testimonials: "Testimonials", favicon: "Favicon", "og-image": "Social image",
};

export function MediaLibrary({ assets }: { assets: Asset[] }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("ALL");
  const [usage, setUsage] = useState("ALL");
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<Asset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(
    () =>
      assets.filter(
        (a) =>
          (kind === "ALL" || a.kind === kind) &&
          (usage === "ALL" || (usage === "LINKED" ? (a.refs ?? 0) > 0 : (a.refs ?? 0) === 0)) &&
          (!q || a.originalName.toLowerCase().includes(q.toLowerCase())),
      ),
    [assets, q, kind, usage],
  );
  const unlinked = assets.filter((a) => (a.refs ?? 0) === 0);
  const total = assets.reduce((n, a) => n + a.sizeInBytes, 0);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const tooBig = Array.from(files).find((f) => f.size > 10 * 1024 * 1024);
    if (tooBig) {
      toast(`${tooBig.name} exceeds 10MB and was not uploaded.`, "err");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    try {
      const res = await fetch("/api/portal/media", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast((json as { error?: string }).error || "Upload failed — please try again.", "err");
        return;
      }
      const errs = (json as { errors?: string[] }).errors ?? [];
      if (errs.length) toast(errs.join("; "), "err");
      const count = (json as { assets?: unknown[] }).assets?.length ?? 0;
      if (count > 0) {
        toast(`${count} file(s) uploaded & optimised to WebP`);
        setTimeout(() => window.location.reload(), 1200);
      } else if (!errs.length) {
        toast("No files were uploaded — please try again.", "err");
      }
    } catch {
      toast("Upload failed — please check your connection and try again.", "err");
    } finally {
      setUploading(false);
    }
  }

  async function del(a: Asset) {
    if (!confirm(`Delete ${a.originalName}?`)) return;
    const r = await api(`/api/portal/media/${a.id}`, "DELETE");
    if (!r.ok) return toast(r.error || "Delete failed — please try again.", "err");
    toast("Asset deleted");
    setView(null);
    setTimeout(() => window.location.reload(), 1200);
  }
  async function purge() {
    if (!confirm(`Permanently delete ${unlinked.length} unlinked asset(s)?`)) return;
    const r = await api<{ removed: number }>("/api/portal/media/purge", "DELETE");
    if (!r.ok) return toast(r.error || "Purge failed — please try again.", "err");
    toast(`Removed ${r.data?.removed ?? 0} unlinked asset(s)`);
    setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <>
      <PageHeader title="Media library" desc={`${assets.length} assets · ${fmtSize(total)} stored. Images are auto-optimised to WebP (under 10MB); videos are stored natively. Assets can be reused across any collection.`}>
        <Btn variant="secondary" disabled={!unlinked.length} onClick={purge}><Trash2 className="h-4 w-4" /> Purge unlinked ({unlinked.length})</Btn>
        <input ref={fileRef} type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime,video/ogg" className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        <Btn onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />} Upload</Btn>
      </PageHeader>

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files…" aria-label="Search files" className={`${inputCls} pl-9`} />
          </div>
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type" className={`${inputCls} !w-auto`}><option value="ALL">All types</option><option value="IMAGE">Images</option><option value="VIDEO">Videos</option></select>
          <select value={usage} onChange={(e) => setUsage(e.target.value)} aria-label="Usage" className={`${inputCls} !w-auto`}><option value="ALL">All usage</option><option value="LINKED">Linked</option><option value="UNLINKED">Unlinked</option></select>
        </div>
        {shown.length === 0 ? <Empty text="No assets match." /> : (
          <ul className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-5">
            {shown.map((a) => (
              <li key={a.id}>
                <button onClick={() => setView(a)} className="group block w-full overflow-hidden rounded-xl border border-line bg-white text-left hover:border-royal hover:shadow-lg">
                  <Thumb m={a} className="aspect-square w-full" />
                  <span className="block space-y-1 p-3">
                    <span className="block truncate text-sm font-semibold text-navy" title={a.originalName}>{a.originalName}</span>
                    <span className="block text-sm text-ink/65">{a.kind === "VIDEO" ? "Video" : "WebP"} · {fmtSize(a.sizeInBytes)}</span>
                    {(a.refs ?? 0) > 0 ? <Badge tone="green">Used by {a.refs}</Badge> : <Badge tone="amber">Unlinked</Badge>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {view && (
        <Modal title={view.originalName} onClose={() => setView(null)} size="lg"
          footer={<><Btn variant="secondary" onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.origin + view.url);
              toast("URL copied");
            } catch {
              toast("Could not copy — your browser blocked clipboard access.", "err");
            }
          }}><Copy className="h-4 w-4" /> Copy URL</Btn><Btn variant="danger" disabled={(view.refs ?? 0) > 0} onClick={() => del(view)}><Trash2 className="h-4 w-4" /> Delete</Btn></>}>
          <div className="overflow-hidden rounded-xl bg-navy">
            {view.kind === "VIDEO" ? <SafeVideo src={view.url} controls className="max-h-[60vh] w-full" /> :
              <SafeImg src={view.url} alt="" className="mx-auto max-h-[60vh] object-contain" />}
          </div>
          <dl className="mt-5 grid gap-3 text-base sm:grid-cols-2">
            <div><dt className="text-sm font-semibold text-ink/60">Size</dt><dd>{fmtSize(view.sizeInBytes)}</dd></div>
            <div><dt className="text-sm font-semibold text-ink/60">Reference counter</dt><dd>{view.refs ?? 0} linked entit{(view.refs ?? 0) === 1 ? "y" : "ies"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-sm font-semibold text-ink/60">Linked to</dt><dd className="mt-1 flex flex-wrap gap-1.5">{view.linkedTo?.length ? view.linkedTo.map((l) => <Badge key={l} tone="blue">{LABEL[l] ?? l}</Badge>) : <span className="text-ink/65">Nothing — safe to delete</span>}</dd></div>
          </dl>
        </Modal>
      )}
    </>
  );
}
