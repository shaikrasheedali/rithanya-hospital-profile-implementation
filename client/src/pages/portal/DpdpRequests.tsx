import { useEffect } from "react";
import { DpdpDesk } from "@/components/portal/DpdpDesk";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function DpdpRequestsPage(){
  const {data,loading,error,reload}=usePortalData<{items:any[]}>("/api/portal/dpdp-requests");
  useEffect(()=>{document.title="DPDP Requests | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;
  return <DpdpDesk rows={data.items as never}/>;
}