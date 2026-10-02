import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHero } from "@/components/site/ui";
import { ProductGrid } from "@/components/site/ProductGrid";
import type { MediaRef } from "@/lib/utils";

type Product = { id: string; name: string; category: string; description: string; price: number; stockUnits: number; isPrescriptionReq: boolean; media: MediaRef[] };

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    document.title = "Pharmacy & Wellness Store | Rithanya Hospital";
    let alive = true;
    setLoading(true);
    fetch("/api/public/products")
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load products — please try again.");
        return r.json();
      })
      .then((d) => { if (alive) { setItems(d.items ?? []); setError(null); } })
      .catch((e) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Could not load products — please try again.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  return (
    <>
      <PageHero eyebrow="Pharmacy & wellness" title="Order medicines & wellness essentials" desc="Cash on delivery or UPI · Free delivery above ₹500 · Prescription items verified on call." />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:py-24">
        {loading ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{[0,1,2,3].map((i)=><div key={i} className="h-72 animate-pulse rounded-xl bg-line/60" />)}</div>
        : error ? <div className="text-center"><p role="alert" className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 font-medium text-red-900">{error}</p><button onClick={() => window.location.reload()} className="mt-6 rounded-full bg-royal px-6 py-3 font-semibold text-white">Try again</button></div>
        : items.length === 0 ? <p className="py-16 text-center text-ink/70">No products available right now. Please check back shortly.</p>
        : <ProductGrid products={items} />}
      </section>
    </>
  );
}
