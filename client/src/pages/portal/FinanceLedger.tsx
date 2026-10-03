import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Btn,
  Card,
  Empty,
  EntityPicker,
  Field,
  Modal,
  PageHeader,
  api,
  inputCls,
  useToast,
} from "@/components/portal/ui";
import { computeMonthlyPayroll, daysInMonth } from "@/lib/payroll";
import { formatDate, formatINR } from "@/lib/utils";
import { downloadLedgerPdf } from "@/components/portal/LedgerPdf";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function FinanceLedgerPage() {
  const toast = useToast();
  const { data, loading, error, reload } = usePortalData<{
    items: any[];
    categories: any[];
    entity: string;
    entityLabel: string;
  }>("/api/portal/ledger");

  const [q, setQ] = useState("");
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // Modal state
  const [editing, setEditing] = useState<any | "new" | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [addingPayroll, setAddingPayroll] = useState(false);

  useEffect(() => {
    document.title = "Finance Ledger | Rithanya HMS";
  }, []);

  // Adaptive year choices: current year - 1, current year, current year + 1
  const availableYears = useMemo(() => {
    const list = [currentYear - 1, currentYear, currentYear + 1];
    if (!list.includes(selectedYear)) list.push(selectedYear);
    return list.sort((a, b) => a - b);
  }, [currentYear, selectedYear]);

  // Filter entries to the selected month and year
  const monthEntries = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item: any) => {
      const d = new Date(item.entryDate);
      if (isNaN(d.getTime())) return false;
      return (
        d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth
      );
    });
  }, [data?.items, selectedYear, selectedMonth]);

  // Filter by search query
  const shownEntries = useMemo(() => {
    if (!q) return monthEntries;
    const query = q.toLowerCase();
    return monthEntries.filter((r) =>
      JSON.stringify(Object.values(r)).toLowerCase().includes(query)
    );
  }, [monthEntries, q]);

  // Monthly aggregates
  const monthCredit = useMemo(
    () =>
      monthEntries
        .filter((e) => e.type === "CREDIT")
        .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [monthEntries]
  );

  const monthDebit = useMemo(
    () =>
      monthEntries
        .filter((e) => e.type === "DEBIT")
        .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [monthEntries]
  );

  const monthNet = monthCredit - monthDebit;

  if (loading) return <LoadingCard />;
  if (error || !data)
    return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;

  const categoryOpts = data.categories.map((c: any) => ({
    value: c.id,
    label: c.name,
  }));

  function openModal(row: any | "new") {
    if (row === "new") {
      setFormData({
        entity: data?.entity ?? "RITHANYA_HOSPITAL",
        type: "DEBIT",
        itemName: "",
        vendorPayee: "",
        amount: "",
        categoryId: "",
        method: "Cash",
        entryDate: new Date().toISOString().slice(0, 10),
        description: "",
      });
    } else {
      setFormData({
        entity: row.entity ?? data?.entity,
        type: row.type ?? "DEBIT",
        itemName: row.itemName ?? "",
        vendorPayee: row.vendorPayee ?? "",
        amount: String(row.amount ?? ""),
        categoryId: row.categoryId ?? "",
        method: row.method ?? "Cash",
        entryDate: row.entryDate ? row.entryDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        description: row.description ?? "",
      });
    }
    setEditing(row);
  }

  async function handleSave() {
    if (!formData.itemName?.trim()) {
      toast("Item name is required.", "err");
      return;
    }
    if (!formData.vendorPayee?.trim()) {
      toast("Vendor / Payee is required.", "err");
      return;
    }
    const amt = Number(formData.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast("Please enter a valid amount greater than 0.", "err");
      return;
    }

    setBusy(true);
    const body = {
      ...formData,
      amount: amt,
      categoryId: formData.categoryId || null,
    };

    const r =
      editing === "new"
        ? await api(`/api/portal/r/ledger`, "POST", body)
        : await api(`/api/portal/r/ledger/${editing.id}`, "PUT", body);

    setBusy(false);
    if (!r.ok) {
      toast(r.error || "Save failed — please try again.", "err");
      return;
    }

    toast(editing === "new" ? "Ledger entry added" : "Ledger entry updated");
    setEditing(null);
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this ledger entry? This cannot be undone.")) return;
    setRowBusy(id);
    const r = await api(`/api/portal/r/ledger/${id}`, "DELETE");
    setRowBusy(null);
    if (!r.ok) {
      toast(r.error || "Delete failed — please try again.", "err");
      return;
    }
    toast("Ledger entry deleted");
    reload();
  }

  // Print ledger to PDF
  async function handlePrintLedger() {
    setPrinting(true);
    try {
      await downloadLedgerPdf({
        items: shownEntries,
        monthName: MONTHS[selectedMonth - 1],
        year: selectedYear,
        entityLabel: data?.entityLabel || (data?.entity === "RVBC" ? "RVBC" : "Rithanya Hospital"),
        totalCredit: monthCredit,
        totalDebit: monthDebit,
        net: monthNet,
      });
      toast(`Ledger PDF printed for ${MONTHS[selectedMonth - 1]} ${selectedYear}`);
    } catch (err) {
      console.error("Print ledger failed:", err);
      toast("Could not generate ledger PDF. Please try again.", "err");
    } finally {
      setPrinting(false);
    }
  }

  // Add Payrolls Entry
  async function handleAddPayrollsEntry() {
    setAddingPayroll(true);
    try {
      const targetEntity = data?.entity ?? "RITHANYA_HOSPITAL";
      const payrollRes = await fetch(
        `/api/portal/payroll?month=${selectedMonth}&year=${selectedYear}&entity=${targetEntity}`,
        { headers: { Accept: "application/json" }, credentials: "include" }
      );
      if (!payrollRes.ok) {
        throw new Error("Failed to fetch payroll calculations.");
      }
      const pData = await payrollRes.json();
      const activeEmps = (pData.employees || []).filter((e: any) => e.isActive !== false);

      if (activeEmps.length === 0) {
        toast("No active employees found to generate payroll disbursement entry.", "err");
        setAddingPayroll(false);
        return;
      }

      const calDays = daysInMonth(selectedMonth, selectedYear);
      const recMap = new Map((pData.records || []).map((r: any) => [r.employeeId, r]));

      let totalNetPayable = 0;
      for (const emp of activeEmps) {
        const r: any = recMap.get(emp.id);
        if (r && typeof r.netPayable === "number") {
          totalNetPayable += r.netPayable;
        } else {
          const calc = computeMonthlyPayroll({
            baseSalary: Number(emp.monthlyFixedBaseSalary || emp.base || 0),
            calendarDays: calDays,
            lopDays: 0,
            allowances: 0,
            otherDeductions: 0,
          });
          totalNetPayable += calc.netPayable;
        }
      }

      if (totalNetPayable <= 0) {
        toast("Calculated payroll disbursement total is ₹0. No entry created.", "err");
        setAddingPayroll(false);
        return;
      }

      // Find or link the mandatory "Payroll" category
      const payrollCat = (data?.categories || []).find(
        (c: any) => c.name?.toLowerCase() === "payroll"
      );

      // Date of the button click as required
      const todayDate = new Date().toISOString().slice(0, 10);
      const monthLabel = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

      const res = await api(`/api/portal/r/ledger`, "POST", {
        entity: targetEntity,
        type: "DEBIT",
        itemName: `Payroll Disbursement - ${monthLabel}`,
        vendorPayee: `Staff Salaries (${activeEmps.length} Employees)`,
        amount: Math.round(totalNetPayable),
        categoryId: payrollCat?.id || null,
        method: "NEFT",
        entryDate: todayDate,
        description: `Total net payroll disbursed for ${monthLabel} across ${activeEmps.length} active staff members.`,
      });

      if (!res.ok) {
        toast(res.error || "Failed to record payroll entry in ledger.", "err");
        setAddingPayroll(false);
        return;
      }

      toast(
        `Disbursement entry of ${formatINR(totalNetPayable)} posted to ledger for ${monthLabel}`
      );
      reload();
    } catch (err: any) {
      console.error("Add payroll entry error:", err);
      toast(err.message || "Failed to add payroll entry.", "err");
    } finally {
      setAddingPayroll(false);
    }
  }

  return (
    <>
      <PageHeader
        title={`Finance Ledger — ${data.entityLabel || (data.entity === "RVBC" ? "RVBC" : "Rithanya Hospital")}`}
        desc="Credits, debits, operational expenses and monthly payroll disbursements with 12-month retention."
      >
        <div className="flex flex-wrap items-center gap-3">
          <EntityPicker value={data.entity} />
          <Btn onClick={() => openModal("new")}>
            <Plus className="h-5 w-5" /> New Entry
          </Btn>
        </div>
      </PageHeader>

      {/* Month Switcher & Adaptive Year Picker Card */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Year Picker */}
          <div className="flex items-center gap-2">
            <label htmlFor="ledger-year" className="text-sm font-semibold text-ink/75">
              Year:
            </label>
            <select
              id="ledger-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              aria-label="Ledger Year"
              className={`${inputCls} !w-auto font-semibold text-navy`}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y} {y === currentYear ? "(This Year)" : y === currentYear - 1 ? "(Last Year)" : "(Upcoming)"}
                </option>
              ))}
            </select>
          </div>

          {/* Month Switcher Buttons */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Month selection">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(i + 1)}
                aria-pressed={selectedMonth === i + 1}
                className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-all ${
                  selectedMonth === i + 1
                    ? "border-royal bg-royal text-white shadow-xs"
                    : "border-line bg-white text-ink/80 hover:border-royal hover:text-royal"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Month Financial Badges */}
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <span className="rounded-lg border border-line bg-canvas px-3 py-1 text-xs font-semibold text-emerald-700">
              Credits: +{formatINR(monthCredit)}
            </span>
            <span className="rounded-lg border border-line bg-canvas px-3 py-1 text-xs font-semibold text-alert">
              Debits: −{formatINR(monthDebit)}
            </span>
            <span
              className={`rounded-lg border border-line bg-canvas px-3 py-1 text-xs font-bold ${
                monthNet >= 0 ? "text-emerald-700" : "text-alert"
              }`}
            >
              Net: {monthNet >= 0 ? "+" : "−"}
              {formatINR(Math.abs(monthNet))}
            </span>
          </div>
        </div>
      </Card>

      {/* Main Ledger Table Card */}
      <Card>
        {/* Table Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-4">
          {/* Search bar */}
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${MONTHS[selectedMonth - 1]} ${selectedYear} ledger...`}
              aria-label="Search ledger"
              className={`${inputCls} pl-9`}
            />
          </div>

          {/* Right-aligned Buttons: Print ledger & Add Payrolls Entry just above Date column */}
          <div className="flex flex-wrap items-center gap-2.5 ml-auto">
            {/* Add Payrolls Entry */}
            <button
              type="button"
              onClick={handleAddPayrollsEntry}
              disabled={addingPayroll}
              className="inline-flex items-center gap-2 rounded-lg border border-royal/40 bg-royal/10 px-3.5 py-2 text-sm font-semibold text-royal hover:bg-royal/20 active:scale-95 transition-all disabled:opacity-60"
              title="Add a debit entry for all active employee salaries for this month"
            >
              {addingPayroll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              <span>Add Payrolls Entry</span>
            </button>

            {/* Print ledger button */}
            <button
              type="button"
              onClick={handlePrintLedger}
              disabled={printing}
              className="inline-flex items-center gap-2 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-royal/90 active:scale-95 transition-all disabled:opacity-60"
              title="Print the complete ledger with all its items both credit and debit"
            >
              {printing ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Printer className="h-4 w-4 text-white" />
              )}
              <span>Print ledger</span>
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        {shownEntries.length === 0 ? (
          <Empty
            text={
              monthEntries.length === 0
                ? `No ledger entries recorded for ${MONTHS[selectedMonth - 1]} ${selectedYear}. Click "Add Payrolls Entry" or "New Entry" above.`
                : "No matching entries found for this search filter."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[50rem] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wider text-ink/70">
                <tr>
                  <th scope="col" className="px-4 py-3.5 font-bold text-navy">Item Description</th>
                  <th scope="col" className="px-3 py-3.5 font-semibold">Category</th>
                  <th scope="col" className="px-3 py-3.5 font-semibold text-center">Mode</th>
                  <th scope="col" className="px-3 py-3.5 font-semibold text-center">Type</th>
                  <th scope="col" className="px-4 py-3.5 font-semibold text-right">Amount</th>
                  <th scope="col" className="px-4 py-3.5 font-semibold text-right">Date</th>
                  <th scope="col" className="px-4 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shownEntries.map((r) => {
                  const isCredit = r.type === "CREDIT";
                  return (
                    <tr key={r.id} className="hover:bg-canvas/50 transition-colors">
                      {/* Item & Vendor */}
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-navy block text-base leading-tight">
                          {r.itemName}
                        </span>
                        <span className="text-xs text-ink/65 leading-tight">
                          {r.vendorPayee || "—"}
                          {r.description ? ` · ${r.description}` : ""}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="px-3 py-3.5">
                        <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">
                          {r.categoryName || "Uncategorised"}
                        </span>
                      </td>

                      {/* Mode */}
                      <td className="px-3 py-3.5 text-center text-xs font-medium text-ink/75">
                        {r.method || "Cash"}
                      </td>

                      {/* Type Badge */}
                      <td className="px-3 py-3.5 text-center">
                        <Badge tone={isCredit ? "green" : "red"}>{r.type}</Badge>
                      </td>

                      {/* Amount */}
                      <td
                        className={`px-4 py-3.5 text-right font-heading font-bold text-base ${
                          isCredit ? "text-emerald-700" : "text-alert"
                        }`}
                      >
                        {isCredit ? "+" : "−"} {formatINR(r.amount)}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-right text-xs font-medium text-ink/80">
                        {formatDate(r.entryDate)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Btn
                            small
                            variant="secondary"
                            onClick={() => openModal(r)}
                            aria-label={`Edit ${r.itemName}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Btn>
                          <Btn
                            small
                            variant="ghost"
                            disabled={rowBusy === r.id}
                            onClick={() => handleDelete(r.id)}
                            aria-label={`Delete ${r.itemName}`}
                            className="!text-alert hover:!bg-alert/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New / Edit Modal */}
      {editing && (
        <Modal
          size="lg"
          title={editing === "new" ? "New Ledger Entry" : "Edit Ledger Entry"}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Btn variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Btn>
              <Btn onClick={handleSave} disabled={busy}>
                {busy ? "Saving…" : "Save Entry"}
              </Btn>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entity *">
              <select
                className={inputCls}
                value={formData.entity}
                onChange={(e) => setFormData({ ...formData, entity: e.target.value })}
              >
                <option value="RITHANYA_HOSPITAL">Rithanya Hospital</option>
                <option value="RVBC">RVBC (Voluntary Blood Centre)</option>
              </select>
            </Field>

            <Field label="Entry Type *">
              <select
                className={inputCls}
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="DEBIT">Debit (Expense / Outflow)</option>
                <option value="CREDIT">Credit (Income / Inflow)</option>
              </select>
            </Field>

            <Field label="Item Name / Title *" className="sm:col-span-2">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Medical consumables batch, Oxygen refilling"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                required
              />
            </Field>

            <Field label="Vendor / Payee / Beneficiary *" className="sm:col-span-2">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Cipla Pharma, TSSPDCL, Staff Salaries"
                value={formData.vendorPayee}
                onChange={(e) => setFormData({ ...formData, vendorPayee: e.target.value })}
                required
              />
            </Field>

            <Field label="Amount (₹) *">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </Field>

            <Field label="Expense Category">
              <select
                className={inputCls}
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">Uncategorised</option>
                {categoryOpts.map((o: any) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Payment Mode">
              <select
                className={inputCls}
                value={formData.method}
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              >
                <option value="Cash">Cash</option>
                <option value="NEFT">NEFT / Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
              </select>
            </Field>

            <Field label="Entry Date *">
              <input
                type="date"
                className={inputCls}
                value={formData.entryDate}
                onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                required
              />
            </Field>

            <Field label="Notes / Invoice Reference" className="sm:col-span-2">
              <textarea
                rows={3}
                className={inputCls}
                placeholder="Optional invoice number, remarks, or batch notes"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}