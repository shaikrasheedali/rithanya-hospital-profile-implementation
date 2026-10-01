import { useEffect } from "react";
import { PatientsManager } from "@/components/portal/PatientsManager";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function DischargedPage(){
  const {data,loading,error}=usePortalData<{patients:any[];categories:any[]}>("/api/portal/patients?discharged=1");
  useEffect(()=>{document.title="Discharged Patients | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error??"Load failed"}/>;
  return <PatientsManager mode="DISCHARGED" patients={data.patients} cats={data.categories}/>;
}