export async function api<T = unknown>(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (json as { error?: string }).error || `Request failed (${res.status})` };
    return { ok: true, data: ((json as { data?: T }).data ?? json) as T };
  } catch {
    return { ok: false, error: "Network error — please try again." };
  }
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed (${res.status})`);
  return res.json() as Promise<T>;
}

export function useDocumentTitle(title: string) {
  if (typeof document !== "undefined") {
    document.title = title;
  }
}
