import type { Metadata } from "next";
import { MarketingPage } from "../_components/MarketingPage";
import { Reveal } from "../_components/Reveal";
import { FAQS, FaqItem } from "../_components/FAQ";
import { JsonLd, faqJsonLd } from "../_components/JsonLd";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "FAQ — UPC AI, the AI Assistant of Udai Pratap College",
  description:
    "Frequently asked questions about UPC AI: is it free, how accurate are answers, Hindi support, phone use, and who maintains the knowledge base of Udai Pratap College.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <MarketingPage>
      <main id="main">
        <JsonLd data={faqJsonLd(FAQS)} />
        <section className={`${styles.container} ${styles.pageHeader}`}>
          <Reveal>
            <p className={styles.sectionKicker}>Help center</p>
            <h1 className={styles.sectionTitle}>Questions, answered.</h1>
            <p className={styles.sectionSub}>
              Everything students and faculty usually ask about UPC AI.
            </p>
          </Reveal>
        </section>

        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <div className={styles.faqList}>
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={Math.min(i * 50, 200)}>
                <FaqItem q={f.q} a={f.a} defaultOpen={i === 0} />
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className={styles.prose} style={{ marginTop: "var(--space-xl)" }}>
              Still stuck? Write to us at{" "}
              <a href="mailto:hello@upcai.app">hello@upcai.app</a> — we reply to every
              message.
            </p>
          </Reveal>
        </section>
      </main>
    </MarketingPage>
  );
}
