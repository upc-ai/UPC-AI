import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "../_components/MarketingPage";
import { Reveal } from "../_components/Reveal";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "Knowledge",
  description: "What's inside the UPC AI knowledge base and how citations work.",
};

const AREAS = [
  { label: "Notices", text: "Circulars and announcements from the college administration, as published." },
  { label: "Fee structure", text: "Course-wise and year-wise fees for every program, from the official schedule." },
  { label: "Timetables", text: "Class schedules for every section and year." },
  { label: "Syllabus", text: "Subject-wise syllabi across courses, used to power study tools." },
  { label: "Scholarships", text: "Latest schemes, eligibility and application steps." },
  { label: "Previous papers", text: "Past exam papers for revision and practice." },
  { label: "Hostel", text: "Hostel rules, allocation and fees." },
  { label: "Library", text: "Library catalogue and usage rules." },
];

export default function KnowledgePage() {
  return (
    <MarketingPage>
      <main id="main">
        <section className={`${styles.container} ${styles.pageHeader}`}>
          <Reveal>
            <p className={styles.sectionKicker}>Knowledge</p>
            <h1 className={styles.sectionTitle}>Every answer, from official documents.</h1>
            <p className={styles.sectionSub}>
              The knowledge base is built from documents approved by the college — not scraped
              from the internet. Here is what it covers and how citations work.
            </p>
          </Reveal>
        </section>

        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <Reveal>
            <h2 className={styles.sectionTitle}>What&apos;s inside</h2>
          </Reveal>
          <div className={styles.aboutList} style={{ maxWidth: "100%" }}>
            {AREAS.map((row, i) => (
              <Reveal key={row.label} delay={i * 60}>
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
              <h2 className={styles.sectionTitle}>How citations work.</h2>
            </Reveal>
            <div className={styles.aboutList} style={{ maxWidth: "100%" }}>
              <Reveal>
                <div className={styles.aboutRow}>
                  <span className={styles.aboutLabel}>Sourced</span>
                  <p className={styles.aboutText}>
                    When you ask a college question, UPC AI searches the approved documents first
                    and answers only from what it finds.
                  </p>
                </div>
              </Reveal>
              <Reveal>
                <div className={styles.aboutRow}>
                  <span className={styles.aboutLabel}>Cited</span>
                  <p className={styles.aboutText}>
                    Every claim in the answer carries a citation — the document name and the exact
                    page it came from. Tap it to see the source.
                  </p>
                </div>
              </Reveal>
              <Reveal>
                <div className={styles.aboutRow}>
                  <span className={styles.aboutLabel}>Refused, not guessed</span>
                  <p className={styles.aboutText}>
                    If the knowledge base doesn&apos;t contain the answer, UPC AI tells you — it
                    never invents official information.
                  </p>
                </div>
              </Reveal>
              <Reveal>
                <div className={styles.aboutRow}>
                  <span className={styles.aboutLabel}>Kept official</span>
                  <p className={styles.aboutText}>
                    College staff upload documents; designated approvers review and publish them.
                    When a rule changes, the updated document supersedes the old one.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className={`${styles.container} ${styles.ctaSection}`}>
          <Reveal>
            <div className={styles.ctaBand}>
              <h2>Ask it anything about campus.</h2>
              <p>Free for every UPC student. Sign up with your college email.</p>
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
