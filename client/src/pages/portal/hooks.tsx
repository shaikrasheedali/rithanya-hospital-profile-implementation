import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { entityHeader } from "@/lib/api";
import { registerSoftRefresh } from "@/lib/softRefresh";

export function usePortalData<T>(url: string): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const dataRef = useRef<T | null>(null);

  const reload = useCallback(() => {
    setError(null);
    setNonce((n) => n + 1);
  }, []);

  // Expose this loader to portal-wide soft refreshes while mounted.
  useEffect(() => registerSoftRefresh(reload), [reload]);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    let alive = true;
    // Only show the skeleton on the FIRST load — a soft refresh keeps the
    // current data visible while the request is in flight.
    if (!dataRef.current) setLoading(true);
    setError(null);
    fetch(url, { headers: entityHeader(), credentials: "same-origin", signal: ctrl.signal })
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/portal/login";
          return null;
        }
        if (!r.ok) {
          const j = await r.json().catch(() => ({}) as { error?: string });
          throw new Error((j as { error?: string }).error || `Request failed (${r.status}) — please try again.`);
        }
        return r.json();
      })
      .then((d) => {
        if (alive && d) {
          dataRef.current = d as T;
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!alive || (e instanceof Error && e.name === "AbortError")) return;
        const msg = e instanceof Error ? e.message : "Load failed — please try again.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [url, nonce]);

  return { data, loading, error, reload };
}

export function LoadingCard() {
  return <div className="animate-pulse rounded-xl border border-line bg-white p-8"><div className="h-6 w-1/3 rounded bg-line/70" /><div className="mt-4 h-24 rounded bg-line/50" /></div>;
}

export function ErrorCard({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
      <p role="alert" className="font-medium text-red-900">{error}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 rounded-lg bg-royal px-5 py-2.5 font-semibold text-white hover:bg-navy">
          Try again
        </button>
      )}
    </div>
  );
}
