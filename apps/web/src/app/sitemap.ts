import type { MetadataRoute } from "next";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { PUBLIC_DOC_FILTER, docSlug } from "@/lib/college-pages";

/**
 * sitemap.xml — static marketing pages + every PUBLIC college document page.
 * Runtime-generated (never queried at build; CI has a dummy DATABASE_URL):
 * sitemap requests revalidate hourly, pages on demand.
 */
const SITE = "https://upcai.app";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE}/college`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/about`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/knowledge`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/study-tools`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/for-faculty`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/faq`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/privacy`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/accessibility`, lastModified, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Public document pages (privacy: PUBLIC_DOC_FILTER — internal/restricted
  // documents can never appear in the sitemap)
  try {
    const db = getDb();
    const docs = (await db.execute(sql`
      SELECT d.title, d.canonical_id, d.published_at, c.slug AS category_slug
      FROM documents d
      JOIN knowledge_categories c ON c.id = d.category_id
      WHERE ${PUBLIC_DOC_FILTER}
      ORDER BY d.published_at DESC NULLS LAST
    `)) as unknown as { title: string; canonical_id: string; published_at: string | null; category_slug: string }[];
    const docPages: MetadataRoute.Sitemap = docs.map((d) => ({
      url: `${SITE}/college/${d.category_slug}/${docSlug(d.title, d.canonical_id)}`,
      lastModified: d.published_at ? new Date(d.published_at) : lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    }));
    return [...staticPages, ...docPages];
  } catch {
    // DB unreachable at sitemap render — static pages still ship
    return staticPages;
  }
}
