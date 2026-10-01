import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { PrintButton } from "@/components/portal/PrintButton";
import { formatDate, formatINR } from "@/lib/utils";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function PayslipPage(){
  const {id}=useParams();
  const {data,loading,error}=usePortalData<{record:any;settings:any}>("/api/portal/payslip/"+id);
  useEffect(()=>{document.title="Payslip | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error??"Load failed"}/>;
  const r = data.record;
  const legalName = r.employee?.entity === "RVBC" ? "RVBC (Voluntary Blood Centre)" : data.settings.legalName;
  return (
    <div>
      <div className="no-print mb-4"><PrintButton/></div>
      <div className="print-area mx-auto max-w-2xl rounded-xl border border-line bg-white p-8 shadow">
        <h1 className="text-2xl font-semibold">{legalName} — Payslip</h1>
        <p className="text-ink/70">{r.employee.fullName} · {r.month}/{r.year}</p>
        <dl className="mt-6 space-y-2">
          {[
            ["Base salary", formatINR(r.baseSalary)],
            ["LOP deduction", formatINR(r.lopDeduction)],
            ["Allowances", formatINR(r.allowances)],
            ["Other deductions", formatINR(r.otherDeductions)],
            ["Net payable", formatINR(r.netPayable)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-line py-2">
              <dt>{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {r.authorizerSignSvg && (
          <div className="mt-6">
            <p className="text-sm font-semibold">Authorised by {r.authorizerName} on {formatDate(r.signedAt, true)}</p>
            <div dangerouslySetInnerHTML={{ __html: r.authorizerSignSvg }} />
          </div>
        )}
      </div>
    </div>
  );
}