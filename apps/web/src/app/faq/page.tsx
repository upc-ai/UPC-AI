import type { Metadata } from "next";
import { MarketingPage } from "../_components/MarketingPage";
import { Reveal } from "../_components/Reveal";
import { FAQS, FaqItem } from "../_components/FAQ";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about UPC AI.",
};

export default function FaqPage() {
  return (
    <MarketingPage>
      <main id="main">
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
              <a href="mailto:hello@helloupcai.app">hello@helloupcai.app</a> — we reply to every
              message.
            </p>
          </Reveal>
        </section>
      </main>
    </MarketingPage>
  );
}
