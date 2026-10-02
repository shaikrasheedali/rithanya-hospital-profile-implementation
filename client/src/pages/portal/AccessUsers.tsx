import { useEffect } from "react";
import { CrudManager } from "@/components/portal/CrudManager";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
export default function AccessUsersPage(){
  const {data,loading,error,reload}=usePortalData<{items:any[]}>("/api/portal/users");
  useEffect(()=>{document.title="Users | Rithanya HMS";},[]);
  if(loading) return <LoadingCard/>;
  if(error||!data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;
  return <CrudManager title="User accounts" desc="Superadmin manages Admins; Admins manage Staff." resource="users" singular="User" rows={data.items} columns={[{key:"fullName",label:"Name",sub:"username"},{key:"email",label:"Email"},{key:"role",label:"Role",kind:"badge",tone:{SUPERADMIN:"purple",ADMIN:"blue",STAFF:"slate"}},{key:"isActive",label:"Status",kind:"bool"}]} fields={[{name:"username",label:"Username",type:"text",required:true,createOnly:true},{name:"email",label:"Email",type:"email",required:true},{name:"fullName",label:"Full name",type:"text",required:true},{name:"role",label:"Role",type:"select",options:[{value:"STAFF",label:"Staff"},{value:"ADMIN",label:"Admin"},{value:"SUPERADMIN",label:"Superadmin"}]},{name:"isActive",label:"Active",type:"checkbox"},{name:"password",label:"Password",type:"password",required:true,help:"Min 8 characters"}]} />;
}