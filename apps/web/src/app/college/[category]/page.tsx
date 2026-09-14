import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { PUBLIC_DOC_FILTER, docSlug } from "@/lib/college-pages";
import { MarketingPage } from "../../_components/MarketingPage";
import { Reveal } from "../../_components/Reveal";
import { JsonLd } from "../../_components/JsonLd";
import styles from "../../landing.module.css";

export const dynamic = "force-dynamic";

interface Params {
  params: { category: string };
}

async function loadCategory(slug: string) {
  const db = getDb();
  const [cat] = (await db.execute(sql`
    SELECT id, name, slug FROM knowledge_categories WHERE slug = ${slug} LIMIT 1
  `)) as unknown as { id: string; name: string; slug: string }[];
  if (!cat) return null;
  const docs = (await db.execute(sql`
    SELECT d.id, d.title, d.canonical_id, d.published_at
    FROM documents d
    WHERE ${PUBLIC_DOC_FILTER} AND d.category_id = ${cat.id}
    ORDER BY d.published_at DESC NULLS LAST, d.title ASC
  `)) as unknown as { id: string; title: string; canonical_id: string; published_at: string | null }[];
  return { cat, docs };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  try {
    const data = await loadCategory(params.category);
    if (!data) return { title: "College documents" };
    return {
      title: `${data.cat.name} — Udai Pratap College, Varanasi`,
      description: `${data.cat.name} of Udai Pratap Autonomous College, Varanasi — ${data.docs.length} official document${data.docs.length === 1 ? "" : "s"} as readable pages.`,
      alternates: { canonical: `/college/${data.cat.slug}` },
    };
  } catch {
    return { title: "College documents" };
  }
}

export default async function CollegeCategoryPage({ params }: Params) {
  let data: Awaited<ReturnType<typeof loadCategory>> = null;
  try {
    data = await loadCategory(params.category);
  } catch {
    // DB unreachable → 404 shell (search engines retry via sitemap)
  }
  if (!data) notFound();

  return (
    <MarketingPage>
      <main id="main">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${data.cat.name} — Udai Pratap College`,
            url: `https://upcai.app/college/${data.cat.slug}`,
            isPartOf: { "@type": "WebSite", name: "UPC AI", url: "https://upcai.app" },
          }}
        />
        <section className={`${styles.container} ${styles.pageHeader}`}>
          <Reveal>
            <p className={styles.sectionKicker}>
              <Link href="/college">College knowledge</Link>
            </p>
            <h1 className={styles.sectionTitle}>{data.cat.name} — Udai Pratap College</h1>
            <p className={styles.sectionSub}>
              {data.docs.length} official document{data.docs.length === 1 ? "" : "s"} from Udai
              Pratap Autonomous College, Varanasi.
            </p>
          </Reveal>
        </section>

        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <div className={styles.aboutList}>
            {data.docs.map((d, i) => (
              <Reveal key={d.id} delay={Math.min(i * 40, 200)}>
                <Link href={`/college/${data.cat.slug}/${docSlug(d.title, d.canonical_id)}`} className={styles.collegeCatLink}>
                  <div className={styles.aboutRow}>
                    <span className={styles.aboutLabel}>{d.title}</span>
                    <p className={styles.aboutText}>
                      {d.published_at ? new Date(d.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Official document"} →
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className={styles.prose} style={{ marginTop: "var(--space-xl)" }}>
              Need something specific?{" "}
              <Link href="/chat">Ask UPC AI</Link> — it searches these documents and answers with citations.
            </p>
          </Reveal>
        </section>
      </main>
    </MarketingPage>
  );
}
