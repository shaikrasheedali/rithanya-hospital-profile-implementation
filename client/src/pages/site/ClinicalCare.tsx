import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/Reveal";
import { ClinicalHub, type HubItem } from "@/components/site/ClinicalHub";
import { PageHero, Cover } from "@/components/site/ui";
import { coverOf, type MediaRef } from "@/lib/utils";

type Raw = { id: string; slug: string; title: string; shortSummary: string; category?: string; media: MediaRef[] };

export default function ClinicalCarePage() {
  const [data, setData] = useState<Record<string, HubItem[]> | null>(null);

  useEffect(() => {
    document.title = "Clinical Care | Rithanya Hospital";
    Promise.all([
      fetch("/api/public/clinical?type=specialties").then((r) => r.json()),
      fetch("/api/public/clinical?type=treatments").then((r) => r.json()),
      fetch("/api/public/clinical?type=services").then((r) => r.json()),
    ])
      .then(([sp, tr, sv]) => {
        const map = (rows: Raw[]): HubItem[] =>
          rows.map((x) => ({ id: x.id, slug: x.slug, title: x.title, summary: x.shortSummary, category: x.category, cover: coverOf(x.media) }));
        setData({ specialties: map(sp.items ?? []), treatments: map(tr.items ?? []), services: map(sv.items ?? []) });
      })
      .catch(() => undefined);
  }, []);

  return (
    <>
      <PageHero eyebrow="Clinical care" title="Specialties, treatments & services" desc="Search across every department — from thalassemia daycare to diagnostics and senior wellness." />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:py-24">
        {!data ? (
          <div className="animate-pulse space-y-4" aria-busy="true"><div className="h-12 rounded-full bg-line/60" /><div className="grid gap-6 sm:grid-cols-3">{[0,1,2].map((i)=><div key={i} className="h-64 rounded-xl bg-line/60" />)}</div></div>
        ) : (
          <Reveal><ClinicalHub data={data as Record<"specialties"|"treatments"|"services", HubItem[]>} /></Reveal>
        )}
        <div className="mt-12 rounded-xl border border-line bg-white p-6 text-center text-ink/80">
          Not sure where to start? <Link to="/contact" className="font-semibold text-royal hover:text-alert">Contact our front desk</Link> — we will guide you to the right department.
        </div>
      </section>
    </>
  );
}

export function ClinicalTypeBrief({ items }: { items: Raw[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((x, i) => (
        <Reveal key={x.id} delay={(i % 3) * 70}>
          <Link to="." className="block overflow-hidden rounded-xl border border-line bg-white">
            <div className="aspect-[16/10]"><Cover media={x.media} alt={x.title} className="h-full w-full object-cover" /></div>
            <div className="p-6"><h3 className="text-xl font-semibold">{x.title}</h3><p className="mt-2 text-ink/80">{x.shortSummary}</p></div>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}
