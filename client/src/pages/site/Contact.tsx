import { useEffect, useState } from "react";
import { Clock, MapPin, Phone } from "lucide-react";
import { PageHero } from "@/components/site/ui";
import { AppointmentForm } from "@/components/site/BookingProvider";
import { prettyPhone, telHref } from "@/lib/utils";

export default function ContactPage() {
  const [s, setS] = useState<{ emergencyHotline: string; secondaryHotline: string | null; physicalAddress: string; opdTimings: string } | null>(null);
  useEffect(() => {
    document.title = "Contact | Rithanya Hospital";
    let alive = true;
    fetch("/api/public/settings")
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => { if (alive && d?.settings) setS(d.settings); })
      .catch(() => { /* fall back to placeholders — no toast for decorative settings */ });
    return () => { alive = false; };
  }, []);
  return (
    <>
      <PageHero eyebrow="Contact" title="Visit, call or send a message" desc="Open 24 hours for emergency, daycare and inpatient care." />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold">Hospital information</h2>
            <ul className="mt-6 space-y-4 text-lg">
              <li className="flex gap-3"><MapPin className="mt-1 h-5 w-5 flex-none text-royal" />{s?.physicalAddress ?? "Wyra Road, Khammam"}</li>
              <li className="flex gap-3"><Clock className="mt-1 h-5 w-5 flex-none text-royal" />{s?.opdTimings ?? "Open 24 Hours"}</li>
              <li className="flex gap-3"><Phone className="mt-1 h-5 w-5 flex-none text-royal" /><span><a className="font-semibold text-royal" href={s ? telHref(s.emergencyHotline) : "#"}>{s ? prettyPhone(s.emergencyHotline) : "…"}</a></span></li>
            </ul>
            <iframe title="Map" src="https://www.google.com/maps?q=17.2486,80.1473&z=16&output=embed" className="mt-6 h-72 w-full rounded-xl border border-line" loading="lazy" />
          </div>
          <div className="rounded-xl border border-line bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold">Request an appointment</h2>
            <p className="mt-1 text-ink/70">We usually confirm within a few hours during OPD times.</p>
            <div className="mt-6"><AppointmentForm source="CONTACT" /></div>
          </div>
        </div>
      </section>
    </>
  );
}
