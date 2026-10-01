import { useEffect } from "react";
import { CrudManager } from "@/components/portal/CrudManager";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function DiagnosisCategoriesPage(){
  const {data,loading,error}=usePortalData<{items:any[]}>("/api/portal/r/categories");
  useEffect(()=>{document.title="Diagnosis Categories | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error??"Load failed"}/>;
  return <CrudManager title="Diagnosis categories" desc="Clinical buckets used across EMR records." resource="categories" singular="Category" rows={data.items} columns={[{key:"name",label:"Category"},{key:"description",label:"Notes"},{key:"patientCount",label:"Patients"}]} fields={[{name:"name",label:"Category name",type:"text",required:true},{name:"description",label:"Notes",type:"textarea"}]} searchPlaceholder="Search categories…" />;
}