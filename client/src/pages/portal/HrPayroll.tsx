import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PayrollDesk } from "@/components/portal/PayrollDesk";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";

export default function HrPayrollPage() {
  const [sp] = useSearchParams();
  const rawMonth = Number(sp.get("month") ?? (new Date().getMonth() + 1));
  const rawYear = Number(sp.get("year") ?? new Date().getFullYear());
  const month = Number.isFinite(rawMonth) ? Math.min(12, Math.max(1, Math.floor(rawMonth))) : new Date().getMonth() + 1;
  const year = Number.isFinite(rawYear) ? Math.min(2100, Math.max(2000, Math.floor(rawYear))) : new Date().getFullYear();
  const { data, loading, error, reload } = usePortalData<{
    employees: any[];
    records: any[];
    month: number;
    year: number;
    entity: string;
  }>("/api/portal/payroll?month=" + month + "&year=" + year);

  useEffect(() => { document.title = "Payroll | Rithanya HMS"; }, []);
  if (loading) return <LoadingCard />;
  if (error || !data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;

  const emps = data.employees.map((e: any) => ({
    id: e.id,
    fullName: e.fullName,
    designation: e.designation,
    department: e.department,
    base: Number(e.monthlyFixedBaseSalary),
  }));

  const entityLabel = data.entity === "RVBC" ? "RVBC (Voluntary Blood Centre)" : "Rithanya Hospital";

  return (
    <PayrollDesk
      employees={emps}
      records={data.records.map((r: any) => ({
        id: r.id,
        employeeId: r.employeeId,
        lopDays: r.lopDays,
        allowances: Number(r.allowances),
        otherDeductions: Number(r.otherDeductions),
        netPayable: Number(r.netPayable),
        signedAt: r.signedAt,
      }))}
      month={data.month}
      year={data.year}
      entity={data.entity}
      entityLabel={entityLabel}
      authorizer="Authoriser"
    />
  );
}