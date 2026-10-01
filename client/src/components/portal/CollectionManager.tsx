"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { MediaField, Thumb } from "@/components/portal/MediaPicker";
import { RichTextEditor } from "@/components/portal/RichTextEditor";
import { Badge, Btn, Card, Empty, Field, Modal, PageHeader, api, inputCls, useToast } from "@/components/portal/ui";
import { COLLECTIONS, type CollectionKey, type FieldDef } from "@/lib/collections";
import { formatINR, type MediaRef } from "@/lib/utils";

type Item = Record<string, unknown> & { id: string; media: MediaRef[] };

const PUBLIC_PATH: Partial<Record<CollectionKey, string>> = {
  specialties: "/clinical-care/specialties",
  treatments: "/clinical-care/treatments",
  services: "/clinical-care/services",
  doctors: "/doctors",
  insurance: "/insurance-providers",
  gallery: "/gallery",
  blogs: "/insights",
  products: "/products",
};

function defaults(fields: FieldDef[], item?: Item): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const f of fields) {
    if (item && item[f.name] !== undefined) v[f.name] = item[f.name];
    else if (f.type === "checkbox") v[f.name] = f.name === "isPublished";
    else if (f.type === "select") v[f.name] = f.options?.[0] ?? "";
    else if (f.type === "number") v[f.name] = f.name === "rating" ? 5 : 0;
    else v[f.name] = "";
  }
  return v;
}

export function CollectionManager({ collection, items }: { collection: CollectionKey; items: Item[] }) {
  const def = COLLECTIONS[collection];
  const navigate = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [media, setMedia] = useState<MediaRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [mediaErr, setMediaErr] = useState(false);

  const shown = useMemo(
    () => items.filter((i) => !q || JSON.stringify([i[def.titleField], i[def.subtitleField ?? ""]]).toLowerCase().includes(q.toLowerCase())),
    [items, q, def],
  );

  function openForm(item: Item | "new") {
    setEditing(item);
    setValues(defaults(def.fields, item === "new" ? undefined : item));
    setMedia(item === "new" ? [] : item.media);
    setMediaErr(false);
  }

  async function save() {
    if (media.length < 1) {
      setMediaErr(true);
      toast("Attach at least one image or video.", "err");
      return;
    }
    setBusy(true);
    const payload = { ...values, mediaIds: media.map((m) => m.id) };
    const r =
      editing === "new"
        ? await api(`/api/portal/cms/${collection}`, "POST", payload)
        : await api(`/api/portal/cms/${collection}/${(editing as Item).id}`, "PUT", payload);
    setBusy(false);
    if (!r.ok) return toast(r.error || "Save failed", "err");
    toast(`${def.singular} saved`);
    setEditing(null);
    window.location.reload();
  }

  async function remove(item: Item) {
    if (!confirm(`Delete “${String(item[def.titleField])}”? This cannot be undone.`)) return;
    const r = await api(`/api/portal/cms/${collection}/${item.id}`, "DELETE");
    if (!r.ok) return toast(r.error || "Delete failed", "err");
    toast(`${def.singular} deleted`);
    window.location.reload();
  }

  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  function renderField(f: FieldDef) {
    if (f.showIf && !f.showIf(values)) return null;
    const span = f.half ? "" : "sm:col-span-2";
    const v = values[f.name];
    let control: React.ReactNode;
    switch (f.type) {
      case "textarea":
        control = (
          <>
            <textarea rows={3} maxLength={f.max} className={inputCls} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} />
            {f.max && <span className="mt-1 block text-right text-sm text-ink/60">{String(v ?? "").length}/{f.max}</span>}
          </>
        );
        break;
      case "richtext":
        control = <RichTextEditor key={String(editing === "new" ? "new" : (editing as Item)?.id)} value={String(v ?? "")} onChange={(h) => set(f.name, h)} />;
        break;
      case "number":
        control = <input type="number" className={inputCls} value={String(v ?? 0)} onChange={(e) => set(f.name, e.target.value)} />;
        break;
      case "decimal":
        control = <input type="number" step="0.01" min="0" className={inputCls} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} />;
        break;
      case "select":
        control = (
          <select className={inputCls} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)}>
            {f.options?.map((o) => <option key={o}>{o}</option>)}
          </select>
        );
        break;
      case "checkbox":
        return (
          <label key={f.name} className={`flex cursor-pointer items-center gap-3 self-end rounded-lg border border-line px-4 py-3 ${span}`}>
            <input type="checkbox" className="h-5 w-5 accent-[#0D47A1]" checked={Boolean(v)} onChange={(e) => set(f.name, e.target.checked)} />
            <span className="text-base font-medium">{f.label}</span>
          </label>
        );
      default:
        control = <input className={inputCls} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} />;
    }
    return (
      <Field key={f.name} label={f.label + (f.required ? " *" : "")} help={f.help} className={span}>
        {control}
      </Field>
    );
  }

  const extras = (i: Item) => {
    const out: React.ReactNode[] = [];
    if (collection === "products") {
      out.push(<Badge key="p" tone="blue">{formatINR(String(i.price))}</Badge>);
      out.push(<Badge key="s" tone={Number(i.stockUnits) > 0 ? "green" : "red"}>{Number(i.stockUnits)} in stock</Badge>);
    }
    if (collection === "gallery") out.push(<Badge key="g" tone="purple">{String(i.mediaType).replace("IFRAME_", "")}</Badge>);
    if (collection === "blogs") out.push(<Badge key="b" tone={i.isPublished ? "green" : "amber"}>{i.isPublished ? "Published" : "Draft"}</Badge>);
    if (collection === "treatments" && i.isFlagship) out.push(<Badge key="f" tone="amber">Flagship</Badge>);
    if (collection === "doctors" && i.isVisiting) out.push(<Badge key="v" tone="amber">Visiting</Badge>);
    if (i.category) out.push(<Badge key="c">{String(i.category)}</Badge>);
    return out;
  };

  return (
    <>
      <PageHeader title={def.label} desc={`Manage ${def.label.toLowerCase()} shown on the public website. Every item needs at least one image or video.`}>
        {PUBLIC_PATH[collection] && (
          <a href={PUBLIC_PATH[collection]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-base font-semibold text-royal hover:text-alert">
            View on site <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <Btn onClick={() => openForm("new")}><Plus className="h-5 w-5" /> New {def.singular.toLowerCase()}</Btn>
      </PageHeader>

      <Card>
        <div className="border-b border-line p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${def.label.toLowerCase()}…`} aria-label="Search" className={`${inputCls} pl-9`} />
          </div>
        </div>
        {shown.length === 0 ? (
          <Empty text={items.length ? "No matches." : `No ${def.label.toLowerCase()} yet. Create the first one.`} />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                <div className="relative h-16 w-24 flex-none overflow-hidden rounded-lg border border-line bg-canvas">
                  {i.media[0] ? <Thumb m={i.media.find((m) => m.kind === "IMAGE") ?? i.media[0]} className="h-full w-full" /> : null}
                  {i.media.length > 1 && <span className="absolute bottom-1 right-1 rounded bg-navy/85 px-1.5 text-xs font-semibold text-white">+{i.media.length - 1}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-navy">{String(i[def.titleField])}</p>
                  {def.subtitleField && <p className="line-clamp-1 text-sm text-ink/70">{String(i[def.subtitleField] ?? "")}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">{extras(i)}</div>
                </div>
                <div className="flex gap-2">
                  <Btn small variant="secondary" onClick={() => openForm(i)} aria-label={`Edit ${String(i[def.titleField])}`}><Pencil className="h-4 w-4" /> Edit</Btn>
                  <Btn small variant="ghost" onClick={() => remove(i)} aria-label={`Delete ${String(i[def.titleField])}`} className="!text-alert hover:!bg-alert/10"><Trash2 className="h-4 w-4" /></Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <Modal
          size="lg"
          title={editing === "new" ? `New ${def.singular.toLowerCase()}` : `Edit ${def.singular.toLowerCase()}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Btn variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn>
              <Btn onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Btn>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {def.fields.map(renderField)}
            <div className="sm:col-span-2">
              <MediaField value={media} onChange={(m) => { setMedia(m); setMediaErr(false); }} help={def.mediaHelp} error={mediaErr} />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
