import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  FileCheck,
  Mail,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { PageHero } from "@/components/site/ui";
import { useSiteSettings } from "@/lib/settingsContext";
import { prettyPhone, telHref } from "@/lib/utils";

export default function TermsPage() {
  const { settings: s } = useSiteSettings();

  useEffect(() => {
    document.title = "Terms & Conditions | Rithanya Hospital";
  }, []);

  return (
    <>
      <PageHero
        eyebrow="Clinical Governance & Legal Framework"
        title="Terms & Conditions"
        desc="Operating terms, patient care protocols, emergency procedures, admission guidelines, and billing policies of Rithanya Hospital and RVBC."
      />

      <section className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        {/* Core Summary Card */}
        <div className="mb-10 rounded-2xl border border-royal/20 bg-blue-50/60 p-6">
          <div className="flex items-start gap-4">
            <FileCheck className="h-6 w-6 text-royal shrink-0 mt-0.5" />
            <div>
              <h3 className="font-heading text-lg font-bold text-navy">
                General Hospital Charter & Patient Undertaking
              </h3>
              <p className="mt-1 text-sm text-ink/75 leading-relaxed">
                By accessing clinical facilities, scheduling appointments, availing daycare transfusions, or using the digital services of {s.legalName} and RVBC (Voluntary Blood Centre), patients, family attendants, and visitors agree to the clinical, ethical, and administrative terms outlined below.
              </p>
            </div>
          </div>
        </div>

        <div className="prose-rh rounded-2xl border border-line bg-white p-8 sm:p-10 shadow-sm space-y-8">
          {/* Section 1 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-royal" /> 1. Admission, Daycare & Clinical Services
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              {s.legalName} operates as a multi-speciality healthcare facility and dedicated Thalassemia & Sickle Cell Daycare Transfusion Centre in Khammam, Telangana:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/75 space-y-1.5">
              <li>
                <strong>Emergency & Triaging:</strong> Emergency triage is performed based on clinical severity. Life-threatening emergencies are prioritized immediately over routine outpatient appointments.
              </li>
              <li>
                <strong>Thalassemia & Daycare Transfusions:</strong> Daycare transfusions require prior appointment scheduling to ensure cross-matched, quality-tested voluntary blood units are prepared in advance by RVBC.
              </li>
              <li>
                <strong>Attendant Regulations:</strong> Inpatient wards permit up to two registered attendants per patient to ensure infection control and calm patient recovery environments.
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-royal" /> 2. Billing, Cashless Schemes & Payments
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              We maintain fair, transparent, and regulatory-compliant healthcare tariffs:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/75 space-y-1.5">
              <li>
                <strong>Government & Cashless Schemes:</strong> Rithanya Hospital is empaneled under Ayushman Bharat PM-JAY and Aarogyasri. Patients eligible for cashless schemes must produce valid scheme cards and government ID at the dedicated insurance desk.
              </li>
              <li>
                <strong>Standard Tariffs:</strong> For non-scheme patients, fees for OPD consultations, diagnostic tests, and daycare beds are itemized clearly on official printed invoices.
              </li>
              <li>
                <strong>Accepted Modes:</strong> Payments are accepted via UPI (PhonePe, Google Pay, Paytm, BHIM), Cash, Debit/Credit Cards, and Net Banking (NEFT/RTGS).
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-royal" /> 3. Medical Consent & Emergency Treatment
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              Clinical protocols require informed consent for all invasive procedures, transfusions, and surgeries:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/75 space-y-1.5">
              <li>
                Informed consent forms detailing diagnosis, anticipated procedure, known medical risks, and alternatives will be explained in English, Telugu, or Hindi prior to administration.
              </li>
              <li>
                In acute trauma or life-threatening situations where the patient is unconscious and attendants are unreachable, clinicians will proceed with life-saving stabilization under established medical emergency ethics.
              </li>
            </ul>
          </div>

          {/* Section 4 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <Clock className="h-5 w-5 text-royal" /> 4. Pharmacy Orders & Prescription Refills
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              Orders placed through our in-house 24/7 hospital pharmacy and digital store:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/75 space-y-1.5">
              <li>
                Schedule H and Schedule H1 drugs (including iron chelation, specialized antibiotics, and insulin) will only be dispensed against a valid prescription from a registered medical practitioner.
              </li>
              <li>
                Medicine returns are governed by Drugs and Cosmetics Rules. Opened, temperature-sensitive, or cold-chain medications (such as vaccines and blood components) cannot be returned once dispensed.
              </li>
            </ul>
          </div>

          {/* Section 5 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-royal" /> 5. Patient Responsibilities & Hospital Code of Conduct
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              To preserve a safe and healing healthcare environment:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/75 space-y-1.5">
              <li>
                Patients must provide truthful medical, drug allergy, and medication histories to attending clinicians.
              </li>
              <li>
                Violence, intimidation, or verbal abuse toward doctors, nursing staff, or healthcare personnel will attract immediate legal action under the Clinical Establishments Protection Acts.
              </li>
              <li>Smoking, tobacco consumption, and alcohol are strictly prohibited throughout hospital premises.</li>
            </ul>
          </div>

          {/* Section 6 */}
          <div className="border-t border-line pt-6">
            <h2 className="text-xl font-bold font-heading text-navy">
              6. Hospital Administration & Legal Desk
            </h2>
            <p className="mt-2 text-sm text-ink/80 leading-relaxed">
              These terms are governed by the laws of India and the jurisdiction of courts in Khammam, Telangana. For administrative queries:
            </p>
            <div className="mt-4 rounded-xl border border-line bg-canvas p-5 text-sm space-y-2">
              <p className="font-bold text-navy">{s.legalName} — Medical Superintendent Desk</p>
              <p className="text-ink/75">{s.physicalAddress}</p>
              <p className="flex items-center gap-2 text-ink/80">
                <Phone className="h-4 w-4 text-royal" />
                <span>Emergency Hotline: </span>
                <a className="font-semibold text-royal hover:underline" href={telHref(s.emergencyHotline)}>
                  {prettyPhone(s.emergencyHotline)}
                </a>
                {s.secondaryHotline && (
                  <>
                    <span> · Office Line: </span>
                    <a className="font-semibold text-royal hover:underline" href={telHref(s.secondaryHotline)}>
                      {prettyPhone(s.secondaryHotline)}
                    </a>
                  </>
                )}
              </p>
              <p className="flex items-center gap-2 text-ink/80">
                <Mail className="h-4 w-4 text-royal" />
                <span>Administration Email: </span>
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
