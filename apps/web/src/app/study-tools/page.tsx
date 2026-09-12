import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "../_components/MarketingPage";
import { Reveal } from "../_components/Reveal";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "Study Tools",
  description: "Quizzes and spaced-repetition flashcards built from your syllabus.",
};

const TOOLS = [
  {
    label: "Quizzes",
    text: "Generate a quiz on any topic or subject in seconds — questions come from your own syllabus, with instant checking and explanations for every answer.",
  },
  {
    label: "Flashcards",
    text: "Flashcards that schedule themselves with spaced repetition — you review what you're about to forget and skip what you already know.",
  },
  {
    label: "Study modes",
    text: "Explain Simply for when you're starting out, Challenge Me for when you want to be pushed. Learn and Practice modes fit everything in between.",
  },
  {
    label: "Works with chat",
    text: "Stuck on a quiz question? Drop back into the chat, ask for the full derivation, and return to practice — everything is in one place.",
  },
];

export default function StudyToolsPage() {
  return (
    <MarketingPage>
      <main id="main">
        <section className={`${styles.container} ${styles.pageHeader}`}>
          <Reveal>
            <p className={styles.sectionKicker}>Study tools</p>
            <h1 className={styles.sectionTitle}>Study smarter, not longer.</h1>
            <p className={styles.sectionSub}>
              Revision that adapts to you — quizzes generated from your syllabus and flashcards
              that schedule themselves.
            </p>
          </Reveal>
        </section>

        <section className={`${styles.bandSoft} ${styles.section}`}>
          <div className={styles.container}>
            <div className={styles.aboutList} style={{ maxWidth: "100%" }}>
              {TOOLS.map((row, i) => (
                <Reveal key={row.label} delay={i * 70}>
                  <div className={styles.aboutRow}>
                    <span className={styles.aboutLabel}>{row.label}</span>
                    <p className={styles.aboutText}>{row.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.container} ${styles.ctaSection}`}>
          <Reveal>
            <div className={styles.ctaBand}>
              <h2>Make revision automatic.</h2>
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
