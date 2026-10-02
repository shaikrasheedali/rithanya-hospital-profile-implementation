import { useEffect } from "react";
import { PageHeader, Card } from "@/components/portal/ui";
import { formatDate } from "@/lib/utils";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function SettingsAuditLogsPage(){
  const {data,loading,error,reload}=usePortalData<{items:any[]}>("/api/portal/audit-logs");
  useEffect(()=>{document.title="Audit Logs | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;
  if (!data.items.length) return (<><PageHeader title="Audit logs" desc="Latest 40 actions. Financial + audit rows older than 1 year are purged nightly." /><Card><p className="p-10 text-center text-base text-ink/65">No audit entries yet.</p></Card></>);
  return (<><PageHeader title="Audit logs" desc="Latest 40 actions. Financial + audit rows older than 1 year are purged nightly." /><Card><div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-left text-base"><thead className="bg-canvas text-sm"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">By</th><th className="px-4 py-3">Details</th></tr></thead><tbody className="divide-y divide-line">{data.items.map((a:any)=><tr key={a.id}><td className="px-4 py-2.5">{formatDate(a.timestamp,true)}</td><td className="px-4 py-2.5 font-semibold">{a.action}</td><td className="px-4 py-2.5">{a.entity}</td><td className="px-4 py-2.5">{a.userName}</td><td className="px-4 py-2.5 text-ink/70">{a.details}</td></tr>)}</tbody></table></div></Card></>);
}