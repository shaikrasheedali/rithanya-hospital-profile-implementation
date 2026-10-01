"use client";

import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { MediaRef } from "@/lib/utils";

export type HubItem = { id: string; slug: string; title: string; summary: string; category?: string; cover?: MediaRef };

const TABS = [
  { key: "specialties", label: "Specialties" },
  { key: "treatments", label: "Treatments" },
  { key: "services", label: "Services" },
] as const;

export function ClinicalHub({ data }: { data: Record<(typeof TABS)[number]["key"], HubItem[]> }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("specialties");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  const items = data[tab];
  const cats = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[]))], [items]);
  const filtered = items.filter(
    (i) =>
      (cat === "All" || i.category === cat) &&
      (!q || (i.title + " " + i.summary).toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Clinical collections" className="inline-flex rounded-full border border-line bg-white p-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => {
                setTab(t.key);
                setCat("All");
              }}
              className={`rounded-full px-5 py-2.5 font-semibold ${tab === t.key ? "bg-navy text-white" : "text-ink hover:text-royal"}`}
            >
              {t.label} <span className="ml-1 text-sm opacity-70">{data[t.key].length}</span>
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:w-80">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink/50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${tab}…`}
            className="w-full rounded-full border border-line bg-white py-3 pl-12 pr-4 focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20"
          />
        </label>
      </div>

      {cats.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={`rounded-full border px-4 py-1.5 text-base font-medium ${cat === c ? "border-royal bg-royal text-white" : "border-line bg-white hover:border-royal hover:text-royal"}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {filtered.map((i) => (
          <Link key={i.id} to={`/clinical-care/${tab}/${i.slug}`} className="group overflow-hidden rounded-xl border border-line bg-white transition-all hover:-translate-y-1 hover:shadow-xl">
            <div className="aspect-[16/10] overflow-hidden">
              {i.cover ? (
                i.cover.kind === "VIDEO" ? (
                  <video src={`${i.cover.url}#t=0.2`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.cover.url} alt={i.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                )
              ) : (
                <div className="h-full bg-gradient-to-br from-navy to-royal" />
              )}
            </div>
            <div className="p-6">
              {i.category && <p className="text-sm font-semibold uppercase tracking-wider text-royal">{i.category}</p>}
              <h3 className="mt-1 text-xl font-semibold group-hover:text-royal">{i.title}</h3>
              <p className="mt-2 line-clamp-3 text-ink/80">{i.summary}</p>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && <p className="col-span-full rounded-xl border border-dashed border-line bg-white p-10 text-center text-ink/70">No results match your search.</p>}
      </div>
    </div>
  );
}
