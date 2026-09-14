/**
 * Shared helpers for the public /college knowledge pages (SEO/GEO).
 *
 * PRIVACY INVARIANT (mirrors retrieval's VISIBLE_DOC_FILTER): only published,
 * active-version, PUBLIC, unexpired documents may ever appear here. Internal
 * and restricted documents (e.g. student records) are excluded in SQL, not in
 * components — there is no code path that can leak them.
 */
import { sql } from "drizzle-orm";

/** Public, published, active, unexpired — the only documents the web may show. */
export const PUBLIC_DOC_FILTER = sql`
  d.status = 'published'
  AND d.is_active_version = true
  AND d.access_level = 'public'
  AND (d.expiry_date IS NULL OR d.expiry_date > CURRENT_DATE)
`;

/** URL-safe slug from a document title. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * Deterministic document URL slug: readable title + first 8 hex chars of the
 * canonical_id (already covered by the partial unique index on
 * documents_active_version, so lookups are indexed). No DB migration needed.
 */
export function docSlug(title: string, canonicalId: string): string {
  return `${slugify(title) || "document"}-${canonicalId.slice(0, 8)}`;
}

/** Extract the canonical_id prefix from a doc slug, or null if malformed. */
export function canonicalPrefixFromSlug(docSlug: string): string | null {
  const m = docSlug.match(/-([0-9a-f]{8})$/);
  return m?.[1] ?? null;
}
