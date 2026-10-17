import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { PortalShell } from "@/components/portal/PortalShell";
import type { ModuleKey, SessionUser } from "@/lib/auth";

type PortalContextType = {
  user: SessionUser | null;
  entity: "RITHANYA_HOSPITAL" | "RVBC";
};

export const PortalUserContext = createContext<PortalContextType>({
  user: null,
  entity: "RITHANYA_HOSPITAL",
});

export const usePortalUser = () => useContext(PortalUserContext);

/** Portal path prefix → module required. Enforced server-side as well; this
 * gate keeps the UI honest (hidden nav entries stay reachable by URL otherwise). */
const ROUTE_MODULES: Array<{ prefix: string; module: ModuleKey }> = [
  { prefix: "/portal/appointments", module: "emr" },
  { prefix: "/portal/inpatients", module: "emr" },
  { prefix: "/portal/outpatients", module: "emr" },
  { prefix: "/portal/patients", module: "emr" },
  { prefix: "/portal/discharged-patients", module: "emr" },
  { prefix: "/portal/diagnosis-categories", module: "emr" },
  { prefix: "/portal/blood-bank", module: "bloodbank" },
  { prefix: "/portal/cms", module: "cms" },
  { prefix: "/portal/store", module: "store" },
  { prefix: "/portal/hr", module: "hr" },
  { prefix: "/portal/finance", module: "finance" },
  { prefix: "/portal/compliance", module: "dpdp" },
  { prefix: "/portal/access", module: "access" },
  { prefix: "/portal/settings", module: "settings" },
];

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function PortalLayout({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [entity, setEntity] = useState<"RITHANYA_HOSPITAL" | "RVBC">("RITHANYA_HOSPITAL");

  useEffect(() => {
    setEntity(getCookie("rh_entity") === "RVBC" ? "RVBC" : "RITHANYA_HOSPITAL");
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) {
          navigate("/portal/login");
          return null;
        }
        return r.json();
      })
      .then((d) => d && setUser(d.user))
      .catch(() => navigate("/portal/login"));
  }, [navigate]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="animate-pulse font-semibold text-navy">Loading portal…</p>
      </div>
    );
  }

  const gate = ROUTE_MODULES.find(
    (r) => location.pathname === r.prefix || location.pathname.startsWith(r.prefix + "/"),
  );
  const allowed = !gate || Boolean(user.modules?.[gate.module]);

  return (
    <PortalUserContext.Provider value={{ user, entity }}>
      <PortalShell user={user} entity={entity}>
        {children ?? (
          <RequireModule allow={allowed}>
            <Outlet />
          </RequireModule>
        )}
      </PortalShell>
    </PortalUserContext.Provider>
  );
}

export function RequireModule({ allow, children }: { allow: boolean; children?: ReactNode }) {
  if (!allow) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
        You do not have access to this module. Contact your administrator.
      </div>
    );
  }
  return <>{children}</>;
}
