import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "../_components/MarketingPage";
import { Reveal } from "../_components/Reveal";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "For Faculty",
  description: "How Udai Pratap College faculty and staff power the UPC AI knowledge base.",
};

const ROWS = [
  {
    label: "Why it matters",
    text: "Students ask the same official questions all year — fees, exam dates, hostel rules. UPC AI answers them correctly, around the clock, with the exact document cited, so college staff answer them once instead of a hundred times.",
  },
  {
    label: "Feed the knowledge base",
    text: "Upload the documents you already have — circulars, fee schedules, syllabi, notices — as PDF, Word, presentations or spreadsheets. UPC AI reads, indexes and cites them.",
  },
  {
    label: "You stay in control",
    text: "Nothing publishes without review. Designated approvers check each upload before it enters the knowledge base, and updated documents supersede older versions.",
  },
  {
    label: "Accurate by design",
    text: "Answers about the college come only from approved documents. If the knowledge base lacks an answer, UPC AI says so rather than guessing — so students are never misled.",
  },
];

export default function ForFacultyPage() {
  return (
    <MarketingPage>
      <main id="main">
        <section className={`${styles.container} ${styles.pageHeader}`}>
          <Reveal>
            <p className={styles.sectionKicker}>For faculty &amp; staff</p>
            <h1 className={styles.sectionTitle}>Your documents, answered accurately.</h1>
            <p className={styles.sectionSub}>
              UPC AI is only as official as the documents behind it. Faculty and college staff
              keep it current — and keep students correctly informed.
            </p>
          </Reveal>
        </section>

        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <div className={styles.aboutList} style={{ maxWidth: "100%" }}>
            {ROWS.map((row, i) => (
              <Reveal key={row.label} delay={i * 70}>
                <div className={styles.aboutRow}>
                  <span className={styles.aboutLabel}>{row.label}</span>
                  <p className={styles.aboutText}>{row.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className={`${styles.container} ${styles.ctaSection}`}>
          <Reveal>
            <div className={styles.ctaBand}>
              <h2>Bring your department online.</h2>
              <p>
                Want your documents in UPC AI? Write to us at{" "}
                <a href="mailto:hello@upcai.app" style={{ borderBottom: "1px solid rgba(255,255,255,0.3)" }}>
                  hello@upcai.app
                </a>
              </p>
              <Link href="/signup" className={styles.ctaBtn}>
                Create an Account
              </Link>
            </div>
          </Reveal>
        </section>
      </main>
    </MarketingPage>
  );
}
