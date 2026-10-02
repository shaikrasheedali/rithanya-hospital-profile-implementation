import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowUpRight, Play, Star } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { coverOf, type MediaRef } from "@/lib/utils";

/** Guaranteed-to-load SVG placeholder (same box, no layout shift) if a media file 404s. */
export const IMG_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A2540"/><stop offset="1" stop-color="#0D47A1"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><g fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"><path d="M400 250v100M350 300h100"/></g><text x="400" y="400" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" font-weight="bold" fill="#ffffff">Rithanya Hospital</text></svg>`,
  );

export function SafeImg({ src, alt = "", className = "" }: { src: string; alt?: string; className?: string }) {
  const [err, setErr] = useState(false);
  const cleanSrc = (src || "")
    .replace(/\/api\/media\/disk-\d+-/, "/api/media/")
    .replace(/\/api\/media\/disk-/, "/api/media/")
    .replace(/\/api\/media\/media-/, "/api/media/");

  useEffect(() => {
    setErr(false);
  }, [cleanSrc]);

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={err ? IMG_FALLBACK : cleanSrc} alt={alt} loading="lazy" className={className} onError={() => setErr(true)} />;
}

export function SafeVideo({ src, className = "", controls = false }: { src: string; className?: string; controls?: boolean }) {
  const [err, setErr] = useState(false);
  const cleanSrc = (src || "")
    .replace(/\/api\/media\/disk-\d+-/, "/api/media/")
    .replace(/\/api\/media\/disk-/, "/api/media/")
    .replace(/\/api\/media\/media-/, "/api/media/");

  useEffect(() => {
    setErr(false);
  }, [cleanSrc]);

  if (err) return <SafeImg src={IMG_FALLBACK} alt="" className={className} />;
  return (
    <video
      src={cleanSrc}
      muted={!controls}
      playsInline
      preload="metadata"
      controls={controls}
      className={className}
      onError={() => setErr(true)}
    />
  );
}

export function Cover({ media, alt = "", className = "" }: { media?: MediaRef[]; alt?: string; className?: string }) {
  const m = coverOf(media);
  if (!m) return <div className={`bg-gradient-to-br from-navy to-royal ${className}`} aria-hidden />;
  if (m.kind === "VIDEO")
    return (
      <div className={`relative bg-gradient-to-br from-navy to-royal ${className}`}>
        <SafeVideo src={`${m.url}#t=0.2`} className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-navy shadow-lg">
            <Play className="h-6 w-6 translate-x-0.5" />
          </span>
        </span>
      </div>
    );
  return <SafeImg src={m.url} alt={alt} className={className} />;
}

export function SectionHeading({
  eyebrow,
  title,
  desc,
  dark = false,
  center = false,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  dark?: boolean;
  center?: boolean;
}) {
  return (
    <Reveal className={`mb-12 max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      <p className={`mb-3 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] ${dark ? "text-gold" : "text-royal"} ${center ? "justify-center" : ""}`}>
        <span className={`h-px w-10 ${dark ? "bg-gold" : "bg-royal"}`} /> {eyebrow}
      </p>
      <h2 className={`text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl ${dark ? "!text-white" : ""}`}>{title}</h2>
      {desc && <p className={`mt-4 text-lg leading-relaxed ${dark ? "text-white/80" : "text-ink/80"}`}>{desc}</p>}
    </Reveal>
  );
}

export function PageHero({
  eyebrow,
  title,
  desc,
  children,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="on-dark relative overflow-hidden bg-mesh pb-16 pt-36 text-white sm:pb-20 sm:pt-44">
      <div className="bg-grid absolute inset-0 opacity-50" aria-hidden />
      <div className="absolute -right-24 top-10 h-80 w-80 animate-float rounded-full bg-royal/40 blur-3xl" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-6 sm:px-8">
        <p className="mb-4 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-gold">
          <span className="h-px w-10 bg-gold" /> {eyebrow}
        </p>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight !text-white sm:text-5xl lg:text-6xl">{title}</h1>
        {desc && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl">{desc}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

export function Stars({ n = 5 }: { n?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-5 w-5 ${i < n ? "fill-gold text-gold" : "text-line"}`} />
      ))}
    </span>
  );
}

export function NoticeBanner({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div role="note" className="bg-gold text-navy">
      <p className="mx-auto max-w-7xl px-6 py-3 text-center text-base font-semibold sm:px-8">{text}</p>
    </div>
  );
}

export function ArrowLink({ href, to, children, dark = false }: { href?: string; to?: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <Link to={to ?? href ?? "/"} className={`group inline-flex items-center gap-1.5 font-semibold ${dark ? "text-white hover:text-gold" : "text-royal hover:text-alert"}`}>
      {children}
      <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white p-12 text-center">
      <p className="text-xl font-semibold text-navy">{title}</p>
      <p className="mt-2 text-ink/70">{text}</p>
    </div>
  );
}
