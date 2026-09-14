import Link from "next/link";
import type { Metadata } from "next";
import { MarketingPage } from "../_components/MarketingPage";
import { Reveal } from "../_components/Reveal";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "Pricing — Free for Every Udai Pratap College Student",
  description:
    "UPC AI is free for every student and faculty member of Udai Pratap College — unlimited academic help, official college answers with citations, English and Hindi.",
  alternates: { canonical: "/pricing" },
};

const TIERS = [
  {
    name: "UPC-1",
    tag: "Fast",
    price: "Free",
    points: ["Instant answers for quick doubts", "College questions with citations", "English & Hindi", "Photo & PDF support"],
  },
  {
    name: "UPC-1 Plus",
    tag: "Standard · default",
    price: "Free",
    points: ["Deeper reasoning for study sessions", "College questions with citations", "English & Hindi", "Photo & PDF support", "All study modes"],
    featured: true,
  },
  {
    name: "UPC-1 Pro",
    tag: "Frontier",
    price: "Free",
    points: ["The strongest model for hard problems", "College questions with citations", "English & Hindi", "Photo & PDF support"],
  },
];

export default function PricingPage() {
  return (
    <MarketingPage>
      <main id="main">
        <section className={`${styles.container} ${styles.pageHeader}`}>
          <Reveal>
            <p className={styles.sectionKicker}>Pricing</p>
            <h1 className={styles.sectionTitle}>Free. For every UPC student.</h1>
            <p className={styles.sectionSub}>
              Built for the college, paid for by the college — so students never see a
              paywall between them and their own campus knowledge.
            </p>
          </Reveal>
        </section>

        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <div className={styles.tileGrid}>
            {TIERS.map((t, i) => (
              <Reveal key={t.name} delay={i * 70}>
                <div className={styles.compareCard} style={t.featured ? { borderColor: "var(--ink)" } : undefined}>
                  <h3>
                    {t.name} <small style={{ color: "var(--muted)", fontWeight: 450 }}>{t.tag}</small>
                  </h3>
                  <p style={{ fontSize: 30, fontWeight: 550, color: "var(--ink)" }}>{t.price}</p>
                  <ul>
                    {t.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className={styles.prose} style={{ marginTop: "var(--space-xl)", textAlign: "center" }}>
              A supporter tier with higher limits and priority speed is planned for when
              college funding lands — the student tier stays free either way.
            </p>
          </Reveal>
        </section>

        <section className={`${styles.container} ${styles.ctaSection}`}>
          <Reveal>
            <div className={styles.ctaBand}>
              <h2>Start studying smarter.</h2>
              <p>Free for every UPC student. Sign up in seconds.</p>
              <Link href="/signup" className={styles.ctaBtn}>
                Get Started Free
              </Link>
            </div>
          </Reveal>
        </section>
      </main>
    </MarketingPage>
  );
}
