import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { PUBLIC_DOC_FILTER, canonicalPrefixFromSlug } from "@/lib/college-pages";
import { MarketingPage } from "../../../_components/MarketingPage";
import { Reveal } from "../../../_components/Reveal";
import { JsonLd } from "../../../_components/JsonLd";
import { Markdown } from "@/components/chat/Markdown";
import styles from "../../../landing.module.css";

export const dynamic = "force-dynamic";

interface Params {
  params: { category: string; docslug: string };
}

async function loadDoc(categorySlug: string, docSlugParam: string) {
  const prefix = canonicalPrefixFromSlug(docSlugParam);
  if (!prefix) return null;
  const db = getDb();
  const [row] = (await db.execute(sql`
    SELECT d.id, d.title, d.description, d.canonical_id, d.published_at, d.updated_at,
           c.slug AS category_slug, c.name AS category_name
    FROM documents d
    JOIN knowledge_categories c ON c.id = d.category_id
    WHERE ${PUBLIC_DOC_FILTER}
      AND d.canonical_id::text LIKE ${prefix + "%"}
    LIMIT 1
  `)) as unknown as {
    id: string; title: string; description: string | null; canonical_id: string;
    published_at: string | null; updated_at: string | null;
    category_slug: string; category_name: string;
  }[];
  if (!row || row.category_slug !== categorySlug) return null;

  // Chunks in order, concatenated with headings = the readable document body
  const chunks = (await db.execute(sql`
    SELECT content FROM chunks
    WHERE document_id = ${row.id} AND status = 'active'
    ORDER BY chunk_index ASC
  `)) as unknown as { content: string }[];

  return { doc: row, content: chunks.map((c) => c.content).join("\n\n") };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  try {
    const data = await loadDoc(params.category, params.docslug);
    if (!data) return { title: "Document" };
    const desc =
      data.doc.description?.slice(0, 160) ??
      `${data.doc.title} — official document of Udai Pratap Autonomous College, Varanasi.`;
    return {
      title: `${data.doc.title} — Udai Pratap College`,
      description: desc,
      alternates: { canonical: `/college/${params.category}/${params.docslug}` },
    };
  } catch {
    return { title: "Document" };
  }
}

export default async function CollegeDocPage({ params }: Params) {
  let data: Awaited<ReturnType<typeof loadDoc>> = null;
  try {
    data = await loadDoc(params.category, params.docslug);
  } catch {
    // DB unreachable → 404 shell
  }
  if (!data) notFound();
  const { doc } = data;
  const url = `https://upcai.app/college/${params.category}/${params.docslug}`;

  return (
    <MarketingPage>
      <main id="main">
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Article",
              headline: doc.title,
              description: doc.description ?? undefined,
              url,
              datePublished: doc.published_at ?? undefined,
              dateModified: doc.updated_at ?? doc.published_at ?? undefined,
              isPartOf: { "@type": "WebSite", name: "UPC AI", url: "https://upcai.app" },
              about: { "@type": "EducationalOrganization", name: "Udai Pratap Autonomous College" },
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "College knowledge", item: "https://upcai.app/college" },
                { "@type": "ListItem", position: 2, name: doc.category_name, item: `https://upcai.app/college/${doc.category_slug}` },
                { "@type": "ListItem", position: 3, name: doc.title },
              ],
            },
          ]}
        />
        <section className={`${styles.container} ${styles.pageHeader}`}>
          <Reveal>
            <p className={styles.sectionKicker}>
              <Link href="/college">College knowledge</Link> · <Link href={`/college/${doc.category_slug}`}>{doc.category_name}</Link>
            </p>
            <h1 className={styles.sectionTitle}>{doc.title}</h1>
            <p className={styles.sectionSub}>
              Official document of Udai Pratap Autonomous College, Varanasi
              {doc.published_at ? ` · published ${new Date(doc.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : ""}.
            </p>
          </Reveal>
        </section>

        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <Reveal>
            <div className={styles.docBody}>
              <Markdown content={data.content} />
            </div>
          </Reveal>
          <Reveal>
            <p className={styles.prose} style={{ marginTop: "var(--space-xl)" }}>
              Have a question about this document?{" "}
              <Link href="/chat">Ask UPC AI</Link> — it answers from this and every other
              approved document, with citations.
            </p>
          </Reveal>
        </section>
      </main>
    </MarketingPage>
  );
}
