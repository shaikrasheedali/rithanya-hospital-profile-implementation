import { useEffect } from "react";
import { CrudManager } from "@/components/portal/CrudManager";
import { EntityPicker } from "@/components/portal/ui";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";

export default function HrEmployeesPage() {
  const { data, loading, error } = usePortalData<{ items: any[]; entity: string }>("/api/portal/employees");
  useEffect(() => { document.title = "Employees | Rithanya HMS"; }, []);
  if (loading) return <LoadingCard />;
  if (error || !data) return <ErrorCard error={error ?? "Load failed"} />;

  const entityName = data.entity === "RVBC" ? "RVBC (Voluntary Blood Centre)" : "Rithanya Hospital";

  return (
    <CrudManager
      title="Employees"
      desc={`Active roster for ${entityName}.`}
      headerNote={<EntityPicker value={data.entity} />}
      resource="employees"
      singular="Employee"
      rows={data.items}
      defaults={{ entity: data.entity, isActive: true, shiftSchedule: "General" }}
      columns={[
        { key: "fullName", label: "Employee", sub: "designation" },
        { key: "department", label: "Department" },
        { key: "shiftSchedule", label: "Shift" },
        { key: "monthlyFixedBaseSalary", label: "Base", kind: "money" },
        { key: "isActive", label: "Status", kind: "bool" },
      ]}
      fields={[
        {
          name: "entity",
          label: "Entity",
          type: "select",
          options: [
            { value: "RITHANYA_HOSPITAL", label: "Rithanya Hospital" },
            { value: "RVBC", label: "RVBC" },
          ],
        },
        { name: "fullName", label: "Full name", type: "text", required: true },
        { name: "designation", label: "Designation", type: "text", required: true },
        { name: "department", label: "Department", type: "text", required: true },
        { name: "shiftSchedule", label: "Shift", type: "text" },
        { name: "contactNumber", label: "Contact", type: "text" },
        { name: "monthlyFixedBaseSalary", label: "Base salary", type: "number", required: true },
        { name: "isActive", label: "Active", type: "checkbox" },
      ]}
      rowActions={[{ label: "Toggle", action: "toggle" }]}
    />
  );
}