"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { Badge, Btn, Card, Empty, Field, Modal, PageHeader, api, inputCls, useToast } from "@/components/portal/ui";
import { formatDate, formatINR } from "@/lib/utils";

type Row = Record<string, unknown> & { id: string };
export type CrudCol = {
  key: string;
  label: string;
  kind?: "text" | "money" | "date" | "datetime" | "bool" | "badge";
  tone?: Record<string, "slate" | "green" | "red" | "blue" | "amber" | "purple">;
  sub?: string;
  creditDebit?: boolean;
};
export type CrudField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox" | "date" | "password" | "email";
  options?: { value: string; label: string }[];
  required?: boolean;
  half?: boolean;
  help?: string;
  createOnly?: boolean;
  step?: string;
};

function toInput(f: CrudField, v: unknown): unknown {
  if (f.type === "date") {
    if (!v) return new Date().toISOString().slice(0, 10);
    const t = new Date(v as string);
    if (Number.isNaN(t.getTime())) return new Date().toISOString().slice(0, 10);
    return t.toISOString().slice(0, 10);
  }
  if (f.type === "checkbox") return v === undefined ? true : Boolean(v);
  if (f.type === "password") return "";
  return v ?? (f.type === "select" ? f.options?.[0]?.value ?? "" : "");
}

export function CrudManager({
  title,
  desc,
  resource,
  singular,
  rows,
  columns,
  fields,
  defaults = {},
  rowActions = [],
  canDelete = true,
  lockedIds = [],
  searchPlaceholder = "Search…",
  addLabel,
  headerNote,
}: {
  title: string;
  desc?: string;
  resource: string;
  singular: string;
  rows: Row[];
  columns: CrudCol[];
  fields: CrudField[];
  defaults?: Record<string, unknown>;
  rowActions?: { label: string; action: string }[];
  canDelete?: boolean | string[];
  lockedIds?: string[];
  searchPlaceholder?: string;
  addLabel?: string;
  headerNote?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [v, setV] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const shown = useMemo(() => rows.filter((r) => !q || JSON.stringify(Object.values(r)).toLowerCase().includes(q.toLowerCase())), [rows, q]);

  function open(row: Row | "new") {
    const init: Record<string, unknown> = {};
    for (const f of fields) init[f.name] = toInput(f, row === "new" ? defaults[f.name] : row[f.name]);
    setV(init);
    setEditing(row);
  }

  async function save() {
    setBusy(true);
    const body: Record<string, unknown> = { ...defaults, ...v };
    for (const f of fields) if (f.type === "password" && !body[f.name]) delete body[f.name];
    const r = editing === "new" ? await api(`/api/portal/r/${resource}`, "POST", body) : await api(`/api/portal/r/${resource}/${(editing as Row).id}`, "PUT", body);
    setBusy(false);
    if (!r.ok) return toast(r.error || "Save failed — please try again.", "err");
    toast(`${singular} saved`);
    setEditing(null);
    setTimeout(() => window.location.reload(), 1200);
  }
  async function del(row: Row) {
    if (!confirm(`Delete this ${singular.toLowerCase()}? This cannot be undone.`)) return;
    setRowBusy(row.id);
    const r = await api(`/api/portal/r/${resource}/${row.id}`, "DELETE");
    setRowBusy(null);
    if (!r.ok) return toast(r.error || "Delete failed — please try again.", "err");
    toast(`${singular} deleted`);
    setTimeout(() => window.location.reload(), 1200);
  }
  async function act(row: Row, action: string) {
    if (rowBusy) return;
    setRowBusy(`${row.id}:${action}`);
    const r = await api(`/api/portal/r/${resource}/${row.id}`, "POST", { action });
    setRowBusy(null);
    if (!r.ok) return toast(r.error || "Action failed — please try again.", "err");
    toast("Updated");
    setTimeout(() => window.location.reload(), 1200);
  }

  function cell(c: CrudCol, r: Row) {
    const val = r[c.key];
    switch (c.kind) {
      case "money":
        return <span className={`font-semibold ${c.creditDebit ? (r.type === "CREDIT" ? "text-emerald-700" : "text-alert") : ""}`}>{c.creditDebit ? (r.type === "CREDIT" ? "+" : "−") : ""}{formatINR(String(val ?? 0))}</span>;
      case "date":
        return formatDate(val as string);
      case "datetime":
        return formatDate(val as string, true);
      case "bool":
        return val ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>;
      case "badge":
        return <Badge tone={c.tone?.[String(val)] ?? "slate"}>{String(val ?? "—").replace(/_/g, " ")}</Badge>;
      default:
        return (
          <>
            <span className="font-medium text-navy">{String(val ?? "—")}</span>
            {c.sub && r[c.sub] ? <span className="block text-sm text-ink/65">{String(r[c.sub])}</span> : null}
          </>
        );
    }
  }

  return (
    <>
      <PageHeader title={title} desc={desc}>
        {headerNote}
        <Btn onClick={() => open("new")}><Plus className="h-5 w-5" /> {addLabel ?? `New ${singular.toLowerCase()}`}</Btn>
      </PageHeader>
      <Card>
        <div className="border-b border-line p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} aria-label="Search" className={`${inputCls} pl-9`} />
          </div>
        </div>
        {shown.length === 0 ? <Empty text={rows.length ? "No matches." : `No ${singular.toLowerCase()} records yet.`} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-base">
              <thead className="bg-canvas text-sm text-ink/70"><tr>{columns.map((c) => <th key={c.key} scope="col" className="px-4 py-3 font-semibold">{c.label}</th>)}<th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={r.id} className="hover:bg-canvas/60">
                    {columns.map((c) => <td key={c.key} className="px-4 py-3 align-top">{cell(c, r)}</td>)}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {rowActions.map((a) => <Btn key={a.action} small variant="secondary" disabled={rowBusy === `${r.id}:${a.action}`} onClick={() => act(r, a.action)}><Power className="h-4 w-4" /> {rowBusy === `${r.id}:${a.action}` ? "…" : a.label}</Btn>)}
                        {!lockedIds.includes(r.id) && <Btn small variant="secondary" onClick={() => open(r)} aria-label="Edit"><Pencil className="h-4 w-4" /> Edit</Btn>}
                        {canDelete && !lockedIds.includes(r.id) && <Btn small variant="ghost" disabled={rowBusy === r.id} onClick={() => del(r)} aria-label="Delete" className="!text-alert hover:!bg-alert/10"><Trash2 className="h-4 w-4" /></Btn>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <Modal title={editing === "new" ? `New ${singular.toLowerCase()}` : `Edit ${singular.toLowerCase()}`} onClose={() => setEditing(null)} footer={<><Btn variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn><Btn onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Btn></>}>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => {
              if (f.createOnly && editing !== "new") return null;
              const span = f.half ? "" : "sm:col-span-2";
              if (f.type === "checkbox")
                return (
                  <label key={f.name} className={`flex cursor-pointer items-center gap-3 self-end rounded-lg border border-line px-4 py-3 ${span}`}>
                    <input type="checkbox" className="h-5 w-5 accent-[#0D47A1]" checked={Boolean(v[f.name])} onChange={(e) => setV({ ...v, [f.name]: e.target.checked })} />
                    <span className="text-base font-medium">{f.label}</span>
                  </label>
                );
              const label = f.label + (f.required && !(f.type === "password" && editing !== "new") ? " *" : "");
              return (
                <Field key={f.name} label={label} help={f.type === "password" && editing !== "new" ? "Leave blank to keep the current password. Entering a value forces a reset." : f.help} className={span}>
                  {f.type === "textarea" ? (
                    <textarea rows={3} className={inputCls} value={String(v[f.name] ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
                  ) : f.type === "select" ? (
                    <select className={inputCls} value={String(v[f.name] ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      step={f.step}
                      className={inputCls}
                      required={f.required && !(f.type === "password" && editing !== "new")}
                      autoComplete={f.type === "password" ? "new-password" : undefined}
                      value={String(v[f.name] ?? "")}
                      onChange={(e) => setV({ ...v, [f.name]: e.target.value })}
                    />
                  )}
                </Field>
              );
            })}
            <button type="submit" className="sr-only">Save</button>
          </form>
        </Modal>
      )}
    </>
  );
}
