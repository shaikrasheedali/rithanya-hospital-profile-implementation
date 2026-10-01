import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoginForm } from "@/components/portal/LoginForm";

export default function PortalLoginPage() {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "Staff Login | Rithanya Hospital";
    fetch("/api/auth/me").then((r) => {
      if (r.ok) navigate("/portal/dashboard");
    }).catch(() => undefined);
  }, [navigate]);
  return <LoginForm />;
}
