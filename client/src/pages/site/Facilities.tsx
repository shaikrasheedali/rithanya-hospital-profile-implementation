import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Building2, CheckCircle2, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { PageHero, Cover, EmptyState } from "@/components/site/ui";
import { telHref } from "@/lib/utils";
import type { MediaRef } from "@/lib/utils";

type FacilityItem = {
  id: string;
  slug: string;
  title: string;
  shortSummary: string;
  contentHtml: string;
  sortOrder: number;
  media: MediaRef[];
};

export default function FacilitiesPage() {
  const [items, setItems] = useState<FacilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hotline, setHotline] = useState("8328581019");

  useEffect(() => {
    document.title = "Hospital Facilities & Infrastructure | Rithanya Hospital";
    setLoading(true);
    setError(null);
    let alive = true;
    fetch("/api/public/facilities")
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load facilities — please try again.");
        return r.json();
      })
      .then((d) => { if (alive) setItems(d.items ?? []); })
      .catch((e) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Could not load facilities — please try again.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => { if (alive) setLoading(false); });
    fetch("/api/public/settings")
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => { if (alive && d?.settings?.emergencyHotline) setHotline(d.settings.emergencyHotline); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <>
      <PageHero
        eyebrow="Modern Hospital Infrastructure"
        title="World-Class Facilities Built Around Patient Comfort"
        desc="From our dedicated Daycare Transfusion Centre and 24/7 Emergency Wing to fully automated diagnostic labs and barrier-free wheelchair access."
      />

      {/* Highlights Bar */}
      <section className="border-b border-line bg-canvas/60 py-6">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal/10 text-royal">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-heading text-lg font-bold text-navy">24/7 Open</p>
                <p className="text-xs text-ink/70">Round-the-clock urgent care</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal/10 text-royal">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-heading text-lg font-bold text-navy">Daycare Unit</p>
                <p className="text-xs text-ink/70">Transfusion &amp; observation</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal/10 text-royal">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-heading text-lg font-bold text-navy">Cashless Desk</p>
                <p className="text-xs text-ink/70">PM-JAY &amp; private TPAs</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal/10 text-royal">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="font-heading text-lg font-bold text-navy">100% Accessible</p>
                <p className="text-xs text-ink/70">Ramps &amp; senior assistance</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Facilities Collection Grid */}
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:py-24">
        {loading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-96 animate-pulse rounded-2xl bg-line/60" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center"><p role="alert" className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 font-medium text-red-900">{error}</p><button onClick={() => window.location.reload()} className="mt-6 rounded-full bg-royal px-6 py-3 font-semibold text-white">Try again</button></div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Facilities list updating"
            text="Our infrastructure catalogue is currently synchronizing with the hospital management system. Please check back shortly."
          />
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((fac, i) => (
              <Reveal key={fac.id} delay={(i % 3) * 70}>
                <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-royal/30 hover:shadow-xl">
                  <div className="aspect-[16/10] overflow-hidden bg-canvas">
                    <Cover
                      media={fac.media}
                      alt={fac.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-royal">
                        Operational 24/7
                      </span>
                    </div>
                    <h3 className="mt-2 font-heading text-xl font-bold tracking-tight text-navy transition-colors group-hover:text-royal">
                      <Link to={`/facilities/${fac.slug}`} className="focus:outline-none">
                        {fac.title}
                      </Link>
                    </h3>
                    <p className="mt-2.5 flex-1 line-clamp-3 text-sm leading-relaxed text-ink/75">
                      {fac.shortSummary}
                    </p>
                    <div className="mt-6 flex items-center justify-between border-t border-line/60 pt-4">
                      <Link
                        to={`/facilities/${fac.slug}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal transition-colors hover:text-alert"
                      >
                        Explore facility <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                      <Link
                        to="/contact"
                        className="text-xs font-medium text-ink/60 hover:text-navy"
                      >
                        Plan visit
                      </Link>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}

        {/* Bottom CTA Box */}
        <div className="mt-16 overflow-hidden rounded-3xl bg-mesh p-8 text-white shadow-xl sm:p-12">
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-gold">Patient Assistance Desk</p>
              <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                Need urgent care or scheduling a transfusion?
              </h2>
              <p className="mt-2 max-w-2xl text-white/80">
                Our medical team and front desk officers are on standby 24 hours a day to guide your arrival and prepare facilities.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <a
                href={telHref(hotline)}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 font-semibold text-navy shadow-md transition-all hover:bg-white"
              >
                <Phone className="h-4 w-4" /> Call 24/7 Desk
              </a>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 py-3 font-semibold text-white transition-all hover:bg-white/20"
              >
                Directions &amp; Location
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
