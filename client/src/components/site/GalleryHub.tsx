"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Film, Images, Play, Share2, X } from "lucide-react";
import { MediaGallery } from "@/components/site/MediaGallery";
import { SafeImg, SafeVideo } from "@/components/site/ui";
import { coverOf, type MediaRef } from "@/lib/utils";

export type GalleryDTO = {
  id: string;
  title: string;
  caption: string;
  mediaType: "IMAGE" | "VIDEO" | "IFRAME_YOUTUBE" | "IFRAME_FACEBOOK" | "IFRAME_INSTAGRAM";
  embedCode: string;
  media: MediaRef[];
};

const ALLOWED = ["youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "www.facebook.com", "facebook.com", "web.facebook.com", "www.instagram.com", "instagram.com", "player.vimeo.com"];

/** Convert pasted iframe HTML / public URLs into a safe, allow-listed embed src. */
export function toEmbedSrc(code: string, type: GalleryDTO["mediaType"]): string | null {
  const m = /src=["']([^"']+)["']/i.exec(code);
  let raw = (m ? m[1] : code).trim();
  if (raw.startsWith("//")) raw = "https:" + raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !ALLOWED.includes(url.hostname)) return null;
  if (type === "IFRAME_YOUTUBE") {
    if (url.pathname.startsWith("/embed/")) return url.toString();
    const id = url.hostname.includes("youtu") ? url.searchParams.get("v") : null;
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : url.toString();
  }
  if (type === "IFRAME_FACEBOOK" && !url.pathname.includes("/plugins/"))
    return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url.toString())}&show_text=true&width=500`;
  if (type === "IFRAME_INSTAGRAM" && !url.pathname.endsWith("/embed") && !url.pathname.endsWith("/embed/"))
    return `${url.origin}${url.pathname.replace(/\/?$/, "/")}embed`;
  return url.toString();
}

const TABS = [
  { key: "ALL", label: "All" },
  { key: "IMAGE", label: "Images" },
  { key: "VIDEO", label: "Native Videos" },
  { key: "EMBED", label: "Social Embeds" },
] as const;

export function GalleryHub({ items }: { items: GalleryDTO[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("ALL");
  const [open, setOpen] = useState<number | null>(null);
  const list = items.filter((i) => (tab === "ALL" ? true : tab === "EMBED" ? i.mediaType.startsWith("IFRAME") : i.mediaType === tab));

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((v) => (v === null ? v : (v + 1) % list.length));
      if (e.key === "ArrowLeft") setOpen((v) => (v === null ? v : (v - 1 + list.length) % list.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, list.length]);

  const cur = open !== null ? list[open] : null;
  const embed = cur && cur.mediaType.startsWith("IFRAME") ? toEmbedSrc(cur.embedCode, cur.mediaType) : null;

  return (
    <div>
      <div role="tablist" aria-label="Gallery filter" className="mb-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`rounded-full border px-5 py-2.5 font-semibold ${tab === t.key ? "border-navy bg-navy text-white" : "border-line bg-white hover:border-royal hover:text-royal"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white p-12 text-center text-ink/70">Nothing in this category yet — check back soon.</p>
      ) : (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
          {list.map((g, idx) => {
            const c = coverOf(g.media);
            const isEmbed = g.mediaType.startsWith("IFRAME");
            return (
              <button key={g.id} onClick={() => setOpen(idx)} className="group relative block w-full break-inside-avoid overflow-hidden rounded-xl border border-line bg-white text-left shadow-sm hover:shadow-xl" aria-label={`Open ${g.title}`}>
                {c?.kind === "VIDEO" ? (
                  <SafeVideo src={`${c.url}#t=0.2`} className="w-full object-cover" />
                ) : c ? (
                  <SafeImg src={c.url} alt={g.title} className="w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-navy to-royal" />
                )}
                {(c?.kind === "VIDEO" || isEmbed) && (
                  <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy shadow-lg"><Play className="h-6 w-6 translate-x-0.5" /></span>
                )}
                <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-navy/85 px-3 py-1 text-sm font-semibold text-white">
                  {isEmbed ? <Share2 className="h-4 w-4" /> : g.mediaType === "VIDEO" ? <Film className="h-4 w-4" /> : <Images className="h-4 w-4" />}
                  {isEmbed ? "Social" : g.mediaType === "VIDEO" ? "Video" : g.media.length > 1 ? `${g.media.length} photos` : "Photo"}
                </span>
                <span className="block p-4">
                  <span className="block font-semibold text-navy">{g.title}</span>
                  {g.caption && <span className="mt-0.5 block text-base text-ink/70">{g.caption}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {cur && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-navy/95 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={cur.title}>
          <button onClick={() => setOpen(null)} aria-label="Close lightbox" className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><X className="h-6 w-6" /></button>
          {list.length > 1 && (
            <>
              <button onClick={() => setOpen((open! - 1 + list.length) % list.length)} aria-label="Previous" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><ChevronLeft className="h-7 w-7" /></button>
              <button onClick={() => setOpen((open! + 1) % list.length)} aria-label="Next" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><ChevronRight className="h-7 w-7" /></button>
            </>
          )}
          <div className="w-full max-w-4xl">
            {embed ? (
              <iframe title={cur.title} src={embed} className="aspect-video w-full rounded-xl border-0 bg-black" allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
            ) : cur.mediaType.startsWith("IFRAME") ? (
              <div className="rounded-xl bg-white p-8 text-center text-navy">This embed could not be displayed. Please check the embed code in the CMS.</div>
            ) : (
              <MediaGallery media={cur.media} alt={cur.title} aspect="aspect-video" />
            )}
            <div className="mt-4 text-white">
              <p className="font-heading text-xl font-semibold">{cur.title}</p>
              {cur.caption && <p className="mt-1 text-white/80">{cur.caption}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
