"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Film, ImagePlus, Library, Loader2, Play, Search, Upload, X } from "lucide-react";
import { Btn, Modal, api, useToast } from "@/components/portal/ui";
import { SafeImg, SafeVideo } from "@/components/site/ui";
import type { MediaRef } from "@/lib/utils";

export type Asset = MediaRef & { sizeInBytes: number; refs?: number; linkedTo?: string[]; createdAt?: string; filename?: string };

export const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function Thumb({ m, className = "" }: { m: Pick<MediaRef, "url" | "kind">; className?: string }) {
  return m.kind === "VIDEO" ? (
    <div className={`relative bg-navy ${className}`}>
      <SafeVideo src={`${m.url}#t=0.2`} className="h-full w-full object-cover" />
      <span className="absolute inset-0 flex items-center justify-center text-white"><Play className="h-6 w-6 drop-shadow" /></span>
    </div>
  ) : (
    <SafeImg src={m.url} alt="" className={`object-cover ${className}`} />
  );
}

/** Upload (auto WebP optimisation) or pick existing assets from the shared media library. */
export function MediaPickerModal({
  onClose,
  onPick,
  single = false,
  imagesOnly = false,
  exclude = [],
}: {
  onClose: () => void;
  onPick: (assets: Asset[]) => void;
  single?: boolean;
  imagesOnly?: boolean;
  exclude?: string[];
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"ALL" | "IMAGE" | "VIDEO">(imagesOnly ? "IMAGE" : "ALL");
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<{ assets: Asset[] }>("/api/portal/media", "GET");
    if (r.ok) setAssets(r.data!.assets ?? []);
    else toast(r.error || "Could not load media — please try again.", "err");
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () =>
      assets.filter(
        (a) =>
          (kind === "ALL" || a.kind === kind) &&
          (!imagesOnly || a.kind === "IMAGE") &&
          (!q || a.originalName.toLowerCase().includes(q.toLowerCase())),
      ),
    [assets, kind, q, imagesOnly],
  );

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    const tooBig = list.find((f) => f.size > 10 * 1024 * 1024 && f.type.startsWith("image/"));
    if (tooBig) {
      toast(`${tooBig.name} exceeds 10MB — please compress and retry.`, "err");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    list.forEach((f) => fd.append("files", f));
    try {
      const res = await fetch("/api/portal/media", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Upload failed — please try again.");
      const added = (((json as { assets?: Asset[] }).assets ?? []) as Asset[]).map((a) => ({
        id: a.filename || a.id,
        url: a.url || `/api/media/${a.filename || a.id}`,
        kind: a.kind || "IMAGE",
        originalName: a.originalName || a.filename || a.id,
        sizeInBytes: a.sizeInBytes || 2048,
      }));
      const errs = (json as { errors?: string[] }).errors ?? [];
      if (errs.length) toast(errs.join("; "), "err");
      if (added.length) toast(`${added.length} file(s) uploaded & optimised`);
      else if (!errs.length) toast("No files were uploaded — please try again.", "err");

      // Merge into local assets state immediately so it is available without waiting
      setAssets((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newOnes = added.filter((a) => !existingIds.has(a.id));
        return [...newOnes, ...prev];
      });

      const addedIds = added.map((a) => a.id);
      setSel((s) => (single ? [addedIds[0]] : Array.from(new Set([...addedIds, ...s]))));
      setTab("library");

      // Non-blocking background load
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "err");
    } finally {
      setUploading(false);
    }
  }

  const toggle = (id: string) => setSel((s) => (single ? [id] : s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handlePickSelected = () => {
    const picked: Asset[] = [];
    const missing: string[] = [];
    for (const id of sel) {
      const found = assets.find(
        (a) =>
          a.id === id ||
          a.filename === id ||
          a.url === id ||
          a.url.endsWith(id) ||
          a.id.replace(/^media-/, "") === id.replace(/^media-/, "") ||
          Boolean(a.filename && id.includes(a.filename))
      );
      if (found) {
        picked.push(found);
      } else {
        missing.push(id);
      }
    }
    if (missing.length) {
      toast(`${missing.length} selected item(s) are no longer available — please reselect.`, "err");
    }
    if (picked.length) {
      onPick(picked);
    }
  };

  return (
    <Modal
      title={single ? "Choose an image" : "Add images & videos"}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <span className="mr-auto self-center text-base text-ink/70">{sel.length} selected</span>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn disabled={!sel.length} onClick={handlePickSelected}>Use selected</Btn>
        </>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-line bg-canvas p-1">
          <button onClick={() => setTab("library")} className={`flex items-center gap-2 rounded-md px-4 py-2 font-semibold ${tab === "library" ? "bg-white text-royal shadow" : "text-ink/70"}`}><Library className="h-4 w-4" /> Media library</button>
          <button onClick={() => setTab("upload")} className={`flex items-center gap-2 rounded-md px-4 py-2 font-semibold ${tab === "upload" ? "bg-white text-royal shadow" : "text-ink/70"}`}><Upload className="h-4 w-4" /> Upload new</button>
        </div>
        {tab === "library" && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files…" aria-label="Search files" className="rounded-lg border border-line py-2 pl-9 pr-3 text-base focus:border-royal focus:outline-none" />
            </div>
            {!imagesOnly && (
              <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Filter type" className="rounded-lg border border-line px-3 py-2 text-base">
                <option value="ALL">All media</option><option value="IMAGE">Images</option><option value="VIDEO">Videos</option>
              </select>
            )}
          </>
        )}
      </div>

      {tab === "upload" ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center ${drag ? "border-royal bg-royal/5" : "border-line bg-canvas"}`}
        >
          {uploading ? <Loader2 className="h-12 w-12 animate-spin text-royal" /> : <ImagePlus className="h-12 w-12 text-royal" />}
          <p className="mt-4 text-lg font-semibold text-navy">{uploading ? "Optimising & uploading…" : "Drag & drop files here"}</p>
          <p className="mt-1 max-w-md text-base text-ink/70">Images are converted to WebP (under 10MB, metadata stripped). Videos: MP4, WebM or MOV up to 120MB.</p>
          <input ref={fileRef} type="file" multiple={!single} accept={imagesOnly ? "image/*" : "image/*,video/mp4,video/webm,video/quicktime,video/ogg"} className="sr-only" onChange={(e) => e.target.files && upload(e.target.files)} />
          <Btn className="mt-5" disabled={uploading} onClick={() => fileRef.current?.click()}>Choose files</Btn>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-royal" /></div>
      ) : shown.length === 0 ? (
        <p className="py-16 text-center text-base text-ink/65">No media yet — upload your first file.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((a) => {
            const on = sel.includes(a.id);
            const already = exclude.includes(a.id);
            return (
              <li key={a.id}>
                <button
                  onClick={() => toggle(a.id)}
                  aria-pressed={on}
                  className={`group relative block w-full overflow-hidden rounded-lg border-2 text-left ${on ? "border-royal ring-2 ring-royal/30" : "border-line hover:border-royal/50"}`}
                >
                  <Thumb m={a} className="aspect-square w-full" />
                  {on && <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-royal text-sm font-bold text-white">{single ? "✓" : sel.indexOf(a.id) + 1}</span>}
                  {a.kind === "VIDEO" && <span className="absolute left-1.5 top-1.5 rounded bg-navy/85 px-1.5 py-0.5 text-xs font-semibold text-white"><Film className="inline h-3 w-3" /> Video</span>}
                  {already && <span className="absolute bottom-7 left-1.5 rounded bg-gold px-1.5 py-0.5 text-xs font-semibold text-navy">Attached</span>}
                  <span className="block truncate px-2 py-1.5 text-sm text-ink/80" title={a.originalName}>{a.originalName}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/** Ordered multi-media attachment field used by every CMS collection item. */
export function MediaField({
  value,
  onChange,
  help,
  error,
}: {
  value: MediaRef[];
  onChange: (v: MediaRef[]) => void;
  help?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const c = [...value];
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  };
  const setAsCover = (index: number) => {
    if (index === 0) return;
    const next = [...value];
    const [chosen] = next.splice(index, 1);
    next.unshift(chosen);
    onChange(next);
  };
  return (
    <div className={`rounded-xl border p-4 ${error ? "border-alert bg-red-50/40" : "border-line bg-canvas"}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-navy">Images & videos <span className="text-alert">*</span></p>
          <p className="text-sm text-ink/65">{help ?? "Attach at least one image or video — upload new or pick from the media library."}</p>
        </div>
        <Btn type="button" small variant="secondary" onClick={() => setOpen(true)}><ImagePlus className="h-4 w-4" /> Add media</Btn>
      </div>
      {value.length === 0 ? (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full flex-col items-center rounded-lg border-2 border-dashed border-line bg-white py-8 text-ink/70 hover:border-royal hover:text-royal">
          <ImagePlus className="h-8 w-8" /> <span className="mt-1 font-medium">No media attached — click to add</span>
        </button>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {value.map((m, i) => (
            <li key={m.id} className="group relative overflow-hidden rounded-lg border border-line bg-white shadow-sm">
              <Thumb m={m} className="aspect-square w-full" />
              {i === 0 ? (
                <span className="absolute left-1.5 top-1.5 rounded bg-gold px-2 py-0.5 text-xs font-bold text-navy shadow">Cover</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAsCover(i)}
                  className="absolute left-1.5 top-1.5 rounded bg-navy/80 hover:bg-gold hover:text-navy px-1.5 py-0.5 text-xs font-semibold text-white shadow transition-colors"
                  title="Click to set as cover image"
                >
                  Set cover
                </button>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-navy/85 px-1 py-1 text-white opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" className="rounded p-1 hover:bg-white/20 disabled:opacity-30"><ArrowLeft className="h-4 w-4" /></button>
                {i !== 0 && (
                  <button type="button" onClick={() => setAsCover(i)} title="Make cover" className="rounded px-1.5 py-0.5 text-xs font-semibold hover:bg-gold hover:text-navy">
                    Cover
                  </button>
                )}
                <button type="button" onClick={() => onChange(value.filter((x) => x.id !== m.id))} aria-label="Remove media" className="rounded p-1 hover:bg-alert"><X className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move later" className="rounded p-1 hover:bg-white/20 disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <MediaPickerModal
          exclude={value.map((v) => v.id)}
          onClose={() => setOpen(false)}
          onPick={(picked) => {
            const have = new Set(value.map((v) => v.id));
            onChange([...value, ...picked.filter((p) => !have.has(p.id)).map((p) => ({ id: p.id, url: p.url, kind: p.kind, originalName: p.originalName }))]);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
