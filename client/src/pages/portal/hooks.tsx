import { useEffect, useState } from "react";

export function usePortalData<T>(url: string): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(url)
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/portal/login";
          return null;
        }
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((d) => {
        if (alive && d) setData(d);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url]);

  return { data, loading, error };
}

export function LoadingCard() {
  return <div className="animate-pulse rounded-xl border border-line bg-white p-8"><div className="h-6 w-1/3 rounded bg-line/70" /><div className="mt-4 h-24 rounded bg-line/50" /></div>;
}

export function ErrorCard({ error }: { error: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-6 font-medium text-red-900">{error}</div>;
}
