import { useEffect } from "react";
import { CollectionManager } from "@/components/portal/CollectionManager";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function StoreProductsPage(){
  const {data,loading,error,reload}=usePortalData<{items:any[]}>("/api/portal/cms/products");
  useEffect(()=>{document.title="Products | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;
  return <CollectionManager collection="products" items={data.items}/>;
}