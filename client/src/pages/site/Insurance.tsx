import { useEffect, useState } from "react";
import { Reveal } from "@/components/Reveal";
import { PageHero, Cover } from "@/components/site/ui";
import type { MediaRef } from "@/lib/utils";

type P = { id: string; name: string; schemeType: string; descriptionHtml: string; media: MediaRef[] };

export default function InsurancePage() {
  const [items, setItems] = useState<P[]>([]);
  useEffect(() => {
    document.title = "Insurance Providers | Rithanya Hospital";
    fetch("/api/public/insurance").then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => undefined);
  }, []);
  return (
    <>
      <PageHero eyebrow="Cashless care" title="Insurance & scheme partners" desc="PM-JAY, Aarogyasri and private TPAs — our desk handles paperwork and pre-authorisation." />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {items.map((p, i) => (
            <Reveal key={p.id} delay={i * 70}>
              <div className="h-full overflow-hidden rounded-xl border border-line bg-white">
                <div className="aspect-[8/5] overflow-hidden"><Cover media={p.media} alt={p.name} className="h-full w-full object-cover" /></div>
                <div className="p-6">
                  <p className="text-sm font-semibold uppercase tracking-wider text-royal">{p.schemeType}</p>
                  <h3 className="mt-1 text-xl font-semibold">{p.name}</h3>
                  <div className="prose-rh mt-3" dangerouslySetInnerHTML={{ __html: p.descriptionHtml }} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
