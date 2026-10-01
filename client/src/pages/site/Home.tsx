import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  CalendarCheck,
  Clock,
  FlaskConical,
  HeartPulse,
  MapPin,
  MessageCircle,
  Phone,
  Pill,
  ShieldCheck,
  Siren,
  Star,
  Stethoscope,
  Navigation,
} from "lucide-react";
import { Hero } from "@/components/site/Hero";
import { Reveal } from "@/components/Reveal";
import { BookButton } from "@/components/site/BookButton";
import { BloodStockCards } from "@/components/site/BloodStockCards";
import { Carousel } from "@/components/site/Carousel";
import { ArrowLink, Cover, NoticeBanner, SectionHeading, Stars } from "@/components/site/ui";
import { formatDate, prettyPhone, telHref, type MediaRef } from "@/lib/utils";

const HIGHLIGHTS = [
  "District Collector Best Hospital Award 2022",
  "4.9★ Rated (3,600+ Reviews)",
  "Ayushman Bharat PM-JAY Empaneled",
  "24/7 Emergency & Daycare",
];

const SERVICE_ICON: Record<string, typeof Stethoscope> = {
  Daycare: HeartPulse,
  Diagnostics: FlaskConical,
  Pharmacy: Pill,
  Emergency: Siren,
  Outpatient: Stethoscope,
  Inpatient: HeartPulse,
};

type HomeData = {
  settings: { emergencyHotline: string; secondaryHotline: string | null; whatsappNumber: string; physicalAddress: string; opdTimings: string; noticeBanner: string };
  specialties: Array<{ id: string; title: string; slug: string; shortSummary: string; media: MediaRef[] }>;
  flagship: Array<{ id: string; title: string; slug: string; category: string; shortSummary: string; media: MediaRef[] }>;
  services: Array<{ id: string; title: string; slug: string; category: string; shortSummary: string; media: MediaRef[] }>;
  doctors: Array<{ id: string; fullName: string; slug: string; designation: string; department: string; isVisiting: boolean; media: MediaRef[] }>;
  gallery: Array<{ id: string; title: string; media: MediaRef[] }>;
  insurance: Array<{ id: string; name: string; schemeType: string; media: MediaRef[] }>;
  blogs: { posts: Array<{ id: string; title: string; slug: string; category: string; excerpt: string; publishedAt: string; media: MediaRef[] }> };
  testimonials: Array<{ id: string; patientName: string; location: string; treatment: string; rating: number; quote: string; media: MediaRef[] }>;
  stock: Array<{ id: string; bloodGroup: string; groupCategory: string; wholeBloodUnits: number; plasmaUnits: number; lastUpdated: string }>;
};

function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-32 sm:px-8" aria-busy="true">
      <div className="animate-pulse space-y-6">
        <div className="h-64 rounded-xl bg-line/60" />
        <div className="h-8 w-2/3 rounded bg-line/60" />
        <div className="h-5 w-1/2 rounded bg-line/60" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);

  useEffect(() => {
    document.title = "Rithanya Hospital (రితన్య హాస్పిటల్) | Khammam | 24/7 Emergency, Thalassemia Daycare & Diabetology";
    fetch("/api/public/home")
      .then((r) => r.json())
      .then(setData)
      .catch(() => undefined);
  }, []);

  if (!data) return (<><Hero phone="8328581019" /><Loading /></>);

  const s = data.settings;
  const specialties = data.specialties;
  const flagship = data.flagship;
  const services = data.services;
  const doctors = data.doctors;
  const gallery = data.gallery;
  const insurance = data.insurance;
  const blogs = data.blogs;
  const testimonials = data.testimonials;
  const stock = data.stock;
  const thal = specialties.find((x) => x.title.toLowerCase().includes("thalassemia"));

  return (
    <>
      <Hero phone={s.emergencyHotline} />

      {/* Key highlights strip */}
      <section aria-label="Key highlights" className="on-dark overflow-hidden bg-navy py-5 text-white">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
          {[0, 1].map((dup) => (
            <ul key={dup} className="flex gap-12" aria-hidden={dup === 1}>
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-center gap-3 font-heading text-lg font-medium">
                  <Star className="h-5 w-5 fill-gold text-gold" /> {h}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>
      <NoticeBanner text={s.noticeBanner} />

      {/* About summary */}
      <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:py-32">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line shadow-xl">
              <Cover media={gallery[0]?.media} alt="Rithanya Hospital interior" className="h-full w-full object-cover" />
            </div>
            <div className="absolute -bottom-8 -right-2 hidden w-56 overflow-hidden rounded-xl border-4 border-canvas shadow-2xl sm:block">
              <Cover media={gallery[3]?.media ?? gallery[1]?.media} alt="Laboratory" className="aspect-[4/3] h-full w-full object-cover" />
            </div>
            <div className="absolute -left-3 -top-6 flex h-36 w-36 rotate-[-8deg] flex-col items-center justify-center rounded-full bg-gold p-4 text-center text-navy shadow-xl sm:h-40 sm:w-40">
              <Award className="h-8 w-8" />
              <p className="font-heading text-sm font-bold leading-tight">Best Hospital Award 2022</p>
              <p className="text-xs font-semibold leading-tight">District Collector, Khammam</p>
            </div>
          </Reveal>
          <div>
            <SectionHeading
              eyebrow="About Rithanya"
              title="Compassionate healthcare, built around Khammam’s families"
              desc="Founded by Dr. D. Narayana Murthy and Dr. A. Lakshmi Deepa, Rithanya Hospital pairs clinical excellence with the warmth of a family doctor — from diabetes care to our humanitarian Thalassemia and Sickle Cell daycare."
            />
            <Reveal delay={100}>
              <ul className="mb-8 grid gap-4 sm:grid-cols-2">
                {[
                  ["4.9 / 5", "Justdial rating · 3,600+ patient reviews"],
                  ["5.0 / 5", "Across 2,300+ medical portal listings"],
                  ["6+ years", "Of dedicated community service"],
                  ["24 × 7", "Inpatient, daycare & urgent care"],
                ].map(([n, l]) => (
                  <li key={n} className="rounded-xl border border-line bg-white p-5">
                    <p className="font-heading text-3xl font-bold text-royal">{n}</p>
                    <p className="mt-1 text-base text-ink/80">{l}</p>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 font-semibold text-navy">
                  <ShieldCheck className="h-5 w-5 text-royal" /> Ayushman Bharat PM-JAY
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 font-semibold text-navy">
                  <ShieldCheck className="h-5 w-5 text-royal" /> Aarogyasri facility
                </span>
              </div>
              <div className="mt-8"><ArrowLink to="/about">Read our story</ArrowLink></div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Live blood bank */}
      <section className="on-dark relative overflow-hidden bg-mesh py-24 text-white lg:py-28" id="blood-bank">
        <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-6 sm:px-8">
          <SectionHeading
            dark
            eyebrow="Blood bank · plasma"
            title="Current live blood & plasma stock"
            desc="Synced directly from our blood bank desk. Units are updated whenever stock changes — always call to confirm before travelling."
          />
          <Reveal>
            <BloodStockCards initial={stock} threshold={3} />
          </Reveal>
        </div>
      </section>

      {/* Specialties */}
      <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:py-32">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="Clinical specialties" title="Expert care across every need" />
          <div className="mb-12"><ArrowLink to="/clinical-care/specialties">All specialties</ArrowLink></div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {specialties.map((sp, i) => (
            <Reveal key={sp.id} delay={(i % 3) * 80}>
              <Link to={`/clinical-care/specialties/${sp.slug}`} className="group block h-full overflow-hidden rounded-xl border border-line bg-white transition-all hover:-translate-y-1.5 hover:shadow-2xl">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Cover media={sp.media} alt={sp.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 font-heading text-sm font-bold text-royal shadow">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold group-hover:text-royal">{sp.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink/80">{sp.shortSummary}</p>
                  <p className="mt-4 font-semibold text-royal group-hover:text-alert">Learn more →</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Thalassemia wing + flagship treatments */}
      <section className="on-dark relative overflow-hidden bg-navy py-24 text-white lg:py-32" id="thalassemia">
        <div className="absolute -left-32 top-1/3 h-96 w-96 animate-float rounded-full bg-alert/20 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-6 sm:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <Reveal>
              <p className="mb-3 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-gold"><span className="h-px w-10 bg-gold" /> Flagship wing</p>
              <h2 className="text-3xl font-semibold tracking-tight !text-white sm:text-4xl lg:text-5xl">Thalassemia & Sickle Cell Daycare Transfusion Centre</h2>
              <p className="mt-5 text-lg leading-relaxed text-white/85">
                A dedicated daycare for children and adults living with Thalassemia Major and Sickle Cell Disease — safe red cell transfusions, iron chelation monitoring, regular blood parameter tracking and counselling for the whole family.
              </p>
              <ul className="mt-6 space-y-2 text-lg text-white/90">
                {["Matched, screened blood with bedside nursing", "Blood donation partnerships & camps", "Patient and family support resources", "Cashless care under Ayushman Bharat PM-JAY"].map((x) => (
                  <li key={x} className="flex gap-3"><HeartPulse className="mt-1 h-5 w-5 flex-none text-gold" />{x}</li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-4">
                <BookButton department="Thalassemia & Sickle Cell Daycare" source="THALASSEMIA" className="rounded-full bg-gold px-7 py-3.5 font-semibold text-navy hover:bg-white">
                  Book a transfusion slot
                </BookButton>
                <a href={telHref(s.emergencyHotline)} className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3.5 font-semibold text-white hover:border-gold hover:text-gold">
                  <Phone className="h-5 w-5" /> {prettyPhone(s.emergencyHotline)}
                </a>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="relative aspect-[5/4] overflow-hidden rounded-xl border border-white/15 shadow-2xl">
                <Cover media={thal?.media} alt="Daycare transfusion beds" className="h-full w-full object-cover" />
              </div>
            </Reveal>
          </div>

          <div className="mt-20">
            <h3 className="mb-8 text-2xl font-semibold !text-white">Flagship treatments</h3>
            <div className="grid gap-6 md:grid-cols-3">
              {flagship.map((t, i) => (
                <Reveal key={t.id} delay={i * 90}>
                  <Link to={`/clinical-care/treatments/${t.slug}`} className="group block h-full overflow-hidden rounded-xl border border-white/15 bg-white/5 transition-all hover:-translate-y-1 hover:border-gold/60 hover:bg-white/10">
                    <div className="aspect-[16/10] overflow-hidden"><Cover media={t.media} alt={t.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /></div>
                    <div className="p-6">
                      <p className="text-sm font-semibold uppercase tracking-wider text-gold">{t.category}</p>
                      <h4 className="mt-1 text-xl font-semibold !text-white">{t.title}</h4>
                      <p className="mt-2 text-white/80">{t.shortSummary}</p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:py-32">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="Hospital services" title="Daycare, diagnostics and a pharmacy that never closes" />
          <div className="mb-12"><ArrowLink to="/clinical-care/services">All services</ArrowLink></div>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((sv, i) => {
            const Icon = SERVICE_ICON[sv.category] ?? Stethoscope;
            return (
              <Reveal key={sv.id} delay={(i % 3) * 70}>
                <Link to={`/clinical-care/services/${sv.slug}`} className="group flex h-full gap-5 rounded-xl border border-line bg-white p-5 transition-all hover:-translate-y-1 hover:border-royal hover:shadow-xl">
                  <div className="h-24 w-24 flex-none overflow-hidden rounded-lg"><Cover media={sv.media} alt="" className="h-full w-full object-cover" /></div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-royal"><Icon className="h-4 w-4" />{sv.category}</p>
                    <h3 className="mt-1 text-lg font-semibold group-hover:text-royal">{sv.title}</h3>
                    <p className="mt-1 line-clamp-2 text-ink/80">{sv.shortSummary}</p>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Doctors */}
      <section className="border-y border-line bg-white py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="Medical specialists" title="Meet the doctors behind your care" />
          </div>
          <Carousel label="Medical specialists">
            {doctors.map((d) => (
              <Link key={d.id} to={`/doctors/${d.slug}`} className="group w-72 flex-none snap-start overflow-hidden rounded-xl border border-line bg-canvas transition-all hover:-translate-y-1 hover:shadow-xl sm:w-80">
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Cover media={d.media} alt={d.fullName} className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105" />
                  {d.isVisiting && <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 text-sm font-semibold text-navy">Visiting faculty</span>}
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold group-hover:text-royal">{d.fullName}</h3>
                  <p className="font-medium text-royal">{d.designation}</p>
                  <p className="mt-1 text-ink/80">{d.department}</p>
                </div>
              </Link>
            ))}
          </Carousel>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:py-32">
        <SectionHeading eyebrow="Patient voices" title="Affordable, courteous, and always attentive" center />
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.id} delay={i * 90}>
              <figure className="flex h-full flex-col rounded-xl border border-line bg-white p-7 shadow-sm">
                <Stars n={t.rating} />
                <blockquote className="mt-4 flex-1 text-lg leading-relaxed text-ink">“{t.quote}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-4 border-t border-line pt-5">
                  <div className="h-14 w-14 overflow-hidden rounded-full border border-line"><Cover media={t.media} alt="" className="h-full w-full object-cover" /></div>
                  <div>
                    <p className="font-semibold text-navy">{t.patientName}</p>
                    <p className="text-base text-ink/70">{[t.treatment, t.location].filter(Boolean).join(" · ")}</p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Gallery preview */}
      <section className="bg-navy py-24 text-white lg:py-28 on-dark">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <SectionHeading dark eyebrow="Media gallery" title="Inside our wards, labs and camps" />
            <div className="mb-12"><ArrowLink dark to="/gallery">Open full gallery</ArrowLink></div>
          </div>
          <div className="grid auto-rows-[200px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {gallery.map((g, i) => (
              <Reveal key={g.id} delay={i * 60} className={i === 0 ? "sm:col-span-2 sm:row-span-2" : i === 3 ? "lg:col-span-2" : ""}>
                <Link to="/gallery" className="group relative block h-full overflow-hidden rounded-xl">
                  <Cover media={g.media} alt={g.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 to-transparent p-4 pt-10 font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">{g.title}</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Insurance */}
      <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:py-28">
        <SectionHeading eyebrow="Cashless care" title="Empaneled insurance & scheme partners" desc="Treatment under government schemes and private insurers — our cashless desk guides you through every step." center />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {insurance.map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <Link to="/insurance-providers" className="group block overflow-hidden rounded-xl border border-line bg-white transition-all hover:-translate-y-1 hover:shadow-xl">
                <div className="aspect-[8/5] overflow-hidden"><Cover media={p.media} alt={p.name} className="h-full w-full object-cover" /></div>
                <div className="p-5">
                  <p className="text-sm font-semibold uppercase tracking-wider text-royal">{p.schemeType}</p>
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Insights */}
      <section className="border-t border-line bg-white py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="Health insights" title="Latest from our clinicians" />
            <div className="mb-12"><ArrowLink to="/insights">All articles</ArrowLink></div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {blogs.posts.map((b, i) => (
              <Reveal key={b.id} delay={i * 80}>
                <Link to={`/insights/${b.slug}`} className="group block h-full overflow-hidden rounded-xl border border-line bg-canvas transition-all hover:-translate-y-1 hover:shadow-xl">
                  <div className="aspect-[16/10] overflow-hidden"><Cover media={b.media} alt={b.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /></div>
                  <div className="p-6">
                    <p className="text-sm font-semibold uppercase tracking-wider text-royal">{b.category} · {formatDate(b.publishedAt)}</p>
                    <h3 className="mt-2 text-xl font-semibold group-hover:text-royal">{b.title}</h3>
                    <p className="mt-2 line-clamp-3 text-ink/80">{b.excerpt}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contact band */}
      <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8">
        <div className="grid overflow-hidden rounded-xl border border-line bg-white shadow-xl lg:grid-cols-2">
          <div className="p-8 sm:p-12">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-alert">Open 24 hours</p>
            <h2 className="text-3xl font-semibold sm:text-4xl">Visit or call us — we’re always here</h2>
            <ul className="mt-6 space-y-4 text-lg">
              <li className="flex gap-3"><MapPin className="mt-1 h-5 w-5 flex-none text-royal" />{s.physicalAddress}</li>
              <li className="flex gap-3"><Clock className="mt-1 h-5 w-5 flex-none text-royal" />{s.opdTimings}</li>
              <li className="flex gap-3"><Phone className="mt-1 h-5 w-5 flex-none text-royal" /><span><a className="font-semibold text-royal hover:text-alert" href={telHref(s.emergencyHotline)}>{prettyPhone(s.emergencyHotline)}</a>{s.secondaryHotline && <> · <a className="hover:text-alert" href={telHref(s.secondaryHotline)}>{prettyPhone(s.secondaryHotline)}</a></>}</span></li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <BookButton className="inline-flex items-center gap-2 rounded-full bg-royal px-6 py-3 font-semibold text-white hover:bg-alert"><CalendarCheck className="h-5 w-5" /> Book appointment</BookButton>
              <a href={`https://wa.me/${s.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 font-semibold text-navy hover:border-[#25D366] hover:text-[#128C7E]"><MessageCircle className="h-5 w-5" /> WhatsApp</a>
              <a href="https://www.google.com/maps/dir/?api=1&destination=17.2486,80.1473" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 font-semibold text-navy hover:border-royal hover:text-royal"><Navigation className="h-5 w-5" /> Directions</a>
            </div>
          </div>
          <iframe
            title="Rithanya Hospital location map"
            src="https://www.google.com/maps?q=17.2486,80.1473&z=16&output=embed"
            className="h-80 w-full border-0 lg:h-full lg:min-h-[28rem]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
    </>
  );
}
