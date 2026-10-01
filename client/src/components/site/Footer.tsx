import { Link } from "react-router-dom";
import { Clock, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import type { Settings } from "@/lib/settings";
import { prettyPhone, telHref } from "@/lib/utils";

const cols = [
  {
    title: "Clinical care",
    links: [
      ["Specialties", "/clinical-care/specialties"],
      ["Treatments", "/clinical-care/treatments"],
      ["Services", "/clinical-care/services"],
      ["Our doctors", "/doctors"],
      ["Insurance providers", "/insurance-providers"],
    ],
  },
  {
    title: "Hospital",
    links: [
      ["About us", "/about"],
      ["Pharmacy store", "/products"],
      ["Gallery", "/gallery"],
      ["Health insights", "/insights"],
      ["Contact & location", "/contact"],
    ],
  },
  {
    title: "Compliance",
    links: [
      ["Privacy policy", "/privacy-policy"],
      ["DPDP erasure request", "/dpdp-erasure-request"],
      ["Staff portal login", "/portal/login"],
    ],
  },
];

export function Footer({ s }: { s: Settings }) {
  return (
    <footer className="on-dark relative overflow-hidden bg-mesh text-white/85">
      <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-6 pb-8 pt-20 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <p className="font-heading text-3xl font-semibold text-white">{s.legalName}</p>
            <p className="mt-1 text-lg text-gold" lang="te">రితన్య హాస్పిటల్</p>
            <p className="mt-4 max-w-md leading-relaxed text-white/80">{s.clinicalTagline}</p>
            <ul className="mt-6 space-y-3 text-base">
              <li className="flex gap-3"><MapPin className="mt-1 h-5 w-5 flex-none text-gold" />{s.physicalAddress}</li>
              <li className="flex gap-3"><Phone className="mt-1 h-5 w-5 flex-none text-gold" />
                <span>
                  <a className="font-semibold text-white hover:text-gold" href={telHref(s.emergencyHotline)}>{prettyPhone(s.emergencyHotline)}</a>
                  {s.secondaryHotline && <> · <a className="hover:text-gold" href={telHref(s.secondaryHotline)}>{prettyPhone(s.secondaryHotline)}</a></>}
                </span>
              </li>
              <li className="flex gap-3"><Clock className="mt-1 h-5 w-5 flex-none text-gold" />{s.opdTimings}</li>
              <li className="flex gap-3"><Mail className="mt-1 h-5 w-5 flex-none text-gold" /><a className="hover:text-gold" href={`mailto:${s.email}`}>{s.email}</a></li>
            </ul>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            {cols.map((c) => (
              <nav key={c.title} aria-label={c.title}>
                <h2 className="mb-4 font-heading text-base font-semibold uppercase tracking-wider !text-white">{c.title}</h2>
                <ul className="space-y-2.5">
                  {c.links.map(([label, href]) => (
                    <li key={href}>
                      <Link to={href} className="text-base text-white/80 hover:text-gold">{label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-3 border-t border-white/15 pt-6 text-sm text-white/70">
          <span className="inline-flex items-center gap-2 rounded-full bg-gold px-3 py-1 font-semibold text-navy"><ShieldCheck className="h-4 w-4" /> Ayushman Bharat PM-JAY empaneled</span>
          <span>Payments: Cash · UPI (PhonePe, Google Pay, Paytm, BHIM) · Cards · Net Banking</span>
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-relaxed text-white/65">
          © {new Date().getFullYear()} {s.legalName}, Khammam. Information on this website is for general awareness and is not a substitute for professional medical advice.
          In an emergency, call {prettyPhone(s.emergencyHotline)} or visit us directly — we are open 24 hours. Patient data is handled in accordance with the Digital Personal Data Protection Act, 2023.
        </p>
      </div>
    </footer>
  );
}
