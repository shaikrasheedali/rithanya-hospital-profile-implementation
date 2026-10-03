"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileText, Loader2, Pencil } from "lucide-react";
import { SIG_H, SIG_W, SignaturePad } from "@/components/portal/SignaturePad";
import { Badge, Btn, Card, Empty, EntityPicker, Field, Modal, PageHeader, api, inputCls, useToast } from "@/components/portal/ui";
import { computeMonthlyPayroll, daysInMonth } from "@/lib/payroll";
import { formatDate, formatINR } from "@/lib/utils";
import { downloadPayslipPdf } from "./PayslipPdf";

type Emp = {
  id: string;
  fullName: string;
  designation: string;
  department: string;
  base: number;
  entity?: string;
};

type Rec = {
  id: string;
  employeeId: string;
  baseSalary?: number;
  calendarDays?: number;
  lopDays: number;
  paidDays?: number;
  lopDeduction?: number;
  allowances: number;
  otherDeductions: number;
  netPayable: number;
  signedAt: string | null;
  authorizerName?: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function PayrollDesk({
  employees,
  records,
  month,
  year,
  entityLabel,
  authorizer,
  entity,
}: {
  employees: Emp[];
  records: Rec[];
  month: number;
  year: number;
  entityLabel: string;
  authorizer: string;
  entity?: string;
}) {
  const toast = useToast();
  const [sel, setSel] = useState<Emp | null>(null);
  const [base, setBase] = useState("0");
  const [lop, setLop] = useState("0");
  const [allow, setAllow] = useState("0");
  const [ded, setDed] = useState("0");
  const [paths, setPaths] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const days = daysInMonth(month, year);
  const recBy = useMemo(() => new Map(records.map((r) => [r.employeeId, r])), [records]);

  // Adaptive year choices: current year - 1, current year, current year + 1
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const list = [currentYear - 1, currentYear, currentYear + 1];
    if (!list.includes(year)) list.push(year);
    return list.sort((a, b) => a - b);
  }, [currentYear, year]);

  const go = (m: number, y: number) => {
    window.location.href = `/portal/hr/payroll?month=${m}&year=${y}`;
  };

  const calc = sel
    ? computeMonthlyPayroll({
        baseSalary: Number(base) || sel.base,
        calendarDays: days,
        lopDays: Number(lop) || 0,
        allowances: Number(allow) || 0,
        otherDeductions: Number(ded) || 0,
      })
    : null;

  // Calculate total net payable for all active employees
  const totalNet = employees.reduce((sum, e) => {
    const r = recBy.get(e.id);
    if (r) return sum + r.netPayable;
    // Default computation if no record yet
    const fallback = computeMonthlyPayroll({
      baseSalary: e.base,
      calendarDays: days,
      lopDays: 0,
      allowances: 0,
      otherDeductions: 0,
    });
    return sum + fallback.netPayable;
  }, 0);

  function openEdit(e: Emp) {
    const r = recBy.get(e.id);
    setSel(e);
    setBase(String(r?.baseSalary ?? e.base));
    setLop(String(r?.lopDays ?? 0));
    setAllow(String(r?.allowances ?? 0));
    setDed(String(r?.otherDeductions ?? 0));
    setPaths([]);
  }

  async function save() {
    if (!sel) return;
    const baseNum = Number(base);
    const lopNum = Number(lop);
    const allowNum = Number(allow);
    const dedNum = Number(ded);

    if (!Number.isFinite(baseNum) || baseNum < 0) {
      toast("Base salary must be a valid positive amount.", "err");
      return;
    }
    if (!Number.isFinite(lopNum) || lopNum < 0 || lopNum > days) {
      toast(`LOP days must be between 0 and ${days}.`, "err");
      return;
    }
    if (!Number.isFinite(allowNum) || allowNum < 0) {
      toast("Allowances must be 0 or more.", "err");
      return;
    }
    if (!Number.isFinite(dedNum) || dedNum < 0) {
      toast("Other deductions must be 0 or more.", "err");
      return;
    }

    setBusy(true);
    const r = await api(`/api/portal/r/payroll`, "POST", {
      employeeId: sel.id,
      month,
      year,
      baseSalary: baseNum,
      lopDays: lopNum,
      allowances: allowNum,
      otherDeductions: dedNum,
      signaturePaths: paths,
      signatureWidth: SIG_W,
      signatureHeight: SIG_H,
    });
    setBusy(false);

    if (!r.ok) {
      return toast(r.error || "Could not process payroll — please try again.", "err");
    }

    toast(paths.length ? "Payroll updated & digitally signed" : "Payroll updated successfully");
    setSel(null);
    setTimeout(() => window.location.reload(), 800);
  }

  async function handleDownloadPayslip(e: Emp) {
    const r = recBy.get(e.id);
    const activeBase = r?.baseSalary ?? e.base;
    const activeLop = r?.lopDays ?? 0;
    const activeAllow = r?.allowances ?? 0;
    const activeDed = r?.otherDeductions ?? 0;

    const computed = computeMonthlyPayroll({
      baseSalary: activeBase,
      calendarDays: days,
      lopDays: activeLop,
      allowances: activeAllow,
      otherDeductions: activeDed,
    });

    setDownloadingId(e.id);
    try {
      await downloadPayslipPdf({
        employee: {
          fullName: e.fullName,
          designation: e.designation,
          department: e.department,
          entity: entity || e.entity,
        },
        baseSalary: computed.baseSalary,
        calendarDays: computed.calendarDays,
        lopDays: computed.lopDays,
        paidDays: computed.paidDays,
        lopDeduction: computed.lopDeduction,
        allowances: computed.allowances,
        otherDeductions: computed.otherDeductions,
        netPayable: computed.netPayable,
        monthName: MONTHS[month - 1],
        year,
        entityLabel,
        authorizerName: r?.authorizerName || authorizer,
        signedAt: r?.signedAt,
      });
      toast(`Payslip downloaded for ${e.fullName}`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast("Failed to generate payslip PDF. Please try again.", "err");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title={`Payroll Desk — ${entityLabel}`}
        desc="Net payable = (Base − LOP deduction) + Allowances − Other deductions. LOP deduction = (Base ÷ calendar days) × LOP days."
      >
        <div className="flex flex-wrap items-center gap-4">
          <EntityPicker value={entity} />
          <div className="rounded-xl border border-line bg-canvas px-3.5 py-1.5 text-base">
            <span className="text-ink/70">Disbursement Total: </span>
            <strong className="font-heading text-lg font-bold text-royal">{formatINR(totalNet)}</strong>
          </div>
        </div>
      </PageHeader>

      {/* Adaptive Year Picker and Month Selector */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="year-select" className="text-sm font-semibold text-ink/75">
              Year:
            </label>
            <select
              id="year-select"
              value={year}
              onChange={(e) => go(month, Number(e.target.value))}
              aria-label="Payroll Year"
              className={`${inputCls} !w-auto font-semibold text-navy`}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y} {y === currentYear ? "(This Year)" : y === currentYear - 1 ? "(Last Year)" : "(Upcoming)"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Month">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                onClick={() => go(i + 1, year)}
                aria-pressed={month === i + 1}
                className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-all ${
                  month === i + 1
                    ? "border-royal bg-royal text-white shadow-xs"
                    : "border-line bg-white text-ink/80 hover:border-royal hover:text-royal"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 text-sm text-ink/70">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>{days} Calendar Days in {MONTHS[month - 1]} {year}</span>
          </div>
        </div>
      </Card>

      {/* Employees Payroll Table */}
      <Card>
        {employees.length === 0 ? (
          <Empty text="No active employees found for this entity. Add or enable them under HR → Employees." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wider text-ink/70">
                <tr>
                  <th scope="col" className="px-4 py-3.5 font-bold text-navy">Staff Member</th>
                  <th scope="col" className="px-3 py-3.5 font-semibold text-right">Base Salary</th>
                  <th scope="col" className="px-3 py-3.5 font-semibold text-center">Cal. Days</th>
                  <th scope="col" className="px-3 py-3.5 font-semibold text-center">LOP Days</th>
                  <th scope="col" className="px-3 py-3.5 font-semibold text-center">Paid Days</th>
                  <th scope="col" className="px-3 py-3.5 font-semibold text-right">LOP Deduct.</th>
                  <th scope="col" className="px-3 py-3.5 font-semibold text-right">Allowances</th>
                  <th scope="col" className="px-3 py-3.5 font-semibold text-right">Other Ded.</th>
                  <th scope="col" className="px-4 py-3.5 font-bold text-navy text-right">Net Payable</th>
                  <th scope="col" className="px-4 py-3.5 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {employees.map((e) => {
                  const r = recBy.get(e.id);
                  const activeBase = r?.baseSalary ?? e.base;
                  const activeLop = r?.lopDays ?? 0;
                  const activeAllow = r?.allowances ?? 0;
                  const activeDed = r?.otherDeductions ?? 0;

                  const computed = computeMonthlyPayroll({
                    baseSalary: activeBase,
                    calendarDays: days,
                    lopDays: activeLop,
                    allowances: activeAllow,
                    otherDeductions: activeDed,
                  });

                  return (
                    <tr key={e.id} className="hover:bg-canvas/50 transition-colors">
                      {/* Staff Member */}
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-navy block text-base leading-tight">
                          {e.fullName}
                        </span>
                        <span className="text-xs text-ink/65 leading-tight">
                          {e.designation} · {e.department}
                        </span>
                      </td>

                      {/* Base Salary */}
                      <td className="px-3 py-3.5 text-right font-medium">
                        {formatINR(computed.baseSalary)}
                      </td>

                      {/* Cal. Days */}
                      <td className="px-3 py-3.5 text-center text-ink/75">
                        {computed.calendarDays} d
                      </td>

                      {/* LOP Days */}
                      <td className="px-3 py-3.5 text-center">
                        <span className={computed.lopDays > 0 ? "font-semibold text-alert" : "text-ink/65"}>
                          {computed.lopDays} d
                        </span>
                      </td>

                      {/* Paid Days */}
                      <td className="px-3 py-3.5 text-center font-medium text-emerald-700">
                        {computed.paidDays} d
                      </td>

                      {/* LOP Deduct */}
                      <td className="px-3 py-3.5 text-right">
                        <span className={computed.lopDeduction > 0 ? "text-alert font-medium" : "text-ink/60"}>
                          {computed.lopDeduction > 0 ? `− ${formatINR(computed.lopDeduction)}` : "₹0"}
                        </span>
                      </td>

                      {/* Allowances */}
                      <td className="px-3 py-3.5 text-right">
                        <span className={computed.allowances > 0 ? "text-emerald-700 font-medium" : "text-ink/60"}>
                          {computed.allowances > 0 ? `+ ${formatINR(computed.allowances)}` : "₹0"}
                        </span>
                      </td>

                      {/* Other Ded */}
                      <td className="px-3 py-3.5 text-right">
                        <span className={computed.otherDeductions > 0 ? "text-alert font-medium" : "text-ink/60"}>
                          {computed.otherDeductions > 0 ? `− ${formatINR(computed.otherDeductions)}` : "₹0"}
                        </span>
                      </td>

                      {/* Net Payable */}
                      <td className="px-4 py-3.5 text-right font-heading font-bold text-royal text-base">
                        {formatINR(computed.netPayable)}
                      </td>

                      {/* Actions: Edit & Payslip */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <Btn
                            small
                            variant="secondary"
                            onClick={() => openEdit(e)}
                            aria-label={`Edit payroll for ${e.fullName}`}
                            className="hover:border-royal hover:text-royal"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </Btn>

                          <button
                            type="button"
                            onClick={() => handleDownloadPayslip(e)}
                            disabled={downloadingId === e.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gold/90 px-3 py-1.5 text-xs font-semibold text-navy shadow-2xs hover:bg-yellow-400 active:scale-95 transition-all disabled:opacity-60"
                            title="Download Official Payslip PDF"
                          >
                            {downloadingId === e.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 text-navy" />
                            )}
                            <span>Payslip</span>
                          </button>
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

      {/* Edit Payroll Modal */}
      {sel && calc && (
        <Modal
          size="lg"
          title={`Adjust Payroll — ${sel.fullName} (${MONTHS[month - 1]} ${year})`}
          onClose={() => setSel(null)}
          footer={
            <>
              <Btn variant="secondary" onClick={() => setSel(null)}>
                Cancel
              </Btn>
              <Btn onClick={save} disabled={busy}>
                <CheckCircle2 className="h-5 w-5" />
                {busy ? "Saving…" : "Save & Update Payroll"}
              </Btn>
            </>
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Input form */}
            <div className="space-y-4">
              <Field label="Base Salary (₹)" help="Monthly fixed basic pay for this employee">
                <input
                  type="number"
                  min={0}
                  step="1"
                  className={inputCls}
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                />
              </Field>

              <Field
                label={`Loss of Pay (LOP) Days (0 – ${days})`}
                help={`Calendar days: ${days}. Paid days will be: ${days - (Number(lop) || 0)}`}
              >
                <input
                  type="number"
                  min={0}
                  max={days}
                  className={inputCls}
                  value={lop}
                  onChange={(e) => setLop(e.target.value)}
                />
              </Field>

              <Field label="Allowances (₹)" help="Clinical bonuses, duty allowances, overtime">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputCls}
                  value={allow}
                  onChange={(e) => setAllow(e.target.value)}
                />
              </Field>

              <Field label="Other Deductions (₹)" help="Statutory deductions, salary advances, penalties">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputCls}
                  value={ded}
                  onChange={(e) => setDed(e.target.value)}
                />
              </Field>

              <div className="pt-2">
                <span className="mb-1 block text-sm font-semibold text-navy">
                  Authoriser Digital Sign-off (Optional) — {authorizer}
                </span>
                <SignaturePad onChange={setPaths} />
              </div>
            </div>

            {/* Live Calculation Preview Card */}
            <div className="flex flex-col justify-between rounded-xl border border-line bg-canvas p-5 text-sm">
              <div>
                <h4 className="font-heading text-base font-bold text-navy mb-3 pb-2 border-b border-line">
                  Live Calculation Summary
                </h4>
                <dl className="space-y-2.5">
                  <div className="flex justify-between">
                    <dt className="text-ink/75">Monthly Base Salary</dt>
                    <dd className="font-semibold text-navy">{formatINR(calc.baseSalary)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink/75">Calendar / Paid Days</dt>
                    <dd className="font-semibold text-ink">
                      {calc.calendarDays} d / <span className="text-emerald-700">{calc.paidDays} d</span>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink/75">Per-Day Rate</dt>
                    <dd className="font-semibold text-ink/80">{formatINR(calc.perDaySalary)} / d</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink/75">LOP Deduction ({calc.lopDays} d)</dt>
                    <dd className="font-semibold text-alert">
                      − {formatINR(calc.lopDeduction)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink/75">Allowances</dt>
                    <dd className="font-semibold text-emerald-700">+ {formatINR(calc.allowances)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink/75">Other Deductions</dt>
                    <dd className="font-semibold text-alert">− {formatINR(calc.otherDeductions)}</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-6 rounded-lg border border-royal/30 bg-blue-50/70 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs uppercase font-bold tracking-wider text-royal">
                      Calculated Net Payable
                    </span>
                    <span className="text-xs text-ink/65">Disbursement ready</span>
                  </div>
                  <span className="font-heading text-2xl font-bold text-royal">
                    {formatINR(calc.netPayable)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
