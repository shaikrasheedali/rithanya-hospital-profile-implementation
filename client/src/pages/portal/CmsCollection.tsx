import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { CollectionManager } from "@/components/portal/CollectionManager";
import { COLLECTIONS, type CollectionKey } from "@/lib/collections";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function CmsCollectionPage(){
  const {collection}=useParams();
  const key=(collection as CollectionKey);
  const {data,loading,error,reload}=usePortalData<{items:any[]}>(key?"/api/portal/cms/"+key:"");
  useEffect(()=>{document.title=(COLLECTIONS[key]?.label??"CMS")+" | Rithanya HMS";},[key]);
  if(!key||!(key in COLLECTIONS)) return <div className="rounded-xl border border-line bg-white p-8">Unknown collection.</div>;
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error??"Load failed"}/>;
  return <CollectionManager collection={key} items={data.items} onReload={reload}/>;
}