import { useEffect } from "react";
import { CrudManager } from "@/components/portal/CrudManager";
import { EntityPicker } from "@/components/portal/ui";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";

export default function FinanceLedgerPage() {
  const { data, loading, error } = usePortalData<{
    items: any[];
    categories: any[];
    entity: string;
    entityLabel: string;
  }>("/api/portal/ledger");

  useEffect(() => {
    document.title = "Ledger | Rithanya HMS";
  }, []);

  if (loading) return <LoadingCard />;
  if (error || !data) return <ErrorCard error={error ?? "Load failed"} />;

  const opts = data.categories.map((c: any) => ({ value: c.id, label: c.name }));

  return (
    <CrudManager
      title={`Finance ledger — ${data.entityLabel || (data.entity === "RVBC" ? "RVBC" : "Rithanya Hospital")}`}
      desc="Credits and debits with category linkage."
      resource="ledger"
      singular="Entry"
      rows={data.items}
      headerNote={<EntityPicker value={data.entity} />}
      defaults={{ entity: data.entity, type: "DEBIT", method: "Cash" }}
      columns={[
        { key: "itemName", label: "Item", sub: "vendorPayee" },
        { key: "type", label: "Type", kind: "badge", tone: { CREDIT: "green", DEBIT: "red" } },
        { key: "amount", label: "Amount", kind: "money", creditDebit: true },
        { key: "categoryName", label: "Category" },
        { key: "entryDate", label: "Date", kind: "date" },
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
        { name: "type", label: "Type", type: "select", options: [{ value: "DEBIT", label: "Debit" }, { value: "CREDIT", label: "Credit" }] },
        { name: "itemName", label: "Item name", type: "text", required: true },
        { name: "vendorPayee", label: "Vendor / payee", type: "text", required: true },
        { name: "amount", label: "Amount", type: "number", required: true },
        { name: "categoryId", label: "Category", type: "select", options: [{ value: "", label: "Uncategorised" }, ...opts] },
        { name: "method", label: "Mode", type: "select", options: [{ value: "Cash", label: "Cash" }, { value: "UPI", label: "UPI" }, { value: "NEFT", label: "NEFT" }, { value: "Cheque", label: "Cheque" }] },
        { name: "entryDate", label: "Entry date", type: "date" },
        { name: "description", label: "Notes", type: "textarea" },
      ]}
    />
  );
}