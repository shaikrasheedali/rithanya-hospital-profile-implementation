import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, HeartPulse, ShieldCheck, Accessibility } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { PageHero, SectionHeading, Cover } from "@/components/site/ui";
import type { MediaRef } from "@/lib/utils";

type GalleryItem = { id: string; title: string; media: MediaRef[] };

export default function AboutPage() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  useEffect(() => {
    document.title = "About Us | Rithanya Hospital";
    let alive = true;
    fetch("/api/public/gallery?limit=6")
      .then(async (r) => {
        if (!r.ok) return { items: [] };
        return r.json();
      })
      .then((d) => { if (alive) setGallery(d.items ?? []); })
      .catch(() => { /* gallery is decorative — keep static content */ });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <PageHero
        eyebrow="About Rithanya"
        title="A hospital Khammam trusts"
        desc="Founded by Dr. D. Narayana Murthy and Dr. A. Lakshmi Deepa — clinical excellence with the warmth of a family doctor."
      />
      <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:py-32">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line shadow-xl">
              <Cover media={gallery[0]?.media} alt="Hospital corridor" className="h-full w-full object-cover" />
            </div>
            <div className="absolute -left-3 -top-6 flex h-36 w-36 rotate-[-8deg] flex-col items-center justify-center rounded-full bg-gold p-4 text-center text-navy shadow-xl">
              <Award className="h-8 w-8" />
              <p className="font-heading text-sm font-bold leading-tight">Best Hospital Award 2022</p>
              <p className="text-xs font-semibold leading-tight">District Collector, Khammam</p>
            </div>
          </Reveal>
          <div>
            <SectionHeading eyebrow="Our story" title="Compassionate healthcare, built around families" />
            <div className="prose-rh">
              <p>Rithanya Hospital on Wyra Road, opposite the Old LIC Office, is known across Khammam for its dedicated Thalassemia &amp; Sickle Cell Daycare Transfusion Centre, diabetology clinic led by Dr. Narayana Murthy, M.D., and 24/7 emergency and observation care.</p>
              <p>Patients consistently highlight conversational, reassuring consultations, affordable billing, and clean, wheelchair-accessible facilities with ramps and wide corridors.</p>
              <ul>
                <li>Thalassemia &amp; Sickle Cell daycare transfusions by appointment</li>
                <li>Diabetology, general medicine, diagnostics and senior wellness</li>
                <li>24/7 pharmacy, emergency beds and hydration therapy</li>
                <li>Ayushman Bharat PM-JAY &amp; Aarogyasri cashless desk</li>
              </ul>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 font-semibold text-navy">
                <ShieldCheck className="h-5 w-5 text-royal" /> PM-JAY empaneled
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 font-semibold text-navy">
                <HeartPulse className="h-5 w-5 text-royal" /> 4.9★ rated care
              </span>
            </div>
          </div>
        </div>
      </section>
      <section id="facilities" className="border-t border-line bg-white py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <SectionHeading eyebrow="Facilities" title="Accessible, clean and always open" center />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["24/7 Emergency & Observation", "Round-the-clock urgent care with observation beds and hydration therapy."],
              ["Daycare Transfusion Unit", "Calm, sanitised beds for scheduled transfusions with bedside nursing."],
              ["In-house Diagnostics", "Blood panels, biochemistry and HbA1c with dependable turnaround."],
              ["24/7 Pharmacy", "Medicines around the clock, plus online ordering with COD/UPI."],
              ["Wheelchair-accessible", "Ramps, wide corridors and accessible entrances for seniors."],
              ["Cashless Desk", "Help with PM-JAY, Aarogyasri and private TPA paperwork."],
            ].map(([t, d]) => (
              <Reveal key={t}>
                <div className="h-full rounded-xl border border-line bg-canvas p-6">
                  <Accessibility className="mb-3 h-6 w-6 text-royal" aria-hidden />
                  <h3 className="text-lg font-semibold">{t}</h3>
                  <p className="mt-2 text-ink/80">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4 text-center">
            <Link to="/facilities" className="inline-flex rounded-full bg-royal px-7 py-3 font-semibold text-white hover:bg-alert">Explore all hospital facilities →</Link>
            <Link to="/contact" className="inline-flex rounded-full border border-line bg-canvas px-7 py-3 font-semibold text-navy hover:bg-white">Plan your visit</Link>
          </div>
        </div>
      </section>
    </>
  );
}
