import { useEffect } from "react";
import { CrudManager } from "@/components/portal/CrudManager";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";
import { usePortalUser } from "./PortalLayout";

export default function AccessUsersPage() {
  const { user } = usePortalUser();
  const { data, loading, error, reload } = usePortalData<{ items: any[] }>("/api/portal/users");

  useEffect(() => {
    document.title = "Users | Rithanya HMS";
  }, []);

  if (loading) return <LoadingCard />;
  if (error || !data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;

  const isSuperadmin = user?.role === "SUPERADMIN";
  const roleOptions = isSuperadmin
    ? [
        { value: "STAFF", label: "Staff" },
        { value: "ADMIN", label: "Admin" },
      ]
    : [{ value: "STAFF", label: "Staff" }];

  // Rows this account cannot manage (the server returns `editable` per row from
  // canActorManageUser): admins may only manage Staff, nobody manages their own
  // account or other superadmins. Locking them hides Edit/Delete instead of
  // showing a form the server will reject.
  const lockedIds = data.items.filter((u: { id: string; editable?: boolean }) => u.editable === false).map((u: { id: string }) => u.id);

  return (
    <CrudManager
      title={isSuperadmin ? "User accounts" : "Staff accounts"}
      desc={
        isSuperadmin
          ? "Superadmin management: Create and manage Admin and Staff accounts."
          : "Admin management: Create and manage Staff accounts and credentials."
      }
      resource="users"
      singular={isSuperadmin ? "User" : "Staff Account"}
      rows={data.items}
      lockedIds={lockedIds}
      defaults={{ role: "STAFF", isActive: true }}
      columns={[
        { key: "fullName", label: "Name", sub: "username" },
        { key: "email", label: "Email" },
        {
          key: "role",
          label: "Role",
          kind: "badge",
          tone: isSuperadmin
            ? { SUPERADMIN: "purple", ADMIN: "blue", STAFF: "slate" }
            : { ADMIN: "blue", STAFF: "slate" },
        },
        { key: "isActive", label: "Status", kind: "bool" },
      ]}
      fields={[
        { name: "username", label: "Username", type: "text", required: true, createOnly: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "fullName", label: "Full name", type: "text", required: true },
        {
          name: "role",
          label: "Role",
          type: "select",
          options: roleOptions,
          help: isSuperadmin ? "Superadmins can create Admin or Staff accounts" : "Admins can create Staff accounts only",
        },
        { name: "isActive", label: "Active", type: "checkbox" },
        { name: "password", label: "Password", type: "password", required: true, help: "Min 8 characters" },
      ]}
    />
  );
}