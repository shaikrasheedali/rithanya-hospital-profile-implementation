import { useEffect } from "react";
import { PageHero } from "@/components/site/ui";
import { DpdpForm, DpdpStatus } from "@/components/site/DpdpForm";

export default function DpdpPage() {
  useEffect(() => { document.title = "DPDP Erasure Request | Rithanya Hospital"; }, []);
  return (
    <>
      <PageHero eyebrow="Your data rights" title="Request erasure of your records" desc="Under the Digital Personal Data Protection Act, 2023. You will receive a tracking code to follow your request." />
      <section className="mx-auto max-w-4xl space-y-8 px-6 py-16 sm:px-8">
        <DpdpForm />
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Already submitted? Check status</h2>
          <DpdpStatus />
        </div>
      </section>
    </>
  );
}
