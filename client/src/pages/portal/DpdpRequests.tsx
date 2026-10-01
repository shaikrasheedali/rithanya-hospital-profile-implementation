import { useEffect } from "react";
import { DpdpDesk } from "@/components/portal/DpdpDesk";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function DpdpRequestsPage(){
  const {data,loading,error}=usePortalData<{items:any[]}>("/api/portal/dpdp-requests");
  useEffect(()=>{document.title="DPDP Requests | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error??"Load failed"}/>;
  return <DpdpDesk rows={data.items as never}/>;
}