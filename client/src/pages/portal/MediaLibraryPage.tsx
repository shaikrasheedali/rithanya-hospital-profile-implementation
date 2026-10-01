import { useEffect } from "react";
import { MediaLibrary } from "@/components/portal/MediaLibrary";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function MediaLibraryPage(){
  const {data,loading,error}=usePortalData<{assets:any[]}>("/api/portal/media");
  useEffect(()=>{document.title="Media Library | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error??"Load failed"}/>;
  return <MediaLibrary assets={data.assets}/>;
}