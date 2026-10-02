import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Reveal } from "@/components/Reveal";
import { ClinicalHub, type HubItem } from "@/components/site/ClinicalHub";
import { PageHero, Cover } from "@/components/site/ui";
import { coverOf, type MediaRef } from "@/lib/utils";

type Raw = { id: string; slug: string; title: string; shortSummary: string; category?: string; media: MediaRef[] };

export default function ClinicalCarePage() {
  const [data, setData] = useState<Record<string, HubItem[]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Clinical Care | Rithanya Hospital";
    let alive = true;
    Promise.all([
      fetch("/api/public/clinical?type=specialties").then(async (r) => {
        if (!r.ok) throw new Error("Could not load clinical care — please try again.");
        return r.json();
      }),
      fetch("/api/public/clinical?type=treatments").then(async (r) => {
        if (!r.ok) throw new Error("Could not load clinical care — please try again.");
        return r.json();
      }),
      fetch("/api/public/clinical?type=services").then(async (r) => {
        if (!r.ok) throw new Error("Could not load clinical care — please try again.");
        return r.json();
      }),
    ])
      .then(([sp, tr, sv]) => {
        if (!alive) return;
        const map = (rows: Raw[]): HubItem[] =>
          rows.map((x) => ({ id: x.id, slug: x.slug, title: x.title, summary: x.shortSummary, category: x.category, cover: coverOf(x.media) }));
        setData({ specialties: map(sp.items ?? []), treatments: map(tr.items ?? []), services: map(sv.items ?? []) });
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Could not load clinical care — please try again.";
        setError(msg);
        toast.error(msg);
      });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <PageHero eyebrow="Clinical care" title="Specialties, treatments & services" desc="Search across every department — from thalassemia daycare to diagnostics and senior wellness." />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:py-24">
        {error && !data ? (
          <div className="text-center"><p role="alert" className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 font-medium text-red-900">{error}</p><button onClick={() => window.location.reload()} className="mt-6 rounded-full bg-royal px-6 py-3 font-semibold text-white">Try again</button></div>
        ) : !data ? (
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
          <Link to={`/clinical-care/specialties/${x.slug}`} className="block overflow-hidden rounded-xl border border-line bg-white transition-all hover:-translate-y-1 hover:shadow-xl">
            <div className="aspect-[16/10]"><Cover media={x.media} alt={x.title} className="h-full w-full object-cover" /></div>
            <div className="p-6"><h3 className="text-xl font-semibold">{x.title}</h3><p className="mt-2 text-ink/80">{x.shortSummary}</p></div>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}
