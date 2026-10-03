import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { PortalShell } from "@/components/portal/PortalShell";
import type { SessionUser } from "@/lib/auth";

type PortalContextType = {
  user: SessionUser | null;
  entity: "RITHANYA_HOSPITAL" | "RVBC";
};

export const PortalUserContext = createContext<PortalContextType>({
  user: null,
  entity: "RITHANYA_HOSPITAL",
});

export const usePortalUser = () => useContext(PortalUserContext);

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function PortalLayout({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
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

  return (
    <PortalUserContext.Provider value={{ user, entity }}>
      <PortalShell user={user} entity={entity}>
        {children ?? <Outlet />}
      </PortalShell>
    </PortalUserContext.Provider>
  );
}

export function RequireModule({ allow, children }: { allow: boolean; children: ReactNode }) {
  if (!allow) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
        You do not have access to this module. Contact your administrator.
      </div>
    );
  }
  return <>{children}</>;
}
