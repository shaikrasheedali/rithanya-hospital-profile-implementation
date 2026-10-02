import { useEffect } from "react";
import { AppointmentsDesk } from "@/components/portal/AppointmentsDesk";
import { usePortalData, LoadingCard, ErrorCard } from "./hooks";

export default function AppointmentsPage() {
  const { data, loading, error, reload } = usePortalData<{ items: Array<{ id: string; fullName: string; phone: string; department: string; preferredDate: string; message: string; source: string; status: string; createdAt: string }> }>("/api/portal/appointments");
  useEffect(() => { document.title = "Appointments | Rithanya HMS"; }, []);
  if (loading) return <LoadingCard />;
  if (error || !data) return <ErrorCard error={error ?? "Load failed"} onRetry={reload} />;
  return <AppointmentsDesk rows={data.items} />;
}
