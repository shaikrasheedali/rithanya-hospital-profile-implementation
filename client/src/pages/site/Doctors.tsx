import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/Reveal";
import { PageHero, Cover, EmptyState } from "@/components/site/ui";
import type { MediaRef } from "@/lib/utils";

type Doctor = { id: string; slug: string; fullName: string; qualifications: string; designation: string; department: string; consultationTimings: string; isVisiting: boolean; media: MediaRef[] };

export default function DoctorsPage() {
  const [items, setItems] = useState<Doctor[]>([]);
  useEffect(() => {
    document.title = "Doctors | Rithanya Hospital";
    fetch("/api/public/doctors").then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => undefined);
  }, []);
  return (
    <>
      <PageHero eyebrow="Medical team" title="Meet our doctors" desc="Experienced physicians and visiting specialists — unhurried consultations, clear explanations." />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:py-24">
        {items.length === 0 ? <EmptyState title="Loading…" text="Fetching doctor profiles." /> : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((d, i) => (
              <Reveal key={d.id} delay={(i % 3) * 70}>
                <Link to={`/doctors/${d.slug}`} className="group block h-full overflow-hidden rounded-xl border border-line bg-white transition-all hover:-translate-y-1 hover:shadow-xl">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <Cover media={d.media} alt={d.fullName} className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105" />
                    {d.isVisiting && <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 text-sm font-semibold text-navy">Visiting faculty</span>}
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold group-hover:text-royal">{d.fullName}</h3>
                    <p className="font-medium text-royal">{d.designation} · {d.qualifications}</p>
                    <p className="mt-1 text-ink/80">{d.department}</p>
                    {d.consultationTimings && <p className="mt-2 text-sm text-ink/65">{d.consultationTimings}</p>}
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
