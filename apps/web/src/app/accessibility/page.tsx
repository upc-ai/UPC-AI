import type { Metadata } from "next";
import { MarketingPage } from "../_components/MarketingPage";
import { Reveal } from "../_components/Reveal";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "UPC AI's accessibility commitments and how to report issues.",
};

export default function AccessibilityPage() {
  return (
    <MarketingPage>
      <main id="main">
        <section className={`${styles.container} ${styles.pageHeader}`}>
          <Reveal>
            <p className={styles.sectionKicker}>Legal</p>
            <h1 className={styles.sectionTitle}>Accessibility</h1>
            <p className={styles.sectionSub}>
              UPC AI should work for everyone at the college. Here&apos;s what we&apos;ve built
              and what we&apos;re working toward.
            </p>
          </Reveal>
        </section>

        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <Reveal>
            <div className={styles.prose}>
              <h3>Already built in</h3>
              <ul>
                <li><strong>Keyboard navigation</strong> — every menu, dialog and control works without a mouse, with a visible focus ring.</li>
                <li><strong>Screen reader support</strong> — buttons, dialogs, statuses and icons carry proper labels and ARIA semantics.</li>
                <li><strong>Reduced motion</strong> — animations switch themselves off when your system requests it.</li>
                <li><strong>Reduced transparency</strong> — glass surfaces fall back to solid, easier-to-read backgrounds when your device asks.</li>
                <li><strong>Both themes</strong> — light and dark modes are both tuned for readable contrast.</li>
                <li><strong>Mobile first</strong> — the entire app works on small screens and touch.</li>
                <li><strong>Devanagari scripts</strong> — Hindi text renders with proper fonts, in questions and answers alike.</li>
              </ul>

              <h3>Working toward</h3>
              <p>
                We continuously improve contrast, screen reader experience and touch targets as
                the app grows. If anything on UPC AI is hard for you to use, we want to fix it.
              </p>

              <h3>Report an issue</h3>
              <p>
                Email <a href="mailto:hello@upcai.app">hello@upcai.app</a> with what
                you were trying to do and what got in the way. Every accessibility report is
                treated as a bug, not a suggestion.
              </p>
            </div>
          </Reveal>
        </section>
      </main>
    </MarketingPage>
  );
}
