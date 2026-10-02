import { useEffect } from "react";
import { PatientsManager } from "@/components/portal/PatientsManager";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function OutpatientsPage(){
  const {data,loading,error,reload}=usePortalData<{patients:any[];categories:any[]}>("/api/portal/patients?type=OUTPATIENT");
  useEffect(()=>{document.title="Outpatients | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;
  return <PatientsManager mode="OUTPATIENT" patients={data.patients} cats={data.categories}/>;
}