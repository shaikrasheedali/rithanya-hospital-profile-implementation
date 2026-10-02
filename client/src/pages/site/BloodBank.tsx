import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HeartHandshake, Phone, ShieldCheck, Clock, Droplets, AlertCircle } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { PageHero, SectionHeading, EmptyState } from "@/components/site/ui";
import { BloodStockCards } from "@/components/site/BloodStockCards";
import { telHref, prettyPhone } from "@/lib/utils";

type StockRow = {
  id: string;
  bloodGroup: string;
  groupCategory: string;
  wholeBloodUnits: number;
  plasmaUnits: number;
  lastUpdated: string;
};

export default function BloodBankPage() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Live Blood Bank & Thalassemia Daycare | Rithanya Hospital";
    fetch("/api/public/blood-stock")
      .then((r) => r.json())
      .then((d) => setStock(d.stock ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHero
        eyebrow="Humanitarian Daycare & Blood Centre"
        title="24/7 Live Blood Bank"
        desc="Real-time availability of screened, component-separated blood units. Serving thalassemia warriors, surgical cases, and emergency trauma patients in Khammam."
      />

      {/* Live Stock Section */}
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:py-20">
        <SectionHeading
          eyebrow="Live stock tracker"
          title="Current blood unit inventory"
          desc="Units are screened and replenished around the clock in collaboration with Red Cross & Voluntary Blood Centres."
        />

        <div className="mt-8">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-64 animate-pulse rounded-2xl bg-line/60" />
              ))}
            </div>
          ) : stock.length === 0 ? (
            <EmptyState
              title="Updating inventory"
              text="Our blood bank team is currently updating live counts. Please call the emergency hotline directly."
            />
          ) : (
            <BloodStockCards initial={stock} threshold={3} />
          )}
        </div>

        {/* Emergency Assistance Notice */}
        <div className="mt-12 rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-red-100 text-[#D32F2F]">
                <Droplets className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-navy">Need urgent blood units?</h3>
                <p className="mt-1 text-base text-ink/75">
                  Call our 24/7 emergency dispatch directly. Matched and cross-checked blood units are ready for immediate dispatch.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={telHref("8328581019")}
                className="inline-flex items-center gap-2 rounded-full bg-[#D32F2F] px-6 py-3 font-semibold text-white shadow-md transition-all hover:bg-red-700"
              >
                <Phone className="h-4 w-4" /> Call 83285 81019
              </a>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-6 py-3 font-semibold text-navy hover:border-royal hover:text-royal"
              >
                Directions & Desk
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Thalassemia Daycare & Donor Information */}
      <section className="border-t border-line bg-canvas py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-2">
            <Reveal>
              <div className="rounded-2xl border border-line bg-white p-8 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-royal/10 text-royal">
                  <HeartHandshake className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-2xl font-bold text-navy">Thalassemia & Sickle Cell Daycare</h3>
                <p className="mt-3 text-base leading-relaxed text-ink/80">
                  Our flagship daycare transfusion wing provides scheduled, safe red cell transfusions in a clean, compassionate, and stress-free environment for children and adults with hemoglobinopathies.
                </p>
                <ul className="mt-6 space-y-3 text-base text-ink/80">
                  <li className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" /> Pre-transfusion screening & exact matching
                  </li>
                  <li className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-emerald-600" /> Observation beds with attentive bedside nurses
                  </li>
                  <li className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-emerald-600" /> Iron chelation monitoring & family counselling
                  </li>
                </ul>
                <div className="mt-8">
                  <Link
                    to="/clinical-care/specialties"
                    className="font-semibold text-royal hover:text-alert"
                  >
                    Learn about our Diabetology & Daycare Specialty →
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="rounded-2xl border border-line bg-white p-8 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/20 text-navy">
                  <Droplets className="h-6 w-6 text-gold" />
                </div>
                <h3 className="mt-5 text-2xl font-bold text-navy">Become a Voluntary Blood Donor</h3>
                <p className="mt-3 text-base leading-relaxed text-ink/80">
                  Every blood donation can save up to three lives. We conduct voluntary blood donation drives and maintain a donor registry for urgent cross-matching requirements.
                </p>
                <div className="mt-6 space-y-4 rounded-xl bg-canvas p-5 text-sm text-ink/80">
                  <p><strong>Eligibility:</strong> Age 18–65, weight ≥ 45 kg, hemoglobin ≥ 12.5 g/dL, good general health.</p>
                  <p><strong>Donation Frequency:</strong> Every 3 months for men, every 4 months for women.</p>
                </div>
                <div className="mt-8 flex gap-4">
                  <a
                    href="https://wa.me/918328581019?text=Hi%2C%20I%20would%20like%20to%20register%20as%20a%20voluntary%20blood%20donor"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-royal px-6 py-3 font-semibold text-white hover:bg-navy"
                  >
                    Register as Donor on WhatsApp
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
