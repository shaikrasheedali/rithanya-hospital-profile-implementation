import { useEffect } from "react";
import { SeoSettingsForm } from "@/components/portal/SettingsForms";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function SettingsSeoPage(){
  const {data,loading,error,reload}=usePortalData<{settings:any}>("/api/portal/settings");
  useEffect(()=>{document.title="SEO & Social | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;
  return <SeoSettingsForm s={data.settings}/>;
}