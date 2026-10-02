"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Save } from "lucide-react";
import { Badge, Btn, Card, PageHeader, api, useToast } from "@/components/portal/ui";

const COLS: Array<[string, string]> = [["emr", "Clinical / EMR"], ["bloodbank", "Blood bank"], ["cms", "CMS"], ["store", "Store"], ["hr", "HR"], ["finance", "Finance"], ["dpdp", "DPDP"]];
type U = { id: string; fullName: string; username: string; role: string; isActive: boolean; modules: Record<string, boolean>; editable: boolean };

export function PermissionsMatrix({ users }: { users: U[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [state, setState] = useState(() => Object.fromEntries(users.map((u) => [u.id, u.modules])));
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    setState(Object.fromEntries(users.map((u) => [u.id, u.modules])));
  }, [users]);
  const dirty = (u: U) => COLS.some(([k]) => Boolean(state[u.id]?.[k]) !== Boolean(u.modules[k]));

  async function save(u: U) {
    setBusy(u.id);
    const r = await api(`/api/portal/r/permissions/${u.id}`, "PUT", { modules: state[u.id] });
    setBusy(null);
    if (!r.ok) return toast(r.error || "Save failed — please try again.", "err");
    toast(`Permissions saved for ${u.fullName}`);
    setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <>
      <PageHeader title="Module permission matrix" desc="Tick the modules each account may open. Superadmin always has full access; system settings are Superadmin-only. Admins can edit Staff accounts only." />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-base">
          <thead className="bg-canvas text-sm text-ink/70">
            <tr><th scope="col" className="px-4 py-3 font-semibold">User</th>{COLS.map(([k, l]) => <th key={k} scope="col" className="px-3 py-3 text-center font-semibold">{l}</th>)}<th className="px-4 py-3"><span className="sr-only">Save</span></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                <td className="px-4 py-3"><span className="font-semibold text-navy">{u.fullName}</span> <Badge tone={u.role === "SUPERADMIN" ? "amber" : u.role === "ADMIN" ? "blue" : "slate"}>{u.role}</Badge><span className="block text-sm text-ink/65">@{u.username}{!u.isActive && " · inactive"}</span></td>
                {COLS.map(([k, l]) => (
                  <td key={k} className="px-3 py-3 text-center">
                    {u.role === "SUPERADMIN" ? <Lock className="mx-auto h-4 w-4 text-ink/40" aria-label="Always enabled" /> : (
                      <input type="checkbox" aria-label={`${l} for ${u.fullName}`} disabled={!u.editable} checked={Boolean(state[u.id]?.[k])} onChange={(e) => setState({ ...state, [u.id]: { ...state[u.id], [k]: e.target.checked } })} className="h-5 w-5 accent-[#0D47A1] disabled:opacity-40" />
                    )}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">{u.editable && dirty(u) && <Btn small onClick={() => save(u)} disabled={busy === u.id}><Save className="h-4 w-4" /> Save</Btn>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
