import { useEffect, useState } from "react";
import { PageHero } from "@/components/site/ui";
import { GalleryHub } from "@/components/site/GalleryHub";
import type { MediaRef } from "@/lib/utils";

type G = { id: string; title: string; caption: string; mediaType: "IMAGE"|"VIDEO"|"IFRAME_YOUTUBE"|"IFRAME_FACEBOOK"|"IFRAME_INSTAGRAM"; embedCode: string; media: MediaRef[] };

export default function GalleryPage() {
  const [items, setItems] = useState<G[]>([]);
  useEffect(() => {
    document.title = "Gallery | Rithanya Hospital";
    fetch("/api/public/gallery").then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => undefined);
  }, []);
  return (
    <>
      <PageHero eyebrow="Media gallery" title="Inside Rithanya Hospital" desc="Wards, labs, daycare beds and community camps — plus video stories." />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:py-24">
        <GalleryHub items={items} />
      </section>
    </>
  );
}
