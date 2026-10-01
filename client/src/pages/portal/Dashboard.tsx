import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card } from "@/components/portal/ui";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";

type Dashboard = {
  stats: { patients: number; appointments: number; orders: number; products: number; dpdpPending: number };
  recentAppointments: Array<{ id: string; fullName: string; phone: string; department: string; status: string }>;
  recentOrders: Array<{ id: string; orderNumber: string; customerName: string; status: string; totalAmount: number }>;
};

export default function DashboardPage() {
  const { data, loading, error } = usePortalData<Dashboard>("/api/portal/dashboard");
  useEffect(() => { document.title = "Dashboard | Rithanya HMS"; }, []);

  if (loading) return <LoadingCard />;
  if (error || !data) return <ErrorCard error={error ?? "Could not load dashboard"} />;

  const cards: Array<[string, number, string]> = [
    ["Patients (EMR)", data.stats.patients, "/portal/outpatients"],
    ["Appointments", data.stats.appointments, "/portal/appointments"],
    ["Store orders", data.stats.orders, "/portal/store/orders"],
    ["Products", data.stats.products, "/portal/store/products"],
    ["DPDP pending", data.stats.dpdpPending, "/portal/compliance/dpdp-requests"],
  ];

  return (
    <>
      <PageHeader title="Dashboard" desc="Operations at a glance. Module access is enforced per your role." />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, n, href]) => (
          <Link key={label} to={href} className="rounded-xl border border-line bg-white p-6 hover:border-royal hover:shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-wider text-ink/60">{label}</p>
            <p className="mt-2 font-heading text-4xl font-bold text-navy">{n}</p>
          </Link>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Recent appointments</h2>
          <ul className="mt-4 divide-y divide-line">
            {data.recentAppointments.map((a) => (
              <li key={a.id} className="py-2.5 text-base"><strong>{a.fullName}</strong> · {a.department || "General"} · <span className="text-ink/65">{a.status}</span></li>
            ))}
            {data.recentAppointments.length === 0 && <li className="py-4 text-ink/60">No appointments yet.</li>}
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Recent orders</h2>
          <ul className="mt-4 divide-y divide-line">
            {data.recentOrders.map((o) => (
              <li key={o.id} className="py-2.5 text-base"><strong>{o.orderNumber}</strong> · {o.customerName} · <span className="text-ink/65">{o.status}</span></li>
            ))}
            {data.recentOrders.length === 0 && <li className="py-4 text-ink/60">No orders yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
