import { useEffect } from "react";
import { MasterSettingsForm } from "@/components/portal/SettingsForms";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function SettingsMasterPage(){
  const {data,loading,error}=usePortalData<{settings:any}>("/api/portal/settings");
  useEffect(()=>{document.title="Master Identity | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error??"Load failed"}/>;
  return <MasterSettingsForm s={data.settings}/>;
}