import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { PageHero } from "@/components/site/ui";
import { useSiteSettings } from "@/lib/settingsContext";
import { prettyPhone, telHref } from "@/lib/utils";

export default function PrivacyPage() {
  const { settings: s } = useSiteSettings();

  useEffect(() => {
    document.title = "Privacy Policy | Rithanya Hospital";
  }, []);

  return (
    <>
      <PageHero
        eyebrow="Compliance & Governance"
        title="Privacy Policy"
        desc="How Rithanya Hospital & Research Centre protects your clinical, personal and sensitive medical data under the Digital Personal Data Protection (DPDP) Act, 2023."
      />

      <section className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        {/* Notice Card */}
        <div className="mb-10 rounded-2xl border border-royal/20 bg-blue-50/60 p-6">
          <div className="flex items-start gap-4">
            <ShieldCheck className="h-6 w-6 text-royal shrink-0 mt-0.5" />
            <div>
              <h3 className="font-heading text-lg font-bold text-navy">
                Commitment to Patient Privacy & Data Security
              </h3>
              <p className="mt-1 text-sm text-ink/75 leading-relaxed">
                At {s.legalName} and RVBC (Rithanya Voluntary Blood Centre), patient confidentiality and clinical privacy are paramount ethical commitments. This policy outlines how your health data is gathered, encrypted, processed, and safeguarded.
              </p>
            </div>
          </div>
        </div>

        <div className="prose-rh rounded-2xl border border-line bg-white p-8 sm:p-10 shadow-sm space-y-8">
          {/* Section 1 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-royal" /> 1. Information We Collect
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              We collect information strictly necessary to deliver patient diagnosis, day-care transfusions, clinical observations, outpatient consultations, and pharmacy fulfilment:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/75 space-y-1.5">
              <li>
                <strong>Patient Identity Data:</strong> Full legal name, date of birth, age, gender, contact number, residential address, emergency contact, and government ID / Ayushman Bharat PM-JAY identification where applicable.
              </li>
              <li>
                <strong>Clinical & Health Records (EMR):</strong> Medical history, diagnosed chronic conditions (including Thalassemia, Sickle Cell Disease, Diabetology profiles), vitals, lab reports, doctor clinical notes, prescriptions, and blood transfusion records.
              </li>
              <li>
                <strong>Appointment & Digital Requests:</strong> Appointment bookings, department preferences, pharmacy order delivery coordinates, and DPDP erasure tokens.
              </li>
              <li>
                <strong>Financial & Billing Information:</strong> Payment mode, invoice reference, and insurance/TPA pre-authorization details. (We never store payment card credentials).
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <Lock className="h-5 w-5 text-royal" /> 2. Security, Cryptography & Access Control
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              Patient health records and electronic medical records (EMR) in our system are protected with multi-layered clinical safeguards:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/75 space-y-1.5">
              <li>
                <strong>Encryption:</strong> Sensitive clinical notes, consent forms, and patient profiles are encrypted at rest using industry-standard AES-256-GCM encryption. All data transmissions are enforced via HTTPS / TLS 1.3.
              </li>
              <li>
                <strong>Role-Based Access Control:</strong> Only authorized attending clinicians, duty nurses, and pharmacy staff have verified, audited access to patient records on a need-to-know basis.
              </li>
              <li>
                <strong>Non-Disclosure:</strong> We do not sell, rent, monetize, or trade patient personal or clinical information with any third-party marketing entities.
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <FileText className="h-5 w-5 text-royal" /> 3. Data Retention & Storage Optimization
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              In accordance with statutory healthcare regulations and data minimization standards:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/75 space-y-1.5">
              <li>
                <strong>12-Month Financial Ledger Retention:</strong> Daily operational finance ledger records and temporary payroll calculations are maintained on an active 12-month rolling retention cycle to optimize server storage, with official monthly ledgers permanently archived in verified PDF statements.
              </li>
              <li>
                <strong>Clinical Records:</strong> Active inpatient and outpatient electronic medical records are securely preserved in adherence to national clinical establishment standards and the National Medical Commission (NMC) guidelines.
              </li>
              <li>
                <strong>Consent Forms:</strong> Signed procedural and medical consent forms are maintained with digital audit timestamps.
              </li>
            </ul>
          </div>

          {/* Section 4 */}
          <div>
            <h2 className="text-xl font-bold font-heading text-navy flex items-center gap-2">
              <Shield className="h-5 w-5 text-royal" /> 4. Your Rights Under the DPDP Act, 2023
            </h2>
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              As a Data Principal under India's Digital Personal Data Protection Act, 2023, you have the right to:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/75 space-y-1.5">
              <li>Request a summary of your personal and health data held by the hospital.</li>
              <li>Seek correction of inaccurate or outdated demographic and medical information.</li>
              <li>
                File a digital data erasure request via our online{" "}
                <Link to="/dpdp-erasure-request" className="text-royal font-semibold hover:underline">
                  DPDP Erasure Desk
                </Link>
                . Verified requests result in the secure erasure of non-mandatory historical data.
              </li>
              <li>Nominate another individual to exercise these rights in the event of incapacity or demise.</li>
            </ul>
          </div>

          {/* Section 5 */}
          <div className="border-t border-line pt-6">
            <h2 className="text-xl font-bold font-heading text-navy">
              5. Grievance Officer & Contact Information
            </h2>
            <p className="mt-2 text-sm text-ink/80 leading-relaxed">
              For privacy queries, consent withdrawals, or data rights inquiries, please reach our Data Protection Officer and Patient Care Desk:
            </p>
            <div className="mt-4 rounded-xl border border-line bg-canvas p-5 text-sm space-y-2">
              <p className="font-bold text-navy">{s.legalName} — Privacy & Compliance Cell</p>
              <p className="text-ink/75">{s.physicalAddress}</p>
              <p className="flex items-center gap-2 text-ink/80">
                <Phone className="h-4 w-4 text-royal" />
                <span>Emergency Desk: </span>
                <a className="font-semibold text-royal hover:underline" href={telHref(s.emergencyHotline)}>
                  {prettyPhone(s.emergencyHotline)}
                </a>
                {s.secondaryHotline && (
                  <>
                    <span> · Enquiry: </span>
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
