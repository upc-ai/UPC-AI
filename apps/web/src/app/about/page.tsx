import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "../_components/MarketingPage";
import { Reveal } from "../_components/Reveal";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "About",
  description: "What UPC AI is, how it works, and the college behind it.",
};

const HOW_IT_WORKS = [
  {
    label: "Ask",
    text: "Type your question in English or Hindi — academic doubts, fee structures, exam schedules, anything campus-related.",
  },
  {
    label: "Search",
    text: "UPC AI searches the college's approved documents first — circulars, fee structures, syllabi, notices — not the open internet.",
  },
  {
    label: "Answer",
    text: "You get a direct answer with the exact document and page cited. If the evidence isn't there, UPC AI says so instead of guessing.",
  },
];

const COLLEGE = [
  {
    label: "Founder",
    text: "Founded by Rajarshi Udai Pratap Singh Ju Deo, the philosopher-king after whom the college is named.",
  },
  {
    label: "Campus",
    text: "A 100-acre campus in Varanasi, Uttar Pradesh.",
  },
  {
    label: "Status",
    text: "NAAC-accredited and UGC-autonomous — with autonomy extended through 2032-33.",
  },
  {
    label: "Programs",
    text: "Undergraduate, postgraduate, vocational and doctoral programs, plus B.Ed. and B.Sc. Agriculture.",
  },
  {
    label: "Reach",
    text: "One of eastern Uttar Pradesh's leading institutions of higher education.",
  },
];

export default function AboutPage() {
  return (
    <MarketingPage>
      <main id="main">
        <section className={`${styles.container} ${styles.pageHeader}`}>
          <Reveal>
            <p className={styles.sectionKicker}>About UPC AI</p>
            <h1 className={styles.sectionTitle}>The official AI assistant of Udai Pratap College.</h1>
            <p className={styles.sectionSub}>
              One assistant for the whole campus — academic help that reasons step by step,
              and official college information that always cites its source.
            </p>
          </Reveal>
        </section>

        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <Reveal>
            <div className={styles.prose}>
              <h3>What UPC AI is</h3>
              <p>
                UPC AI is an AI assistant built for the students and faculty of Udai Pratap
                College, Varanasi. It answers academic questions — doubts, derivations, code,
                exam preparation — and official college questions — fees, exams, notices,
                timetables — in one place, in English and Hindi.
              </p>
              <p>
                College information comes only from documents approved by the college itself.
                Every such answer shows exactly which document and page it came from, so you can
                verify it yourself. When the knowledge base doesn&apos;t contain an answer, UPC AI
                says so — it never guesses about official matters.
              </p>
              <h3>How it works</h3>
            </div>
          </Reveal>
          <div className={styles.aboutList} style={{ maxWidth: "100%" }}>
            {HOW_IT_WORKS.map((row, i) => (
              <Reveal key={row.label} delay={i * 70}>
                <div className={styles.aboutRow}>
                  <span className={styles.aboutLabel}>{row.label}</span>
                  <p className={styles.aboutText}>{row.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className={`${styles.bandSoft} ${styles.section}`}>
          <div className={styles.container}>
            <Reveal>
              <p className={styles.sectionKicker}>The college</p>
              <h2 className={styles.sectionTitle}>Udai Pratap Autonomous College</h2>
              <p className={styles.sectionSub}>
                UPC AI serves the Udai Pratap College community — an institution that has been a
                centre of higher education in Varanasi for generations.
              </p>
            </Reveal>
            <div className={styles.aboutList} style={{ maxWidth: "100%" }}>
              {COLLEGE.map((row, i) => (
                <Reveal key={row.label} delay={i * 70}>
                  <div className={styles.aboutRow}>
                    <span className={styles.aboutLabel}>{row.label}</span>
                    <p className={styles.aboutText}>{row.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal>
              <p className={styles.prose} style={{ marginTop: "var(--space-lg)" }}>
                Learn more at{" "}
                <a href="https://www.upcollege.ac.in/" target="_blank" rel="noreferrer">
                  upcollege.ac.in
                </a>
                .
              </p>
            </Reveal>
          </div>
        </section>

        <section className={`${styles.container} ${styles.ctaSection}`}>
          <Reveal>
            <div className={styles.ctaBand}>
              <h2>Ready to study smarter?</h2>
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
