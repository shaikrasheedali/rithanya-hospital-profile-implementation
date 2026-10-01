import { useEffect } from "react";
import { PageHero } from "@/components/site/ui";

export default function PrivacyPage() {
  useEffect(() => { document.title = "Privacy Policy | Rithanya Hospital"; }, []);
  return (
    <>
      <PageHero eyebrow="Compliance" title="Privacy policy" desc="How we handle patient and website data under the DPDP Act, 2023." />
      <section className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        <div className="prose-rh rounded-xl border border-line bg-white p-8">
          <h2>Data we collect</h2>
          <p>Appointment requests (name, phone, department), pharmacy orders (address, PIN), and DPDP erasure requests. EMR data entered by staff is encrypted at rest with AES-256-GCM.</p>
          <h2>How we use it</h2>
          <p>Only to provide care, confirm appointments, fulfil orders, and meet legal obligations. We never sell personal data.</p>
          <h2>Your rights</h2>
          <p>You may request access, correction or erasure via the DPDP erasure request page. Verified erasure destroys matched EMR records, stays and vitals.</p>
          <h2>Retention</h2>
          <p>Financial ledger and audit logs older than one year are purged automatically. EMR records are retained per medical-record requirements unless erased under DPDP.</p>
          <h2>Contact</h2>
          <p>For privacy queries, contact the hospital front desk or file a DPDP request with your tracking code.</p>
        </div>
      </section>
    </>
  );
}
