import { useEffect } from "react";

/**
 * The hospital group entity selector is persisted client-side in the
 * `rh_entity` cookie and forwarded to every API call as the
 * `x-rh-entity` header, so a single implementation lives here and both
 * `api()` (lib + portal ui wrapper) send identical headers.
 */
export function entityHeader(): Record<string, string> {
  try {
    const m = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )rh_entity=([^;]*)/) : null;
    return { "x-rh-entity": m ? decodeURIComponent(m[1]) : "RITHANYA_HOSPITAL" };
  } catch {
    return { "x-rh-entity": "RITHANYA_HOSPITAL" };
  }
}

export async function api<T = unknown>(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const headers: Record<string, string> = { ...entityHeader() };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(url, {
      method,
      headers,
      credentials: "same-origin",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    // Session expired: send the user to the login page instead of showing a
    // bare "Request failed (401)" toast (reads already did this via the hook).
    if (res.status === 401) {
      if (typeof window !== "undefined") window.location.href = "/portal/login";
      return { ok: false, error: "Your session has expired — please sign in again." };
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (json as { error?: string }).error || `Request failed (${res.status})` };
    return { ok: true, data: ((json as { data?: T }).data ?? json) as T };
  } catch {
    return { ok: false, error: "Network error — please try again." };
  }
}

export async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { ...entityHeader() }, credentials: "same-origin" });
  } catch {
    throw new Error("Network error — please check your connection and try again.");
  }
  if (!res.ok) {
    const json = await res.json().catch(() => ({}) as { error?: string });
    throw new Error((json as { error?: string }).error || `Request failed (${res.status}) — please try again.`);
  }
  return res.json() as Promise<T>;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    if (typeof document !== "undefined" && title) {
      document.title = title;
    }
  }, [title]);
}
