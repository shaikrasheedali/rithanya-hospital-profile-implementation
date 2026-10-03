import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Calendar, CheckCircle2, ChevronRight, Phone, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { MediaGallery } from "@/components/site/MediaGallery";
import { BookButton } from "@/components/site/BookButton";
import { telHref, type MediaRef } from "@/lib/utils";
import { useSiteSettings } from "@/lib/settingsContext";

type FacilityItem = {
  id: string;
  slug: string;
  title: string;
  shortSummary: string;
  contentHtml: string;
  media: MediaRef[];
};

export default function FacilityDetailPage() {
  const { slug } = useParams();
  const { settings } = useSiteSettings();
  const [item, setItem] = useState<FacilityItem | null>(null);
  const [related, setRelated] = useState<FacilityItem[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch(`/api/public/facilities/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setItem(d.item);
        document.title = `${d.item.title} | Facilities | Rithanya Hospital`;
        return fetch("/api/public/facilities").then((r) => r.json());
      })
      .then((d) => setRelated((d.items ?? []).filter((x: FacilityItem) => x.slug !== slug).slice(0, 3)))
      .catch(() => setMissing(true));
  }, [slug]);

  if (missing) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-32 text-center">
        <h1 className="text-3xl font-semibold">Facility Not Found</h1>
        <p className="mt-2 text-ink/70">The requested hospital facility could not be located.</p>
        <Link to="/facilities" className="mt-6 inline-flex items-center gap-2 font-semibold text-royal">
          <ArrowLeft className="h-4 w-4" /> Back to all facilities
        </Link>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="h-64 animate-pulse rounded-2xl bg-line/60" />
      </div>
    );
  }

  return (
    <>
      <section className="on-dark relative overflow-hidden bg-mesh pb-16 pt-36 text-white sm:pb-20 sm:pt-44">
        <div className="bg-grid absolute inset-0 opacity-50" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-6 sm:px-8">
          <nav className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-gold" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-white">Home</Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            <Link to="/facilities" className="hover:text-white">Facilities</Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            <span className="truncate text-white/80">{item.title}</span>
          </nav>
          <h1 className="mt-3 max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl" style={{ fontFamily: "var(--font-heading)" }}>
            {item.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85 leading-relaxed">{item.shortSummary}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.7fr_1fr]">
          <div>
            <Reveal>
              <MediaGallery media={item.media} alt={item.title} />
            </Reveal>
            <Reveal delay={80}>
              <div
                className="prose-rh mt-8"
                dangerouslySetInnerHTML={{ __html: item.contentHtml || `<p>${item.shortSummary}</p>` }}
              />
            </Reveal>

            {related.length > 0 && (
              <div className="mt-14 border-t border-line pt-10">
                <h2 className="mb-6 font-heading text-2xl font-bold text-navy">Other Hospital Facilities</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  {related.map((r) => (
                    <Link
                      key={r.id}
                      to={`/facilities/${r.slug}`}
                      className="group rounded-xl border border-line bg-white p-5 transition-all hover:border-royal hover:shadow-lg"
                    >
                      <h3 className="font-heading font-semibold text-navy group-hover:text-royal">{r.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-ink/75">{r.shortSummary}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="sticky top-28 rounded-2xl border border-line bg-canvas p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-royal text-white shadow-md">
                  <Building2 className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-heading text-lg font-bold text-navy">Facility Status</p>
                  <p className="text-xs font-semibold text-emerald-600">Active &amp; Operational 24/7</p>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm text-ink/80 border-t border-line pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Sanitised &amp; monitored environment</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Wheelchair-accessible corridor &amp; lift</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-royal" />
                  <span>Ayushman PM-JAY &amp; TPA supported</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <BookButton className="w-full justify-center">
                  <Calendar className="mr-2 h-4 w-4" /> Book Appointment
                </BookButton>
                <a
                  href={telHref(settings.emergencyHotline)}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-royal bg-white px-5 py-2.5 text-sm font-semibold text-royal transition-colors hover:bg-royal hover:text-white"
                >
                  <Phone className="h-4 w-4" /> Emergency Desk
                </a>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
