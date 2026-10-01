export type MediaRef = {
  id: string;
  url: string;
  kind: "IMAGE" | "VIDEO";
  originalName: string;
};

export const coverOf = (media: MediaRef[] | undefined): MediaRef | undefined =>
  media?.find((m) => m.kind === "IMAGE") ?? media?.[0];

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "item"
  );
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatDate(d: Date | string | null | undefined, withTime = false): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
    timeZone: "Asia/Kolkata",
  });
}

export function formatINR(n: number | string): string {
  const v = typeof n === "string" ? Number(n) : n;
  return "₹" + (Number.isFinite(v) ? v : 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Minimal server-side hardening for CMS rich text (admin-authored). */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|link|meta|form)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|link|meta|form)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function phoneDigits(p: string): string {
  return p.replace(/\D/g, "");
}

export function telHref(p: string): string {
  const d = phoneDigits(p);
  return "tel:+" + (d.length === 10 ? "91" + d : d);
}

export function prettyPhone(p: string): string {
  const d = phoneDigits(p).slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : p;
}
