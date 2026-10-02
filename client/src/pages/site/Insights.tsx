import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Reveal } from "@/components/Reveal";
import { PageHero, Cover, EmptyState } from "@/components/site/ui";
import { formatDate } from "@/lib/utils";
import type { MediaRef } from "@/lib/utils";

type Post = { id: string; title: string; slug: string; category: string; excerpt: string; publishedAt: string; media: MediaRef[] };
const CATS = ["All", "Diabetes Management", "Blood Disorders", "Maternal Health", "General Wellness"];

export default function InsightsPage() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const category = sp.get("category") ?? "All";
  const rawPage = Number(sp.get("page") ?? 1);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 6;

  useEffect(() => {
    document.title = "Health Insights | Rithanya Hospital";
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (category !== "All") qs.set("category", category);
    qs.set("page", String(page));
    qs.set("pageSize", String(pageSize));
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/public/blogs?${qs}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load articles — please try again.");
        return r.json();
      })
      .then((d) => { if (alive) { setPosts(d.posts ?? []); setTotal(d.total ?? 0); } })
      .catch((e) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Could not load articles — please try again.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [q, category, page]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (!v || v === "All" && k === "category") n.delete(k); else n.set(k, v); if (k !== "page") n.delete("page"); setSp(n); };

  return (
    <>
      <PageHero eyebrow="Health insights" title="Learn from our clinicians" desc="Practical guides on diabetes, thalassemia, maternal health and seasonal illness." />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center">
          <input value={q} onChange={(e) => set("q", e.target.value)} placeholder="Search articles…" className="w-full rounded-full border border-line bg-white px-5 py-3 lg:max-w-md" aria-label="Search articles" />
          <div className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button key={c} onClick={() => set("category", c)} className={`rounded-full border px-4 py-1.5 font-medium ${category === c ? "border-royal bg-royal text-white" : "border-line bg-white hover:border-royal hover:text-royal"}`}>{c}</button>
            ))}
          </div>
        </div>
        {loading ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{[0,1,2].map((i) => <div key={i} className="h-72 animate-pulse rounded-xl bg-line/60" />)}</div>
        : error ? <div className="text-center"><p role="alert" className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 font-medium text-red-900">{error}</p><button onClick={() => window.location.reload()} className="mt-6 rounded-full bg-royal px-6 py-3 font-semibold text-white">Try again</button></div>
        : posts.length === 0 ? <EmptyState title="No articles found" text="Try a different search or category." /> : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((b, i) => (
              <Reveal key={b.id} delay={(i % 3) * 70}>
                <Link to={`/insights/${b.slug}`} className="group block h-full overflow-hidden rounded-xl border border-line bg-white hover:-translate-y-1 hover:shadow-xl">
                  <div className="aspect-[16/10] overflow-hidden"><Cover media={b.media} alt={b.title} className="h-full w-full object-cover group-hover:scale-105" /></div>
                  <div className="p-6"><p className="text-sm font-semibold uppercase tracking-wider text-royal">{b.category} · {formatDate(b.publishedAt)}</p><h3 className="mt-2 text-xl font-semibold group-hover:text-royal">{b.title}</h3><p className="mt-2 line-clamp-3 text-ink/80">{b.excerpt}</p></div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
        {pages > 1 && (
          <div className="mt-10 flex justify-center gap-2">
            {Array.from({ length: pages }).map((_, i) => (
              <button key={i} onClick={() => set("page", String(i + 1))} className={`h-10 w-10 rounded-full font-semibold ${page === i + 1 ? "bg-navy text-white" : "border border-line bg-white hover:border-royal"}`}>{i + 1}</button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
