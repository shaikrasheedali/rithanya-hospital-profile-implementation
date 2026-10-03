import { useEffect, useState, useMemo } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle,
  Database,
  Layers,
  LineChart,
  PieChart,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Btn,
  Card,
  Empty,
  EntityPicker,
  Modal,
  PageHeader,
  api,
  useToast,
} from "@/components/portal/ui";
import { formatINR } from "@/lib/utils";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";

type OverviewData = {
  totals: {
    credit: number;
    debit: number;
    net: number;
    profitMargin: number;
    monthlyAverageSpend: number;
    activeCategoriesCount: number;
  };
  months: Array<{
    monthKey: string;
    name: string;
    year: number;
    month: number;
    credit: number;
    debit: number;
    net: number;
    itemCount: number;
    categorySpend: Record<string, number>;
  }>;
  byCategory: Array<{
    name: string;
    total: number;
    percentage: number;
    color: string;
    monthlyTrend: number[];
    topItem: string;
  }>;
  retention: any;
  entity: string;
  entityLabel: string;
};

export default function FinanceOverviewPage() {
  const toast = useToast();
  const { data, loading, error, reload } = usePortalData<OverviewData>(
    "/api/portal/finance-overview"
  );

  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<{
    name: string;
    year: number;
    month: number;
    count: number;
  } | null>(null);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    document.title = "Cash-flow Overview | Rithanya HMS";
  }, []);

  // Compute maximums for chart scales
  const maxMonthlyValue = useMemo(() => {
    if (!data?.months || data.months.length === 0) return 1;
    return Math.max(
      1,
      ...data.months.map((m) => Math.max(m.credit, m.debit))
    );
  }, [data?.months]);

  const maxCategorySpend = useMemo(() => {
    if (!data?.byCategory || data.byCategory.length === 0) return 1;
    return Math.max(1, ...data.byCategory.map((c) => c.total));
  }, [data?.byCategory]);

  if (loading) return <LoadingCard />;
  if (error || !data)
    return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;

  const isSurplus = data.totals.net >= 0;

  async function handlePurgeMonth() {
    if (!purgeTarget) return;
    setPurging(true);
    try {
      const res = await api(
        `/api/portal/ledger/month?year=${purgeTarget.year}&month=${purgeTarget.month}`,
        "DELETE"
      );
      if (!res.ok) {
        toast(res.error || "Failed to delete month data.", "err");
        return;
      }
      const purgedCount = (res.data as any)?.count ?? purgeTarget.count;
      toast(
        `Deleted ${purgedCount} ledger entries for ${purgeTarget.name}.`
      );
      setPurgeTarget(null);
      reload();
    } catch (err: any) {
      toast(err.message || "Failed to purge month data.", "err");
    } finally {
      setPurging(false);
    }
  }

  return (
    <>
      <PageHeader
        title={`Cash-flow Overview & BI Analytics — ${data.entityLabel}`}
        desc="Real-time financial intelligence, 12-month rolling cashflow trajectories, category cost centers, and retention management."
      >
        <div className="flex flex-wrap items-center gap-3">
          <EntityPicker value={data.entity} />
          <button
            onClick={() => reload()}
            aria-label="Refresh financial data"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-royal hover:text-royal transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </PageHeader>

      {/* Top Executive KPI Ribbon */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Inflow */}
        <Card className="p-5 relative overflow-hidden border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/65">
              Total Inflow (Credits)
            </span>
            <span className="rounded-full bg-emerald-50 p-2 text-emerald-700">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold font-heading text-emerald-700">
            {formatINR(data.totals.credit)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs text-ink/60">
            <span>Hospital revenues & clinical billings</span>
          </div>
        </Card>

        {/* KPI 2: Outflow */}
        <Card className="p-5 relative overflow-hidden border-l-4 border-l-alert">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/65">
              Total Outflow (Debits)
            </span>
            <span className="rounded-full bg-rose-50 p-2 text-alert">
              <ArrowDownRight className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold font-heading text-alert">
            {formatINR(data.totals.debit)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs text-ink/60">
            <span>Salaries, procurement & operations</span>
          </div>
        </Card>

        {/* KPI 3: Net Operational Surplus / Margin */}
        <Card
          className={`p-5 relative overflow-hidden border-l-4 ${
            isSurplus ? "border-l-royal" : "border-l-alert"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/65">
              Net Financial Result
            </span>
            <span
              className={`rounded-full p-2 ${
                isSurplus ? "bg-blue-50 text-royal" : "bg-rose-50 text-alert"
              }`}
            >
              {isSurplus ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </span>
          </div>
          <p
            className={`mt-2 text-2xl font-bold font-heading ${
              isSurplus ? "text-royal" : "text-alert"
            }`}
          >
            {isSurplus ? "+" : "−"}
            {formatINR(Math.abs(data.totals.net))}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span
              className={`font-bold ${
                isSurplus ? "text-emerald-700" : "text-alert"
              }`}
            >
              {data.totals.profitMargin}% Margin
            </span>
            <span className="text-ink/50">· 12-Month Net</span>
          </div>
        </Card>

        {/* KPI 4: Monthly Average Spend & Retention */}
        <Card className="p-5 relative overflow-hidden border-l-4 border-l-slate-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/65">
              Monthly Avg. Burn Rate
            </span>
            <span className="rounded-full bg-slate-100 p-2 text-slate-700">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold font-heading text-navy">
            {formatINR(data.totals.monthlyAverageSpend)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink/65">
            <span>{data.totals.activeCategoriesCount} Active Cost Centers</span>
            <Badge tone="green">12M Retention</Badge>
          </div>
        </Card>
      </div>

      {/* 12-Month Cashflow Trajectory Chart */}
      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-royal" />
              <h2 className="text-lg font-bold text-navy font-heading">
                12-Month Rolling Cash-Flow Trajectory (Inflow vs. Outflow)
              </h2>
            </div>
            <p className="text-xs text-ink/65 mt-0.5">
              Monthly debit vs credit comparisons with net operational surplus markers across the trailing 12 months.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-emerald-600 inline-block" />
              <span className="text-ink/80">Credits (Inflow)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-rose-500 inline-block" />
              <span className="text-ink/80">Debits (Outflow)</span>
            </div>
          </div>
        </div>

        {data.months.length === 0 ? (
          <Empty text="No monthly ledger entries recorded for this entity." />
        ) : (
          <div className="mt-6">
            {/* Chart Bars Grid */}
            <div className="flex h-56 items-end gap-2 sm:gap-3 px-2 pt-6">
              {data.months.map((m, idx) => {
                const creditH = Math.max(
                  4,
                  Math.round((m.credit / maxMonthlyValue) * 180)
                );
                const debitH = Math.max(
                  4,
                  Math.round((m.debit / maxMonthlyValue) * 180)
                );
                const isHovered = hoveredMonth === idx;

                return (
                  <div
                    key={m.monthKey}
                    onMouseEnter={() => setHoveredMonth(idx)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    className="group relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer transition-all"
                  >
                    {/* Tooltip on hover */}
                    {isHovered && (
                      <div className="absolute -top-16 z-20 w-44 rounded-lg border border-line bg-navy p-2 text-left text-white shadow-xl transition-all pointer-events-none">
                        <p className="font-bold text-xs text-gold">{m.name}</p>
                        <div className="mt-1 text-[11px] space-y-0.5">
                          <p className="text-emerald-300">
                            Credit: +{formatINR(m.credit)}
                          </p>
                          <p className="text-rose-300">
                            Debit: −{formatINR(m.debit)}
                          </p>
                          <p className="border-t border-slate-700 pt-0.5 font-bold">
                            Net: {m.net >= 0 ? "+" : "−"}
                            {formatINR(Math.abs(m.net))}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bars pair */}
                    <div className="flex items-end justify-center gap-1 w-full max-w-[2.5rem]">
                      {/* Credit Bar */}
                      <div
                        className="w-1/2 rounded-t-sm bg-emerald-600 hover:bg-emerald-500 transition-all shadow-xs"
                        style={{ height: `${creditH}px` }}
                        title={`Credit: ${formatINR(m.credit)}`}
                      />
                      {/* Debit Bar */}
                      <div
                        className="w-1/2 rounded-t-sm bg-rose-500 hover:bg-rose-400 transition-all shadow-xs"
                        style={{ height: `${debitH}px` }}
                        title={`Debit: ${formatINR(m.debit)}`}
                      />
                    </div>

                    {/* Month Label */}
                    <p
                      className={`mt-2 text-[10px] sm:text-xs font-semibold truncate ${
                        isHovered ? "text-royal font-bold" : "text-ink/70"
                      }`}
                    >
                      {m.name.slice(0, 3)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Hovered Month Detail Banner */}
            {hoveredMonth !== null && data.months[hoveredMonth] && (
              <div className="mt-4 rounded-lg bg-canvas p-3 border border-line flex flex-wrap items-center justify-between text-xs animate-in fade-in duration-150">
                <span className="font-bold text-navy text-sm">
                  {data.months[hoveredMonth].name} Performance:
                </span>
                <span className="text-emerald-700 font-semibold">
                  Credits: +{formatINR(data.months[hoveredMonth].credit)}
                </span>
                <span className="text-alert font-semibold">
                  Debits: −{formatINR(data.months[hoveredMonth].debit)}
                </span>
                <span
                  className={`font-bold ${
                    data.months[hoveredMonth].net >= 0
                      ? "text-emerald-700"
                      : "text-alert"
                  }`}
                >
                  Net Margin:{" "}
                  {data.months[hoveredMonth].net >= 0 ? "+" : "−"}
                  {formatINR(Math.abs(data.months[hoveredMonth].net))}
                </span>
                <span className="text-ink/60">
                  {data.months[hoveredMonth].itemCount} Recorded Entries
                </span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Spending Breakdown by Category Section */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Visual Category Breakdown & Trajectories */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-royal" />
                <h3 className="text-lg font-bold text-navy font-heading">
                  Spending Breakdown by Cost Category
                </h3>
              </div>
              <span className="text-xs text-ink/65 font-medium">
                Matches /portal/finance/categories
              </span>
            </div>

            {/* Segmented Distribution Bar */}
            <div className="mt-5">
              <div className="h-4 w-full rounded-full bg-slate-100 flex overflow-hidden shadow-inner">
                {data.byCategory.map((c) => {
                  if (c.percentage <= 0) return null;
                  return (
                    <div
                      key={c.name}
                      style={{
                        width: `${c.percentage}%`,
                        backgroundColor: c.color,
                      }}
                      className="h-full hover:brightness-110 transition-all cursor-pointer"
                      title={`${c.name}: ${c.percentage}% (${formatINR(c.total)})`}
                      onClick={() =>
                        setSelectedCategory(
                          selectedCategory === c.name ? null : c.name
                        )
                      }
                    />
                  );
                })}
              </div>
            </div>

            {/* Category List Cards */}
            <div className="mt-6 divide-y divide-line">
              {data.byCategory.map((c) => {
                const isSelected = selectedCategory === c.name;
                return (
                  <div
                    key={c.name}
                    onClick={() =>
                      setSelectedCategory(isSelected ? null : c.name)
                    }
                    className={`py-3.5 px-3 rounded-lg transition-all cursor-pointer ${
                      isSelected ? "bg-canvas border border-line" : "hover:bg-canvas/50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3.5 w-3.5 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="font-semibold text-navy">
                          {c.name}
                        </span>
                        {c.name.toLowerCase() === "payroll" && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-royal">
                            Core
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-ink/65">
                          {c.percentage}%
                        </span>
                        <strong className="font-heading text-navy text-base">
                          {formatINR(c.total)}
                        </strong>
                      </div>
                    </div>

                    {/* Progress line */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-line overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round(
                            (c.total / maxCategorySpend) * 100
                          )}%`,
                          backgroundColor: c.color,
                        }}
                      />
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink/60">
                      <span>Top Transaction: {c.topItem}</span>
                      <span>Click to view trajectory</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 12-Month Trajectory Mini-Graphs for Each Category */}
          <Card className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <LineChart className="h-5 w-5 text-royal" />
                <h3 className="text-lg font-bold text-navy font-heading">
                  Category Spending Trajectories (12-Month Trendlines)
                </h3>
              </div>
              <span className="text-xs text-ink/65">Annual expense curves</span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {data.byCategory.map((cat) => {
                const maxTrend = Math.max(1, ...cat.monthlyTrend);
                return (
                  <div
                    key={cat.name}
                    className="rounded-xl border border-line bg-canvas p-4 hover:border-royal/50 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-semibold text-xs text-navy truncate max-w-[10rem]">
                          {cat.name}
                        </span>
                      </div>
                      <span className="font-heading font-bold text-xs text-navy">
                        {formatINR(cat.total)}
                      </span>
                    </div>

                    {/* Mini Sparkline / Trendline Graph */}
                    <div className="flex h-16 items-end gap-1 pt-2">
                      {cat.monthlyTrend.map((amt, i) => {
                        const h = Math.max(
                          2,
                          Math.round((amt / maxTrend) * 50)
                        );
                        return (
                          <div
                            key={i}
                            className="flex-1 flex flex-col items-center justify-end h-full group"
                          >
                            <div
                              className="w-full rounded-xs transition-all hover:opacity-80"
                              style={{
                                height: `${h}px`,
                                backgroundColor: cat.color,
                              }}
                              title={`${data.months[i]?.name || ""}: ${formatINR(amt)}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] text-ink/50">
                      <span>{data.months[0]?.name.slice(0, 3)}</span>
                      <span>Trajectory (12M)</span>
                      <span>
                        {data.months[data.months.length - 1]?.name.slice(0, 3)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Month Data Audit & Deletion Management */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 pb-3 border-b border-line">
              <Calendar className="h-5 w-5 text-royal" />
              <h3 className="text-base font-bold text-navy font-heading">
                Monthly Data Audit & Purge
              </h3>
            </div>
            <p className="mt-2 text-xs text-ink/70 leading-relaxed">
              Manage complete data month-by-month. You can review individual month totals and safely delete complete records of any month to keep financial books clean.
            </p>

            {/* List of Months */}
            <div className="mt-4 max-h-[38rem] overflow-y-auto space-y-2 pr-1">
              {data.months.map((m) => (
                <div
                  key={m.monthKey}
                  className="rounded-lg border border-line bg-canvas/70 p-3 hover:bg-canvas transition-colors flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-xs text-navy block">
                      {m.name}
                    </span>
                    <span className="text-[11px] text-ink/65">
                      {m.itemCount} entries · Net:{" "}
                      <span
                        className={
                          m.net >= 0 ? "text-emerald-700 font-semibold" : "text-alert font-semibold"
                        }
                      >
                        {m.net >= 0 ? "+" : "−"}
                        {formatINR(Math.abs(m.net))}
                      </span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setPurgeTarget({
                        name: m.name,
                        year: m.year,
                        month: m.month,
                        count: m.itemCount,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-alert/30 bg-alert/10 px-2.5 py-1 text-xs font-semibold text-alert hover:bg-alert/20 active:scale-95 transition-all"
                    title={`Delete complete data for ${m.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* 12-Month Rolling Retention Information Banner */}
          <Card className="p-5 bg-blue-50/50 border border-royal/20">
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 text-royal shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-navy">
                  12-Month Rolling Retention Active
                </h4>
                <p className="mt-1 text-xs text-ink/75 leading-relaxed">
                  Ledger transactions and payroll records are actively retained for the trailing 12 months from the current date. As new months enter, older records are pruned to optimize storage.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700">
                    Storage optimization policy active
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Delete Month Confirmation Modal */}
      {purgeTarget && (
        <Modal
          size="md"
          title={`Confirm Data Purge — ${purgeTarget.name}`}
          onClose={() => setPurgeTarget(null)}
          footer={
            <>
              <Btn variant="secondary" onClick={() => setPurgeTarget(null)}>
                Cancel
              </Btn>
              <button
                type="button"
                onClick={handlePurgeMonth}
                disabled={purging}
                className="inline-flex items-center gap-2 rounded-lg bg-alert px-4 py-2 text-sm font-semibold text-white hover:bg-alert/90 disabled:opacity-60 transition-all"
              >
                <Trash2 className="h-4 w-4" />
                {purging ? "Purging data…" : "Yes, Delete Complete Month Data"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong className="block font-bold mb-1">
                  Irreversible Financial Ledger Purge
                </strong>
                Are you sure you want to delete all{" "}
                <strong>{purgeTarget.count}</strong> financial ledger entries
                recorded for <strong>{purgeTarget.name}</strong>? This action
                cannot be undone. (You can print/download the monthly PDF ledger
                from the Ledger desk prior to deleting if needed).
              </div>
            </div>
            <p className="text-xs text-ink/70">
              Entity:{" "}
              <strong className="text-navy">{data.entityLabel}</strong> ·
              Target Month:{" "}
              <strong className="text-navy">{purgeTarget.name}</strong>
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}