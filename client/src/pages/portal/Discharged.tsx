import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PatientsManager } from "@/components/portal/PatientsManager";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function DischargedPage(){
  const [params] = useSearchParams();
  const archived = params.get("archived") === "1";
  const {data,loading,error,reload}=usePortalData<{patients:any[];categories:any[]}>(`/api/portal/patients?discharged=1${archived ? "&archived=1" : ""}`);
  useEffect(()=>{document.title="Discharged Patients | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;
  return <PatientsManager mode="DISCHARGED" patients={data.patients} cats={data.categories} showArchived={archived}/>;
}