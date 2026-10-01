import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Reveal } from "@/components/Reveal";
import { BookButton } from "@/components/site/BookButton";
import { MediaGallery } from "@/components/site/MediaGallery";
import { AppointmentForm } from "@/components/site/BookingProvider";
import type { MediaRef } from "@/lib/utils";

type Item = { id: string; slug: string; title: string; shortSummary: string; category?: string; contentHtml: string; media: MediaRef[] };

export default function ClinicalDetailPage() {
  const { type, slug } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [related, setRelated] = useState<Item[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch(`/api/public/clinical/${type}/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setItem(d.item);
        document.title = `${d.item.title} | Rithanya Hospital`;
        return fetch(`/api/public/clinical?type=${type}`).then((r) => r.json());
      })
      .then((d) => setRelated((d.items ?? []).filter((x: Item) => x.slug !== slug).slice(0, 3)))
      .catch(() => setMissing(true));
  }, [type, slug]);

  if (missing) return <div className="mx-auto max-w-7xl px-6 py-32 text-center"><h1 className="text-3xl font-semibold">Not found</h1><p className="mt-2 text-ink/70">This page no longer exists.</p><Link to="/clinical-care" className="mt-6 inline-block font-semibold text-royal">← Back to clinical care</Link></div>;
  if (!item) return <div className="mx-auto max-w-7xl px-6 py-32"><div className="h-64 animate-pulse rounded-xl bg-line/60" /></div>;

  return (
    <>
      <section className="on-dark relative overflow-hidden bg-mesh pb-16 pt-36 text-white sm:pb-20 sm:pt-44">
        <div className="bg-grid absolute inset-0 opacity-50" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-6 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold"><Link to="/clinical-care" className="hover:text-white">Clinical care</Link> / {type}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight !text-white sm:text-5xl">{item.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">{item.shortSummary}</p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.7fr_1fr]">
          <div>
            <Reveal><MediaGallery media={item.media} alt={item.title} /></Reveal>
            <Reveal delay={80}><div className="prose-rh mt-8" dangerouslySetInnerHTML={{ __html: item.contentHtml || `<p>${item.shortSummary}</p>` }} /></Reveal>
            {related.length > 0 && (
              <div className="mt-14">
                <h2 className="mb-6 text-2xl font-semibold">Related {type}</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  {related.map((r) => (
                    <Link key={r.id} to={`/clinical-care/${type}/${r.slug}`} className="rounded-xl border border-line bg-white p-5 hover:border-royal hover:shadow-lg">
                      <h3 className="font-semibold text-navy">{r.title}</h3>
                      <p className="mt-1 line-clamp-2 text-ink/75">{r.shortSummary}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-xl border border-line bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold">Book this consultation</h2>
              <p className="mt-1 text-ink/75">Our front desk will call to confirm your slot.</p>
              <div className="mt-5"><AppointmentForm defaultDepartment={item.title} compact /></div>
              <div className="mt-5 border-t border-line pt-5">
                <BookButton department={item.title} className="w-full rounded-full bg-gold px-6 py-3 font-semibold text-navy hover:bg-yellow-300">Quick book: {item.title.slice(0, 28)}</BookButton>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
