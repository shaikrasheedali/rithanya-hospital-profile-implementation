import { useEffect } from "react";
import { PageHeader, Card, EntityPicker, Empty } from "@/components/portal/ui";
import { formatINR } from "@/lib/utils";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";

export default function FinanceOverviewPage() {
  const { data, loading, error, reload } = usePortalData<{
    totals: { credit: number; debit: number; net: number };
    months: Array<{ month: string; credit: number; debit: number; net: number }>;
    byCategory: Array<{ name: string; total: number }>;
    retention: any;
    entity: string;
    entityLabel: string;
  }>("/api/portal/finance-overview");

  useEffect(() => {
    document.title = "Cash-flow Overview | Rithanya HMS";
  }, []);

  if (loading) return <LoadingCard />;
  if (error || !data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;

  const max = Math.max(1, ...data.months.map((m) => Math.max(m.credit, m.debit)));

  return (
    <>
      <PageHeader
        title={`Cash-flow overview — ${data.entityLabel || (data.entity === "RVBC" ? "RVBC" : "Rithanya Hospital")}`}
        desc="Last 6 months from the finance ledger."
      >
        <EntityPicker value={data.entity} />
      </PageHeader>
      <div className="grid gap-5 sm:grid-cols-3">
        {[
          ["Total credit", data.totals.credit, "text-emerald-700"],
          ["Total debit", data.totals.debit, "text-alert"],
          ["Net", data.totals.net, "text-navy"],
        ].map(([l, v, c]) => (
          <Card key={l as string} className="p-6">
            <p className="text-sm font-semibold uppercase text-ink/60">{l}</p>
            <p className={"mt-2 text-3xl font-bold " + c}>{formatINR(Number(v))}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-6">
        <h2 className="text-lg font-semibold">Monthly trend</h2>
        {data.months.length === 0 ? (
          <Empty text="No ledger entries recorded for this entity yet." />
        ) : (
          <div className="mt-4 flex h-40 items-end gap-3">
            {data.months.map((m) => (
              <div key={m.month} className="flex-1 text-center">
                <div
                  className="mx-auto w-8 rounded-t bg-royal"
                  style={{ height: Math.round((m.credit / max) * 120) + "px" }}
                  title={"Credit " + m.credit}
                />
                <div
                  className="mx-auto mt-1 w-8 rounded-t bg-alert/70"
                  style={{ height: Math.round((m.debit / max) * 120) + "px" }}
                  title={"Debit " + m.debit}
                />
                <p className="mt-2 text-xs">{typeof m.month === "string" && m.month.length >= 7 ? m.month.slice(5) : m.month}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="mt-6 p-6">
        <h2 className="text-lg font-semibold">Spend by category</h2>
        {data.byCategory.length === 0 ? (
          <Empty text="No category expenses recorded for this entity yet." />
        ) : (
          data.byCategory.map((c) => (
            <div key={c.name} className="mt-3">
              <div className="flex justify-between text-base">
                <span>{c.name}</span>
                <strong>{formatINR(c.total)}</strong>
              </div>
              <div className="mt-1 h-2 rounded bg-line">
                <div
                  className="h-2 rounded bg-royal"
                  style={{
                    width:
                      Math.round(
                        (c.total / Math.max(1, ...data.byCategory.map((x) => x.total))) * 100
                      ) + "%",
                  }}
                />
              </div>
            </div>
          ))
        )}
      </Card>
    </>
  );
}