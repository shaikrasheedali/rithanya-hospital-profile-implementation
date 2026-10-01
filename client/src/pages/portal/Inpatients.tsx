import { useEffect } from "react";
import { PatientsManager } from "@/components/portal/PatientsManager";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function InpatientsPage(){
  const {data,loading,error}=usePortalData<{patients:any[];categories:any[]}>("/api/portal/patients?type=INPATIENT");
  useEffect(()=>{document.title="Inpatients | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error??"Load failed"}/>;
  return <PatientsManager mode="INPATIENT" patients={data.patients} cats={data.categories}/>;
}