import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { CollectionManager } from "@/components/portal/CollectionManager";
import { COLLECTIONS, type CollectionKey } from "@/lib/collections";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function CmsCollectionPage(){
  const {collection}=useParams();
  const key=(collection as CollectionKey);
  const validKey = key && (key in COLLECTIONS) ? key : null;
  const {data,loading,error,reload}=usePortalData<{items:any[]}>(validKey?"/api/portal/cms/"+validKey:"");
  useEffect(()=>{document.title=(COLLECTIONS[key]?.label??"CMS")+" | Rithanya HMS";},[key]);
  if(!validKey) return <div className="rounded-xl border border-line bg-white p-8">Unknown collection.</div>;
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;
  return <CollectionManager collection={validKey} items={data.items} onReload={reload}/>;
}