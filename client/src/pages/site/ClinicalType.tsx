import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Reveal } from "@/components/Reveal";
import { PageHero, Cover, EmptyState } from "@/components/site/ui";
import { coverOf, type MediaRef } from "@/lib/utils";

type Item = { id: string; slug: string; title: string; shortSummary: string; category?: string; contentHtml: string; media: MediaRef[] };
const META: Record<string, { label: string; desc: string }> = {
  specialties: { label: "Specialties", desc: "Focused clinics led by experienced physicians." },
  treatments: { label: "Treatments", desc: "Evidence-based treatment pathways and daycare protocols." },
  services: { label: "Services", desc: "Daycare, diagnostics, pharmacy and support services." },
};

export default function ClinicalTypePage() {
  const { type } = useParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const meta = META[type ?? ""] ?? META.specialties;

  useEffect(() => {
    document.title = `${meta.label} | Rithanya Hospital`;
    setLoading(true);
    fetch(`/api/public/clinical?type=${type}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [type]);

  return (
    <>
      <PageHero eyebrow="Clinical care" title={meta.label} desc={meta.desc} />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:py-24">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2].map((i)=><div key={i} className="h-72 animate-pulse rounded-xl bg-line/60" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState title="Nothing here yet" text="This collection is being updated. Please check back soon." />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((x, i) => (
              <Reveal key={x.id} delay={(i % 3) * 70}>
                <Link to={`/clinical-care/${type}/${x.slug}`} className="group block h-full overflow-hidden rounded-xl border border-line bg-white transition-all hover:-translate-y-1 hover:shadow-xl">
                  <div className="aspect-[16/10] overflow-hidden"><Cover media={x.media} alt={x.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /></div>
                  <div className="p-6">
                    {x.category && <p className="text-sm font-semibold uppercase tracking-wider text-royal">{x.category}</p>}
                    <h3 className="mt-1 text-xl font-semibold group-hover:text-royal">{x.title}</h3>
                    <p className="mt-2 line-clamp-3 text-ink/80">{x.shortSummary}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
