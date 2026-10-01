import { useEffect, useState } from "react";
import { PageHero } from "@/components/site/ui";
import { ProductGrid } from "@/components/site/ProductGrid";
import type { MediaRef } from "@/lib/utils";

type Product = { id: string; name: string; category: string; description: string; price: number; stockUnits: number; isPrescriptionReq: boolean; media: MediaRef[] };

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  useEffect(() => {
    document.title = "Pharmacy & Wellness Store | Rithanya Hospital";
    fetch("/api/public/products").then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => undefined);
  }, []);
  return (
    <>
      <PageHero eyebrow="Pharmacy & wellness" title="Order medicines & wellness essentials" desc="Cash on delivery or UPI · Free delivery above ₹500 · Prescription items verified on call." />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:py-24">
        {items.length === 0 ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{[0,1,2,3].map((i)=><div key={i} className="h-72 animate-pulse rounded-xl bg-line/60" />)}</div> : <ProductGrid products={items} />}
      </section>
    </>
  );
}
