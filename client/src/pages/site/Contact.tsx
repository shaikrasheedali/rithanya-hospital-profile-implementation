import { useEffect } from "react";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageHero, SafeImg } from "@/components/site/ui";
import { AppointmentForm } from "@/components/site/BookingProvider";
import { prettyPhone, telHref } from "@/lib/utils";
import { useSiteSettings } from "@/lib/settingsContext";

export default function ContactPage() {
  const { settings: s } = useSiteSettings();

  useEffect(() => {
    document.title = "Contact | Rithanya Hospital";
  }, []);

  return (
    <>
      <PageHero eyebrow="Contact" title="Visit, call or send a message" desc="Open 24 hours for emergency, daycare and inpatient care." />
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold">Hospital information</h2>
            <ul className="mt-6 space-y-4 text-base sm:text-lg">
              <li className="flex gap-3">
                <MapPin className="mt-1 h-5 w-5 flex-none text-royal" />
                <span>{s.physicalAddress}</span>
              </li>
              <li className="flex gap-3">
                <Clock className="mt-1 h-5 w-5 flex-none text-royal" />
                <span>{s.opdTimings}</span>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-1 h-5 w-5 flex-none text-royal" />
                <span>
                  <a className="font-semibold text-royal hover:underline" href={telHref(s.emergencyHotline)}>
                    {prettyPhone(s.emergencyHotline)}
                  </a>
                  {s.secondaryHotline && (
                    <>
                      {" · "}
                      <a className="text-royal hover:underline" href={telHref(s.secondaryHotline)}>
                        {prettyPhone(s.secondaryHotline)}
                      </a>
                    </>
                  )}
                </span>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-1 h-5 w-5 flex-none text-royal" />
                <a className="font-semibold text-royal hover:underline" href={`mailto:${s.email}`}>
                  {s.email}
                </a>
              </li>
              {s.whatsappNumber && (
                <li className="flex gap-3">
                  <MessageCircle className="mt-1 h-5 w-5 flex-none text-emerald-600" />
                  <a
                    className="font-semibold text-emerald-700 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent("Hello Rithanya Hospital, I would like to enquire about appointments and treatments.")}`}
                  >
                    WhatsApp Chat (+{s.whatsappNumber})
                  </a>
                </li>
              )}
            </ul>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="overflow-hidden rounded-lg border border-line bg-canvas">
                <SafeImg
                  src="/seed/rithanya-hospital-khammam-building-exterior-signboard.webp"
                  alt="Rithanya Hospital Building Exterior Signboard on Wyra Road"
                  className="h-32 w-full object-cover"
                />
                <p className="p-1.5 text-center text-xs font-semibold text-navy">Wyra Road Building</p>
              </div>
              <div className="overflow-hidden rounded-lg border border-line bg-canvas">
                <SafeImg
                  src="/seed/rithanya-hospital-khammam-main-entrance-reception.webp"
                  alt="Rithanya Hospital Main Entrance & Reception"
                  className="h-32 w-full object-cover"
                />
                <p className="p-1.5 text-center text-xs font-semibold text-navy">Entrance & Reception</p>
              </div>
            </div>
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
