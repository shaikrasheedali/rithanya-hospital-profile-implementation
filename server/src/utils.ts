import sanitizeHtmlLib from "sanitize-html";

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

/**
 * Allow-list HTML sanitizer for CMS rich text.
 *
 * The previous regex version was bypassable (`<svg/onload=…>`,
 * `<a href=javascript:…>` without quotes, etc.) — this now parses the markup
 * and keeps only known-safe tags/attributes/schemes. Content produced by the
 * portal rich-text editor (bold/italic/underline, headings, lists, links,
 * quotes, images) round-trips unchanged.
 */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(String(html ?? ""), {
    allowedTags: [
      "p", "br", "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup", "hr",
      "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
      "a", "blockquote", "img", "span", "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      // Only style declarations matching allowedStyles below survive.
      "*": ["style"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^(left|right|center|justify)$/],
        "font-weight": [/^(bold|normal|[1-9]00)$/],
        "font-style": [/^(italic|normal)$/],
        "text-decoration": [/^(underline|line-through|none)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    // data: stays allowed on <img> only (inline base64 images pasted into the
    // editor); it never executes in an image context.
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const external = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: { ...attribs, ...(external ? { target: "_blank" } : {}), rel: "noopener noreferrer" },
        };
      },
    },
  });
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function phoneDigits(p: string): string {
  return (p ?? "").replace(/\D/g, "");
}

export function telHref(p: string): string {
  const d = phoneDigits(p);
  return "tel:+" + (d.length === 10 ? "91" + d : d);
}

export function prettyPhone(p: string): string {
  const d = phoneDigits(p).slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : p;
}
