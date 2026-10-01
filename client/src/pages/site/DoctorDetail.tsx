import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Reveal } from "@/components/Reveal";
import { MediaGallery } from "@/components/site/MediaGallery";
import { AppointmentForm } from "@/components/site/BookingProvider";
import type { MediaRef } from "@/lib/utils";

type Doctor = { id: string; slug: string; fullName: string; qualifications: string; designation: string; department: string; consultationTimings: string; experienceYears: number; isVisiting: boolean; biographyHtml: string; media: MediaRef[] };

export default function DoctorDetailPage() {
  const { slug } = useParams();
  const [d, setD] = useState<Doctor | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    fetch(`/api/public/doctors/${slug}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((x) => { setD(x.item); document.title = `${x.item.fullName} | Rithanya Hospital`; }).catch(() => setMissing(true));
  }, [slug]);
  if (missing) return <div className="mx-auto max-w-7xl px-6 py-32 text-center"><h1 className="text-3xl font-semibold">Doctor not found</h1><Link to="/doctors" className="mt-4 inline-block font-semibold text-royal">← All doctors</Link></div>;
  if (!d) return <div className="mx-auto max-w-7xl px-6 py-32"><div className="h-64 animate-pulse rounded-xl bg-line/60" /></div>;
  return (
    <>
      <section className="on-dark bg-mesh pb-16 pt-36 text-white sm:pt-44"><div className="mx-auto max-w-7xl px-6 sm:px-8"><p className="text-sm uppercase tracking-[0.18em] text-gold"><Link to="/doctors" className="hover:text-white">Doctors</Link> / {d.department}</p><h1 className="mt-3 text-4xl font-semibold !text-white sm:text-5xl">{d.fullName}</h1><p className="mt-2 text-lg text-white/85">{d.designation} · {d.qualifications}{d.experienceYears ? ` · ${d.experienceYears}+ years` : ""}</p></div></section>
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Reveal><MediaGallery media={d.media} alt={d.fullName} /></Reveal>
            <Reveal delay={80}><div className="prose-rh mt-8" dangerouslySetInnerHTML={{ __html: d.biographyHtml || "" }} /></Reveal>
            {d.consultationTimings && <p className="mt-6 rounded-xl border border-line bg-white p-5"><strong>Consultation:</strong> {d.consultationTimings}</p>}
          </div>
          <aside className="lg:sticky lg:top-28 lg:self-start"><div className="rounded-xl border border-line bg-white p-6 shadow-lg"><h2 className="text-xl font-semibold">Book with {d.fullName.split(",")[0]}</h2><div className="mt-4"><AppointmentForm defaultDepartment={d.department} compact /></div></div></aside>
        </div>
      </section>
    </>
  );
}
