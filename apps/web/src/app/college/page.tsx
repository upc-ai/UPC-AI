import Link from "next/link";
import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { PUBLIC_DOC_FILTER } from "@/lib/college-pages";
import { MarketingPage } from "../_components/MarketingPage";
import { Reveal } from "../_components/Reveal";
import { JsonLd } from "../_components/JsonLd";
import styles from "../landing.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "College Knowledge — Udai Pratap College Fees, Syllabus, Notices & Departments",
  description:
    "Browse every public document of Udai Pratap Autonomous College, Varanasi — fees, syllabi, admissions, notices, departments, faculty info, hostel and exams — as clean readable pages.",
  alternates: { canonical: "/college" },
};

export default function CollegeHubPage() {
  return (
    <MarketingPage>
      <main id="main">
        <CollegeContent />
      </main>
    </MarketingPage>
  );
}

async function CollegeContent() {
  let categories: { slug: string; name: string; docs: number }[] = [];
  try {
    const db = getDb();
    categories = (await db.execute(sql`
      SELECT c.slug, c.name, count(*)::int AS docs
      FROM documents d
      JOIN knowledge_categories c ON c.id = d.category_id
      WHERE ${PUBLIC_DOC_FILTER}
      GROUP BY c.slug, c.name, c.display_order
      ORDER BY c.display_order ASC
    `)) as unknown as { slug: string; name: string; docs: number }[];
  } catch {
    // DB unreachable — render the shell; search engines retry via sitemap.
  }

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Udai Pratap College — Knowledge Pages",
          description:
            "Public documents of Udai Pratap Autonomous College, Varanasi: fees, syllabi, notices, departments, faculty info, admissions, hostel and exams.",
          url: "https://upcai.app/college",
        }}
      />
      <section className={`${styles.container} ${styles.pageHeader}`}>
        <Reveal>
          <p className={styles.sectionKicker}>College knowledge</p>
          <h1 className={styles.sectionTitle}>Udai Pratap College — every public document, readable.</h1>
          <p className={styles.sectionSub}>
            The same approved documents that power UPC AI&apos;s answers, as clean pages:
            fees, syllabi, notices, departments, faculty info, admissions, hostel and exams.
          </p>
        </Reveal>
      </section>

      <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
        <div className={styles.aboutList}>
          {categories.map((c, i) => (
            <Reveal key={c.slug} delay={Math.min(i * 50, 200)}>
              <Link href={`/college/${c.slug}`} className={styles.collegeCatLink}>
                <div className={styles.aboutRow}>
                  <span className={styles.aboutLabel}>{c.name}</span>
                  <p className={styles.aboutText}>
                    {c.docs} document{c.docs === 1 ? "" : "s"} →
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
          {categories.length === 0 && (
            <div className={styles.aboutRow}>
              <span className={styles.aboutLabel}>Coming soon</span>
              <p className={styles.aboutText}>Documents are being prepared and will appear here.</p>
            </div>
          )}
        </div>
        <Reveal>
          <p className={styles.prose} style={{ marginTop: "var(--space-xl)" }}>
            Prefer asking instead of browsing?{" "}
            <Link href="/chat">Ask UPC AI directly</Link> — it answers from these documents
            with citations, in English and Hindi.
          </p>
        </Reveal>
      </section>
    </>
  );
}
