import { useEffect } from "react";
import { BloodBankManager } from "@/components/portal/BloodBankManager";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function BloodBankPage(){
  const {data,loading,error}=usePortalData<{stock:any[];threshold:number}>("/api/portal/blood-stock");
  useEffect(()=>{document.title="Blood Bank | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error??"Load failed"}/>;
  return <BloodBankManager initial={data.stock} threshold={data.threshold}/>;
}