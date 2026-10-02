import { useEffect } from "react";
import { PermissionsMatrix } from "@/components/portal/PermissionsMatrix";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function AccessPermissionsPage(){
  const {data,loading,error,reload}=usePortalData<{items:any[]}>("/api/portal/permissions");
  useEffect(()=>{document.title="Permissions | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;
  return <PermissionsMatrix users={data.items as never}/>;
}