"use client";

import { useMemo, useState } from "react";
import { Eye, PackageCheck, Pill, Search, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/site/CartProvider";
import { MediaGallery } from "@/components/site/MediaGallery";
import { SafeImg, SafeVideo } from "@/components/site/ui";
import { coverOf, formatINR, type MediaRef } from "@/lib/utils";

export type ProductDTO = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stockUnits: number;
  isPrescriptionReq: boolean;
  media: MediaRef[];
};

function Thumb({ media, alt }: { media: MediaRef[]; alt: string }) {
  const c = coverOf(media);
  if (!c) return <div className="h-full w-full bg-gradient-to-br from-navy to-royal" />;
  if (c.kind === "VIDEO") return <SafeVideo src={`${c.url}#t=0.2`} className="h-full w-full object-cover" />;
  return <SafeImg src={c.url} alt={alt} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />;
}

export function ProductGrid({ products }: { products: ProductDTO[] }) {
  const { add } = useCart();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [inStock, setInStock] = useState(false);
  const [quick, setQuick] = useState<ProductDTO | null>(null);
  const cats = useMemo(() => ["All", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const list = products.filter(
    (p) =>
      (cat === "All" || p.category === cat) &&
      (!inStock || p.stockUnits > 0) &&
      (!q || (p.name + " " + p.description).toLowerCase().includes(q.toLowerCase())),
  );

  const addToCart = (p: ProductDTO) =>
    add({ id: p.id, name: p.name, price: p.price, stock: p.stockUnits, image: coverOf(p.media)?.kind === "IMAGE" ? coverOf(p.media)?.url : undefined });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="relative block w-full sm:w-96">
          <span className="sr-only">Search products</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search glucometer, strips, BP monitor…" className="w-full rounded-full border border-line bg-white py-3 pl-12 pr-4 focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20" />
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 font-medium">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="h-5 w-5 accent-[#0D47A1]" /> In stock only
        </label>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={`rounded-full border px-4 py-1.5 font-medium ${cat === c ? "border-royal bg-royal text-white" : "border-line bg-white hover:border-royal hover:text-royal"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        {list.map((p) => {
          const out = p.stockUnits <= 0;
          return (
            <article key={p.id} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-shadow hover:shadow-xl">
              <button onClick={() => setQuick(p)} className="relative block aspect-square overflow-hidden" aria-label={`Quick view ${p.name}`}>
                <Thumb media={p.media} alt={p.name} />
                <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-navy opacity-0 shadow transition-opacity group-hover:opacity-100">
                  <Eye className="h-4 w-4" /> Quick view
                </span>
                {p.isPrescriptionReq && <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-alert px-3 py-1 text-sm font-semibold text-white"><Pill className="h-4 w-4" /> Rx</span>}
              </button>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-sm font-semibold uppercase tracking-wider text-royal">{p.category}</p>
                <h3 className="mt-1 text-lg font-semibold leading-snug">{p.name}</h3>
                <p className="mt-auto pt-4 font-heading text-2xl font-bold text-navy">{formatINR(p.price)}</p>
                <p className={`mt-1 text-sm font-semibold ${out ? "text-alert" : p.stockUnits <= 5 ? "text-amber-700" : "text-emerald-700"}`}>
                  {out ? "Out of stock" : p.stockUnits <= 5 ? `Only ${p.stockUnits} left` : "In stock"}
                </p>
                <button onClick={() => addToCart(p)} disabled={out} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-royal px-4 py-3 font-semibold text-white hover:bg-alert disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600">
                  <ShoppingBag className="h-5 w-5" /> Add to cart
                </button>
              </div>
            </article>
          );
        })}
        {list.length === 0 && <p className="col-span-full rounded-xl border border-dashed border-line bg-white p-10 text-center text-ink/70">No products match your filters.</p>}
      </div>

      {quick && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={quick.name}>
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setQuick(null)} />
          <div className="relative grid max-h-[92vh] w-full max-w-4xl gap-8 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl md:grid-cols-2 md:p-8">
            <button onClick={() => setQuick(null)} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-full bg-white p-2 shadow hover:bg-canvas"><X className="h-5 w-5" /></button>
            <MediaGallery media={quick.media} alt={quick.name} aspect="aspect-square" />
            <div className="flex flex-col">
              <p className="text-sm font-semibold uppercase tracking-wider text-royal">{quick.category}</p>
              <h2 className="mt-1 text-2xl font-semibold">{quick.name}</h2>
              <p className="mt-3 font-heading text-3xl font-bold text-navy">{formatINR(quick.price)}</p>
              <p className="mt-4 leading-relaxed text-ink/90">{quick.description || "Quality wellness product from the Rithanya Hospital pharmacy."}</p>
              {quick.isPrescriptionReq && <p className="mt-3 rounded-lg bg-alert/10 p-3 font-medium text-alert">Prescription required — please keep it ready at delivery.</p>}
              <p className="mt-4 flex items-center gap-2 text-emerald-700"><PackageCheck className="h-5 w-5" /> {quick.stockUnits > 0 ? `${quick.stockUnits} units available` : "Currently out of stock"}</p>
              <button onClick={() => { addToCart(quick); setQuick(null); }} disabled={quick.stockUnits <= 0} className="mt-auto flex items-center justify-center gap-2 rounded-full bg-royal px-6 py-3.5 font-semibold text-white hover:bg-alert disabled:bg-gray-300 disabled:text-gray-600">
                <ShoppingBag className="h-5 w-5" /> Add to cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
