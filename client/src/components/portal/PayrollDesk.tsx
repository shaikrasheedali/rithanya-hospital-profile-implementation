"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileText, PenLine } from "lucide-react";
import { SIG_H, SIG_W, SignaturePad } from "@/components/portal/SignaturePad";
import { Badge, Btn, Card, Empty, EntityPicker, Field, Modal, PageHeader, api, inputCls, useToast } from "@/components/portal/ui";
import { computeMonthlyPayroll, daysInMonth } from "@/lib/payroll";
import { formatDate, formatINR } from "@/lib/utils";

type Emp = { id: string; fullName: string; designation: string; department: string; base: number };
type Rec = { id: string; employeeId: string; lopDays: number; allowances: number; otherDeductions: number; netPayable: number; signedAt: string | null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function PayrollDesk({ employees, records, month, year, entityLabel, authorizer, entity }: { employees: Emp[]; records: Rec[]; month: number; year: number; entityLabel: string; authorizer: string; entity?: string }) {
  const toast = useToast();
  const [sel, setSel] = useState<Emp | null>(null);
  const [lop, setLop] = useState("0");
  const [allow, setAllow] = useState("0");
  const [ded, setDed] = useState("0");
  const [paths, setPaths] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const days = daysInMonth(month, year);
  const recBy = useMemo(() => new Map(records.map((r) => [r.employeeId, r])), [records]);
  const go = (m: number, y: number) => window.location.href = `/portal/hr/payroll?month=${m}&year=${y}`;

  const calc = sel ? computeMonthlyPayroll({ baseSalary: sel.base, calendarDays: days, lopDays: Number(lop) || 0, allowances: Number(allow) || 0, otherDeductions: Number(ded) || 0 }) : null;
  const totalNet = employees.reduce((n, e) => n + (recBy.get(e.id)?.netPayable ?? 0), 0);

  function openFor(e: Emp) {
    const r = recBy.get(e.id);
    setSel(e);
    setLop(String(r?.lopDays ?? 0));
    setAllow(String(r?.allowances ?? 0));
    setDed(String(r?.otherDeductions ?? 0));
    setPaths([]);
  }

  async function save() {
    if (!sel) return;
    setBusy(true);
    const r = await api(`/api/portal/r/payroll`, "POST", { employeeId: sel.id, month, year, lopDays: lop, allowances: allow, otherDeductions: ded, signaturePaths: paths, signatureWidth: SIG_W, signatureHeight: SIG_H });
    setBusy(false);
    if (!r.ok) return toast(r.error || "Could not process payroll", "err");
    toast(paths.length ? "Payroll processed & signed" : "Payroll processed (unsigned)");
    setSel(null);
    window.location.reload();
  }

  return (
    <>
      <PageHeader title={`Payroll — ${entityLabel}`} desc="Net payable = (Base − LOP deduction) + Allowances − Other deductions. LOP deduction = (Base ÷ calendar days) × LOP days.">
        <div className="flex flex-wrap items-center gap-4">
          <EntityPicker value={entity} />
          <p className="text-base text-ink/70">Processed total: <strong className="text-navy">{formatINR(totalNet)}</strong></p>
        </div>
      </PageHeader>

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={year} onChange={(e) => go(month, Number(e.target.value))} aria-label="Year" className={`${inputCls} !w-auto`}>{[year - 1, year, year + 1].filter((y, i, a) => a.indexOf(y) === i).map((y) => <option key={y}>{y}</option>)}</select>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Month">
            {MONTHS.map((m, i) => <button key={m} onClick={() => go(i + 1, year)} aria-pressed={month === i + 1} className={`rounded-lg border px-3.5 py-2 font-semibold ${month === i + 1 ? "border-royal bg-royal text-white" : "border-line bg-white hover:border-royal"}`}>{m}</button>)}
          </div>
          <span className="ml-auto text-base text-ink/70">{days} calendar days</span>
        </div>
      </Card>

      <Card>
        {employees.length === 0 ? <Empty text="No active employees for this entity. Add them under HR → Employees." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-base">
              <thead className="bg-canvas text-sm text-ink/70"><tr>{["Employee", "Base salary", "LOP", "Allowances", "Deductions", "Net payable", "Status", ""].map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {employees.map((e) => {
                  const r = recBy.get(e.id);
                  return (
                    <tr key={e.id}>
                      <td className="px-4 py-3"><span className="font-semibold text-navy">{e.fullName}</span><span className="block text-sm text-ink/65">{e.designation} · {e.department}</span></td>
                      <td className="px-4 py-3">{formatINR(e.base)}</td>
                      <td className="px-4 py-3">{r ? `${r.lopDays} d` : "—"}</td>
                      <td className="px-4 py-3">{r ? formatINR(r.allowances) : "—"}</td>
                      <td className="px-4 py-3">{r ? formatINR(r.otherDeductions) : "—"}</td>
                      <td className="px-4 py-3 font-heading font-bold text-navy">{r ? formatINR(r.netPayable) : "—"}</td>
                      <td className="px-4 py-3">{r ? <Badge tone={r.signedAt ? "green" : "amber"}>{r.signedAt ? `Signed ${formatDate(r.signedAt)}` : "Unsigned"}</Badge> : <Badge>Pending</Badge>}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Btn small variant={r ? "secondary" : "primary"} onClick={() => openFor(e)}><PenLine className="h-4 w-4" /> {r ? "Revise" : "Process"}</Btn>
                          {r && <a href={`/portal/hr/payslip/${r.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-navy hover:bg-yellow-300"><FileText className="h-4 w-4" /> Payslip</a>}
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

      {sel && calc && (
        <Modal
          size="lg"
          title={`${sel.fullName} — ${MONTHS[month - 1]} ${year}`}
          onClose={() => setSel(null)}
          footer={<><Btn variant="secondary" onClick={() => setSel(null)}>Cancel</Btn><Btn onClick={save} disabled={busy}><CheckCircle2 className="h-5 w-5" /> {busy ? "Processing…" : "Process & sign off"}</Btn></>}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <Field label={`LOP days (0 – ${days})`}><input type="number" min={0} max={days} className={inputCls} value={lop} onChange={(e) => setLop(e.target.value)} /></Field>
              <Field label="Allowances (₹)"><input type="number" min={0} step="0.01" className={inputCls} value={allow} onChange={(e) => setAllow(e.target.value)} /></Field>
              <Field label="Other deductions (₹)"><input type="number" min={0} step="0.01" className={inputCls} value={ded} onChange={(e) => setDed(e.target.value)} /></Field>
              <div>
                <span className="mb-1 block text-sm font-semibold text-navy">Authoriser signature — {authorizer}</span>
                <SignaturePad onChange={setPaths} />
              </div>
            </div>
            <dl className="space-y-2.5 rounded-xl border border-line bg-canvas p-5 text-base">
              {[["Monthly fixed base", formatINR(calc.baseSalary)], ["Per-day salary", formatINR(calc.perDaySalary)], ["Calendar / paid days", `${calc.calendarDays} / ${calc.paidDays}`], ["LOP deduction", `− ${formatINR(calc.lopDeduction)}`], ["Allowances", `+ ${formatINR(calc.allowances)}`], ["Other deductions", `− ${formatINR(calc.otherDeductions)}`]].map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-ink/75">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
              <div className="flex justify-between border-t border-line pt-3 text-xl"><dt className="font-semibold text-navy">Net payable</dt><dd className="font-heading font-bold text-royal">{formatINR(calc.netPayable)}</dd></div>
            </dl>
          </div>
        </Modal>
      )}
    </>
  );
}
