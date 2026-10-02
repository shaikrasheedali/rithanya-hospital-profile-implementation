import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Reveal } from "@/components/Reveal";
import { PageHero, Cover } from "@/components/site/ui";
import type { MediaRef } from "@/lib/utils";

type P = { id: string; name: string; schemeType: string; descriptionHtml: string; media: MediaRef[] };

export default function InsurancePage() {
  const [items, setItems] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    document.title = "Insurance Providers | Rithanya Hospital";
    let alive = true;
    setLoading(true);
    fetch("/api/public/insurance")
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load insurance partners — please try again.");
        return r.json();
      })
      .then((d) => { if (alive) { setItems(d.items ?? []); setError(null); } })
      .catch((e) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Could not load insurance partners — please try again.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  return (
    <>
      <PageHero eyebrow="Cashless care" title="Insurance & scheme partners" desc="PM-JAY, Aarogyasri and private TPAs — our desk handles paperwork and pre-authorisation." />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8">
        {loading ? <div className="grid gap-6 lg:grid-cols-3">{[0,1,2].map((i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-line/60" />)}</div>
        : error ? <div className="text-center"><p role="alert" className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 font-medium text-red-900">{error}</p><button onClick={() => window.location.reload()} className="mt-6 rounded-full bg-royal px-6 py-3 font-semibold text-white">Try again</button></div>
        : items.length === 0 ? <p className="py-10 text-center text-ink/70">No insurance partners listed right now. Please call the helpdesk for cashless assistance.</p>
        : (
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
        )}
      </section>
    </>
  );
}
