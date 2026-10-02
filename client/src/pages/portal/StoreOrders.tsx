import { useEffect } from "react";
import { OrdersDesk } from "@/components/portal/OrdersDesk";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function StoreOrdersPage(){
  const {data,loading,error,reload}=usePortalData<{items:any[]}>("/api/portal/orders");
  useEffect(()=>{document.title="Orders | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;
  return <OrdersDesk orders={data.items as never}/>;
}