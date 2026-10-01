"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { SafeImg, SafeVideo } from "@/components/site/ui";
import type { MediaRef } from "@/lib/utils";

export function MediaGallery({ media, alt, aspect = "aspect-[16/10]" }: { media: MediaRef[]; alt: string; aspect?: string }) {
  const [i, setI] = useState(0);
  if (!media.length) return null;
  const cur = media[Math.min(i, media.length - 1)];
  const go = (d: number) => setI((v) => (v + d + media.length) % media.length);
  return (
    <div>
      <div className={`relative overflow-hidden rounded-xl border border-line bg-navy ${aspect}`}>
        {cur.kind === "VIDEO" ? (
          <SafeVideo key={cur.id} src={cur.url} controls className="h-full w-full bg-black object-contain" />
        ) : (
          <SafeImg key={cur.id} src={cur.url} alt={alt} className="h-full w-full object-cover" />
        )}
        {media.length > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="Previous media" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-navy shadow-lg hover:bg-white">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => go(1)} aria-label="Next media" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-navy shadow-lg hover:bg-white">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
      {media.length > 1 && (
        <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {media.map((m, idx) => (
            <li key={m.id}>
              <button
                onClick={() => setI(idx)}
                aria-label={`Show media ${idx + 1}`}
                aria-current={idx === i}
                className={`relative block h-20 w-28 overflow-hidden rounded-lg border-2 ${idx === i ? "border-royal" : "border-transparent opacity-70 hover:opacity-100"}`}
              >
                {m.kind === "VIDEO" ? (
                  <>
                    <SafeVideo src={`${m.url}#t=0.2`} className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-navy/30 text-white"><Play className="h-5 w-5" /></span>
                  </>
                ) : (
                  <SafeImg src={m.url} alt="" className="h-full w-full object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
