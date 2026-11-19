export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;

/** "Lily's Nails & Beauty!" -> "lily-s-nails-beauty". May be too short; validate after. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** Only same-site relative paths; blocks open redirects like //evil.com or /\evil.com. */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
