"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Loader2, Search, Trash2, Upload } from "lucide-react";
import { Thumb, fmtSize, type Asset } from "@/components/portal/MediaPicker";
import { SafeImg, SafeVideo } from "@/components/site/ui";
import { Badge, Btn, Card, Empty, Modal, PageHeader, api, inputCls, useToast } from "@/components/portal/ui";
import { prepareFilesForUpload } from "@/lib/imagePrep";

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
  // Local working copy so upload/delete/purge update the grid in place
  // instead of forcing a full page reload.
  const [items, setItems] = useState<Asset[]>(assets);
  useEffect(() => setItems(assets), [assets]);

  const shown = useMemo(
    () =>
      items.filter(
        (a) =>
          (kind === "ALL" || a.kind === kind) &&
          (usage === "ALL" || (usage === "LINKED" ? (a.refs ?? 0) > 0 : (a.refs ?? 0) === 0)) &&
          (!q || a.originalName.toLowerCase().includes(q.toLowerCase())),
      ),
    [items, q, kind, usage],
  );
  const unlinked = items.filter((a) => (a.refs ?? 0) === 0);
  const total = items.reduce((n, a) => n + a.sizeInBytes, 0);

  const sameAsset = (a: Asset, b: Asset) => a.id === b.id || Boolean(a.filename && b.filename && a.filename === b.filename);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      // Downscale/re-encode big camera files in the browser first — the upload
      // itself becomes several times smaller and faster.
      const prepared = await prepareFilesForUpload(Array.from(files));
      const tooBig = prepared.find((f) => f.size > 10 * 1024 * 1024);
      if (tooBig) {
        toast(`${tooBig.name} exceeds 10MB and was not uploaded.`, "err");
        return;
      }
      const fd = new FormData();
      prepared.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/portal/media", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast((json as { error?: string }).error || "Upload failed — please try again.", "err");
        return;
      }
      const errs = (json as { errors?: string[] }).errors ?? [];
      if (errs.length) toast(errs.join("; "), "err");
      const added = ((json as { assets?: Asset[] }).assets ?? []) as Asset[];
      if (added.length) {
        toast(`${added.length} file(s) uploaded & optimised to WebP`);
        setItems((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...added.filter((a) => !ids.has(a.id)), ...prev];
        });
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
    setItems((prev) => prev.filter((x) => !sameAsset(x, a)));
  }
  async function purge() {
    if (!confirm(`Permanently delete ${unlinked.length} unlinked asset(s)?`)) return;
    const r = await api<{ removed: number }>("/api/portal/media/purge", "DELETE");
    if (!r.ok) return toast(r.error || "Purge failed — please try again.", "err");
    toast(`Removed ${r.data?.removed ?? 0} unlinked asset(s)`);
    setItems((prev) => prev.filter((a) => (a.refs ?? 0) > 0));
  }

  return (
    <>
      <PageHeader title="Media library" desc={`${items.length} assets · ${fmtSize(total)} stored. Images are auto-compressed in your browser, then optimised to WebP on the server (under 10MB); videos are stored natively. Assets can be reused across any collection.`}>
        <Btn variant="secondary" disabled={!unlinked.length} onClick={purge}><Trash2 className="h-4 w-4" /> Purge unlinked ({unlinked.length})</Btn>
        <input ref={fileRef} type="file" multiple name="media-files" accept="image/*,video/mp4,video/webm,video/quicktime,video/ogg" className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        <Btn onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />} Upload</Btn>
      </PageHeader>

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} name="media-search" placeholder="Search files…" aria-label="Search files" className={`${inputCls} pl-9`} />
          </div>
          <select value={kind} onChange={(e) => setKind(e.target.value)} name="media-kind" aria-label="Type" className={`${inputCls} !w-auto`}><option value="ALL">All types</option><option value="IMAGE">Images</option><option value="VIDEO">Videos</option></select>
          <select value={usage} onChange={(e) => setUsage(e.target.value)} name="media-usage" aria-label="Usage" className={`${inputCls} !w-auto`}><option value="ALL">All usage</option><option value="LINKED">Linked</option><option value="UNLINKED">Unlinked</option></select>
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
