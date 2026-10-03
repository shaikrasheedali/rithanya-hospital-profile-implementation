import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  FileWarning,
  HeartCrack,
  Info,
  Mail,
  Phone,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { PageHero } from "@/components/site/ui";
import { useSiteSettings } from "@/lib/settingsContext";
import { prettyPhone, telHref } from "@/lib/utils";

export default function DisclaimerPage() {
  const { settings: s } = useSiteSettings();

  useEffect(() => {
    document.title = "Disclaimer | Rithanya Hospital";
  }, []);

  return (
    <>
      <PageHero
        eyebrow="Medical Advisory & Regulatory Disclosures"
        title="Medical & Legal Disclaimer"
        desc="Important clinical disclaimers regarding health information, medical advice, emergency care, blood stock availability and website usage."
      />

      <section className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        {/* Core Emergency Alert Box */}
        <div className="mb-10 rounded-2xl border border-alert/30 bg-rose-50/70 p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-alert shrink-0 mt-0.5" />
            <div>
              <h3 className="font-heading text-lg font-bold text-alert">
                Emergency Medical Notice — Call Immediately in Acute Situations
              </h3>
              <p className="mt-1 text-sm text-ink/80 leading-relaxed">
                If you or a family member are experiencing a life-threatening medical emergency (such as severe chest pain, acute breathlessness, sudden loss of consciousness, severe trauma, or acute sickle cell crisis),{" "}
                <strong>do not use online forms, emails, or chat messages</strong>. Immediately call our 24/7 Emergency Hotline at{" "}
                <a
                  href={telHref(s.emergencyHotline)}
                  className="font-bold text-alert underline"
                >
                  {prettyPhone(s.emergencyHotline)}
                </a>{" "}
                or proceed straight to the emergency casualty room at {s.physicalAddress}.
              </p>
            </div>
          </div>
        </div>

        <div className="prose-rh rounded-2xl border border-line bg-white p-8 sm:p-10 shadow-sm space-y-8">
          {/* Section 1 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-royal" /> 1. Not a Substitute for Professional Medical Advice
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              All materials, clinical overviews, specialty guides, doctor profiles, health blog insights, and informational content on this website are published solely for general health awareness and educational purposes:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/75 space-y-1.5">
              <li>
                Website content does not constitute medical advice, diagnosis, treatment, prognosis, or professional clinical endorsement.
              </li>
              <li>
                Always consult an attended registered medical practitioner, specialist diabetologist, or pediatric hematologist for personalized clinical evaluation of any symptoms, diagnostic lab values, or medical conditions.
              </li>
              <li>
                Never disregard professional clinical advice or delay seeking expert healthcare evaluation because of information you read on this website.
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <Info className="h-5 w-5 text-royal" /> 2. No Doctor-Patient Relationship Created
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              Accessing this website, submitting an appointment request form, sending a WhatsApp consultation inquiry, or emailing the hospital desk does not establish a confidential doctor-patient relationship between you and any physician or surgeon of {s.legalName}. A legal and clinical doctor-patient relationship is created solely upon formal physical registration and clinical consultation at our hospital facility.
            </p>
          </div>

          {/* Section 3 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <HeartCrack className="h-5 w-5 text-royal" /> 3. Live Blood Stock & Transfusion Availability
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              The live blood inventory displayed on the RVBC (Rithanya Voluntary Blood Centre) portal reflects the latest catalogued units:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/75 space-y-1.5">
              <li>
                Blood components (Whole Blood, Packed Red Cells, Platelet Concentrates, and Fresh Frozen Plasma) are subject to continuous emergency allocation, cross-matching, and routine clinical dispatch.
              </li>
              <li>
                Attendants and hospitals requiring urgent blood units must confirm real-time availability with the blood bank technician directly by phone before dispatching messengers or ambulances.
              </li>
            </ul>
          </div>

          {/* Section 4 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-royal" /> 4. Accuracy & Third-Party Service Links
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              While {s.legalName} strives to keep clinical information, OPD hours, doctor schedules, and empaneled insurance lists accurate and current, medical science and hospital duty rotas evolve continuously:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/75 space-y-1.5">
              <li>
                Doctor consultation schedules are subject to clinical emergencies, emergency surgeries, and planned academic leaves.
              </li>
              <li>
                External links, including maps, pharmacy partner sites, and payment gateways, are provided for user convenience. The hospital assumes no responsibility for third-party policies, operational uptime, or external platform content.
              </li>
            </ul>
          </div>

          {/* Section 5 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-royal" /> 5. Limitation of Liability
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              Under no circumstances shall {s.legalName}, RVBC, its managing directors, medical consultants, nursing officers, or technical staff be liable for any direct, indirect, incidental, or consequential damages resulting from the use of, or inability to use, this website or reliance on information contained herein.
            </p>
          </div>

          {/* Section 6 */}
          <div className="border-t border-line pt-6">
            <h2 className="text-xl font-bold font-heading text-navy">
              6. Contact & Clinical Inquiries
            </h2>
            <p className="mt-2 text-sm text-ink/80 leading-relaxed">
              If you require clarification regarding clinical disclaimers or hospital protocols:
            </p>
            <div className="mt-4 rounded-xl border border-line bg-canvas p-5 text-sm space-y-2">
              <p className="font-bold text-navy">{s.legalName} & RVBC</p>
              <p className="text-ink/75">{s.physicalAddress}</p>
              <p className="flex items-center gap-2 text-ink/80">
                <Phone className="h-4 w-4 text-royal" />
                <span>24/7 Emergency Line: </span>
                <a className="font-semibold text-royal hover:underline" href={telHref(s.emergencyHotline)}>
                  {prettyPhone(s.emergencyHotline)}
                </a>
                {s.secondaryHotline && (
                  <>
                    <span> · Enquiry Desk: </span>
                    <a className="font-semibold text-royal hover:underline" href={telHref(s.secondaryHotline)}>
                      {prettyPhone(s.secondaryHotline)}
                    </a>
                  </>
                )}
              </p>
              <p className="flex items-center gap-2 text-ink/80">
                <Mail className="h-4 w-4 text-royal" />
                <span>Email: </span>
                <a className="font-semibold text-royal hover:underline" href={`mailto:${s.email}`}>
                  {s.email}
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
