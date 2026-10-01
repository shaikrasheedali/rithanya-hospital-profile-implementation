import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Reveal } from "@/components/Reveal";
import { MediaGallery } from "@/components/site/MediaGallery";
import { formatDate } from "@/lib/utils";
import type { MediaRef } from "@/lib/utils";

type Post = { id: string; title: string; slug: string; category: string; authorName: string; excerpt: string; contentHtml: string; publishedAt: string; media: MediaRef[] };

export default function InsightDetailPage() {
  const { slug } = useParams();
  const [b, setB] = useState<Post | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    fetch(`/api/public/blogs/${slug}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => {
      setB(d.item); document.title = `${d.item.title} | Rithanya Hospital`;
      return fetch(`/api/public/blogs?category=${encodeURIComponent(d.item.category)}&pageSize=4`).then((r) => r.json());
    }).then((d) => setRelated((d.posts ?? []).filter((x: Post) => x.slug !== slug).slice(0, 2))).catch(() => setMissing(true));
  }, [slug]);
  if (missing) return <div className="mx-auto max-w-7xl px-6 py-32 text-center"><h1 className="text-3xl font-semibold">Article not found</h1><Link to="/insights" className="mt-4 inline-block font-semibold text-royal">← All insights</Link></div>;
  if (!b) return <div className="mx-auto max-w-7xl px-6 py-32"><div className="h-64 animate-pulse rounded-xl bg-line/60" /></div>;
  return (
    <>
      <section className="on-dark bg-mesh pb-14 pt-36 text-white sm:pt-44"><div className="mx-auto max-w-4xl px-6"><p className="text-sm uppercase tracking-[0.18em] text-gold">{b.category} · {formatDate(b.publishedAt)} · {b.authorName}</p><h1 className="mt-3 text-4xl font-semibold !text-white sm:text-5xl">{b.title}</h1><p className="mt-4 text-lg text-white/85">{b.excerpt}</p></div></section>
      <section className="mx-auto max-w-4xl px-6 py-14">
        <Reveal><MediaGallery media={b.media} alt={b.title} /></Reveal>
        <Reveal delay={70}><div className="prose-rh mt-8" dangerouslySetInnerHTML={{ __html: b.contentHtml }} /></Reveal>
        {related.length > 0 && <div className="mt-12 grid gap-5 sm:grid-cols-2">{related.map((r) => <Link key={r.id} to={`/insights/${r.slug}`} className="rounded-xl border border-line bg-white p-5 hover:border-royal"><h3 className="font-semibold">{r.title}</h3><p className="mt-1 line-clamp-2 text-ink/70">{r.excerpt}</p></Link>)}</div>}
      </section>
    </>
  );
}
