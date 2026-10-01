"use client";

import { useEffect, useState } from "react";
import { ChevronDown, MapPin, Phone, Radio } from "lucide-react";
import { Badge, Btn, Card, Empty, PageHeader, api, inputCls, useToast } from "@/components/portal/ui";
import { formatDate, formatINR } from "@/lib/utils";

export type OrderDTO = {
  id: string; orderNumber: string; customerName: string; phoneNumber: string; shippingAddress: string; pinCode: string;
  totalAmount: string; status: string; paymentMethod: string; isPaid: boolean; createdAt: string;
  items: { id: string; productName: string; quantity: number; unitPrice: string }[];
};

const FLOW = ["PENDING", "PAID", "PROCESSING", "DISPATCHED", "DELIVERED"] as const;
const TONE: Record<string, "amber" | "blue" | "purple" | "green" | "slate" | "red"> = { PENDING: "amber", PAID: "blue", PROCESSING: "purple", DISPATCHED: "blue", DELIVERED: "green", CANCELLED: "red" };

export function OrdersDesk({ orders }: { orders: OrderDTO[] }) {
  const toast = useToast();
  const [f, setF] = useState("ALL");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => window.location.reload(), 20000);
    return () => clearInterval(t);
  }, []);

  async function setStatus(id: string, status: string) {
    const r = await api(`/api/portal/r/orders/${id}`, "PUT", { status });
    if (!r.ok) return toast(r.error || "Update failed", "err");
    toast(`Order marked ${status}`);
    window.location.reload();
  }
  const list = orders.filter((o) => f === "ALL" || o.status === f);

  return (
    <>
      <PageHeader title="Orders dispatch desk" desc="Live feed of storefront orders. Move each order through Pending → Paid → Processing → Dispatched → Delivered (cancelling restores stock).">
        <span className="flex items-center gap-2 text-base text-ink/70"><Radio className="h-4 w-4 animate-pulse text-emerald-600" /> Auto-refreshing every 20 s</span>
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-2">
        {["ALL", ...FLOW, "CANCELLED"].map((s) => (
          <button key={s} onClick={() => setF(s)} aria-pressed={f === s} className={`rounded-full border px-4 py-1.5 font-medium ${f === s ? "border-royal bg-royal text-white" : "border-line bg-white hover:border-royal"}`}>{s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} ({s === "ALL" ? orders.length : orders.filter((o) => o.status === s).length})</button>
        ))}
      </div>
      <Card>
        {list.length === 0 ? <Empty text="No orders in this state." /> : (
          <ul className="divide-y divide-line">
            {list.map((o) => {
              const idx = FLOW.indexOf(o.status as (typeof FLOW)[number]);
              const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
              const open = openId === o.id;
              return (
                <li key={o.id}>
                  <button onClick={() => setOpenId(open ? null : o.id)} aria-expanded={open} className="flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left hover:bg-canvas/60">
                    <span>
                      <span className="flex flex-wrap items-center gap-2 text-lg font-semibold text-navy">{o.orderNumber} <Badge tone={TONE[o.status]}>{o.status}</Badge> <Badge>{o.paymentMethod}</Badge></span>
                      <span className="text-base text-ink/75">{o.customerName} · {formatDate(o.createdAt, true)}</span>
                    </span>
                    <span className="flex items-center gap-3"><span className="font-heading text-xl font-bold text-navy">{formatINR(o.totalAmount)}</span><ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} /></span>
                  </button>
                  {open && (
                    <div className="grid gap-6 border-t border-line bg-canvas/50 p-5 lg:grid-cols-2">
                      <div className="space-y-3 text-base">
                        <p className="flex gap-2"><Phone className="mt-1 h-4 w-4 flex-none text-royal" /><a href={`tel:${o.phoneNumber}`} className="font-semibold text-royal">{o.phoneNumber}</a></p>
                        <p className="flex gap-2"><MapPin className="mt-1 h-4 w-4 flex-none text-royal" /><span>{o.shippingAddress} — PIN {o.pinCode}</span></p>
                        <ul className="rounded-lg border border-line bg-white">
                          {o.items.map((i) => <li key={i.id} className="flex justify-between border-b border-line p-3 last:border-0"><span>{i.productName} × {i.quantity}</span><span className="font-semibold">{formatINR(Number(i.unitPrice) * i.quantity)}</span></li>)}
                        </ul>
                      </div>
                      <div>
                        <ol className="mb-5 flex flex-wrap items-center gap-2" aria-label="Order progress">
                          {FLOW.map((s, i) => (
                            <li key={s} className={`rounded-full px-3 py-1 text-sm font-semibold ${o.status === "CANCELLED" ? "bg-slate-100 text-slate-400" : i <= idx ? "bg-royal text-white" : "bg-slate-100 text-slate-600"}`}>{s.charAt(0) + s.slice(1).toLowerCase()}</li>
                          ))}
                        </ol>
                        <div className="flex flex-wrap items-center gap-3">
                          {next && o.status !== "CANCELLED" && <Btn onClick={() => setStatus(o.id, next)}>Mark as {next.toLowerCase()}</Btn>}
                          <select aria-label="Set status" value={o.status} disabled={o.status === "CANCELLED"} onChange={(e) => setStatus(o.id, e.target.value)} className={`${inputCls} !w-auto`}>
                            {[...FLOW, "CANCELLED"].map((s) => <option key={s}>{s}</option>)}
                          </select>
                          {o.status !== "CANCELLED" && o.status !== "DELIVERED" && <Btn variant="danger" onClick={() => confirm("Cancel this order and restore stock?") && setStatus(o.id, "CANCELLED")}>Cancel order</Btn>}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
