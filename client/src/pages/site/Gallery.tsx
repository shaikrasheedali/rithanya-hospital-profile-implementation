import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHero } from "@/components/site/ui";
import { GalleryHub } from "@/components/site/GalleryHub";
import type { MediaRef } from "@/lib/utils";

type G = { id: string; title: string; caption: string; mediaType: "IMAGE"|"VIDEO"|"IFRAME_YOUTUBE"|"IFRAME_FACEBOOK"|"IFRAME_INSTAGRAM"; embedCode: string; media: MediaRef[] };

export default function GalleryPage() {
  const [items, setItems] = useState<G[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    document.title = "Gallery | Rithanya Hospital";
    let alive = true;
    setLoading(true);
    fetch("/api/public/gallery")
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load gallery — please try again.");
        return r.json();
      })
      .then((d) => { if (alive) { setItems(d.items ?? []); setError(null); } })
      .catch((e) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Could not load gallery — please try again.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  return (
    <>
      <PageHero eyebrow="Media gallery" title="Inside Rithanya Hospital" desc="Wards, labs, daycare beds and community camps — plus video stories." />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:py-24">
        {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0,1,2,3].map((i) => <div key={i} className="h-52 animate-pulse rounded-xl bg-line/60" />)}</div>
        : error ? <div className="text-center"><p role="alert" className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 font-medium text-red-900">{error}</p><button onClick={() => window.location.reload()} className="mt-6 rounded-full bg-royal px-6 py-3 font-semibold text-white">Try again</button></div>
        : <GalleryHub items={items} />}
      </section>
    </>
  );
}
