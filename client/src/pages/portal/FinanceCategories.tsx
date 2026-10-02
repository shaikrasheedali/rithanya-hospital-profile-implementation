import { useEffect } from "react";
import { CrudManager } from "@/components/portal/CrudManager";
import { EntityPicker } from "@/components/portal/ui";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";

export default function FinanceCategoriesPage() {
  const { data, loading, error } = usePortalData<{
    items: any[];
    entity: string;
    entityLabel: string;
  }>("/api/portal/expense-categories");

  useEffect(() => {
    document.title = "Categories | Rithanya HMS";
  }, []);

  if (loading) return <LoadingCard />;
  if (error || !data) return <ErrorCard error={error ?? "Load failed"} />;

  return (
    <CrudManager
      title={`Expense categories — ${data.entityLabel || (data.entity === "RVBC" ? "RVBC" : "Rithanya Hospital")}`}
      resource="expense-categories"
      singular="Category"
      rows={data.items}
      headerNote={<EntityPicker value={data.entity} />}
      defaults={{ entity: data.entity }}
      columns={[
        { key: "name", label: "Category" },
        { key: "description", label: "Notes" },
      ]}
      fields={[
        {
          name: "entity",
          label: "Entity",
          type: "select",
          options: [
            { value: "RITHANYA_HOSPITAL", label: "Rithanya Hospital" },
            { value: "RVBC", label: "RVBC (Voluntary Blood Centre)" },
          ],
        },
        { name: "name", label: "Category name", type: "text", required: true },
        { name: "description", label: "Notes", type: "textarea" },
      ]}
    />
  );
}