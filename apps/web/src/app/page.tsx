import Link from "next/link";
import type { Metadata } from "next";
import { LogoMark } from "@upc/ui";
import styles from "./landing.module.css";
import { HeroChatDemo } from "./_components/HeroChatDemo";
import { Reveal } from "./_components/Reveal";
import { MarketingPage } from "./_components/MarketingPage";
import { FAQS } from "./_components/FAQ";
import { JsonLd, faqJsonLd } from "./_components/JsonLd";

export const metadata: Metadata = {
  title: {
    absolute:
      "UPC AI — Official AI Assistant of Udai Pratap College, Varanasi | Fees, Syllabus, Notices",
  },
  description:
    "Ask anything about Udai Pratap Autonomous College, Varanasi — fees, syllabus, admissions, exams, hostel, faculty — answered from approved college documents with citations. Free for students, English and Hindi.",
  alternates: { canonical: "/" },
};

const FOR_STUDENTS = {
  label: "For students",
  lead: "Less hunting, more understanding.",
  text: "The revised fee figure in seconds, with the official document it came from. A derivation worked through line by line, not just the final answer. Revision built from your own syllabus. Answers in Hindi or English, at 2 AM if that's when you study — free, for your whole degree.",
};

const FOR_FACULTY = {
  label: "For professors",
  lead: "Your knowledge, amplified.",
  text: "One assistant answers the same fifty routine questions so you don't have to. Upload a circular once — every student who asks gets the official version, source attached. Your notes and past papers become searchable knowledge. And an anonymised list of what students ask most shows you exactly where the confusion is.",
};

const KNOWLEDGE_TILES = [
  { name: "Notices", count: "66 documents", mono: "N", href: "/college/notices" },
  { name: "Fee Structure", count: "Ask the AI", mono: "₹", href: "/chat" },
  { name: "Timetables", count: "Ask the AI", mono: "T", href: "/chat" },
  { name: "Syllabus", count: "67 documents", mono: "S", href: "/college/syllabus" },
  { name: "Scholarships", count: "Ask the AI", mono: "Sch", href: "/chat" },
  { name: "Previous Papers", count: "6 papers", mono: "P", href: "/college/study-material" },
  { name: "Hostel", count: "Ask the AI", mono: "H", href: "/chat" },
  { name: "Library", count: "Ask the AI", mono: "L", href: "/chat" },
];

export default function LandingPage() {
  return (
    <MarketingPage>
      <main id="main">
        {/* ---------------- Hero (staggered entrance) ---------------- */}
        <section className={`${styles.container} ${styles.hero}`}>
          <div>
            <span className={`${styles.heroItem} ${styles.d1} ${styles.heroBadge}`}>
              OFFICIAL · UDAI PRATAP COLLEGE
            </span>
            <h1 className={`${styles.heroItem} ${styles.d2} ${styles.heroTitle}`}>
              The AI that knows your college.
            </h1>
            <p className={`${styles.heroItem} ${styles.d3} ${styles.heroSub}`}>
              Meet UPC AI — the official assistant of Udai Pratap College. It knows your
              courses, your campus and your curriculum, answers with citations, in English
              and Hindi.
            </p>
            <div className={`${styles.heroItem} ${styles.d4} ${styles.heroCtas}`}>
              <Link href="/signup" className={styles.btnPrimary}>
                Get Started Free
              </Link>
              <a href="#product" className={styles.heroSecondary}>See it in action →</a>
            </div>
          </div>
          <div className={`${styles.heroItem} ${styles.d5}`}>
            <HeroChatDemo />
          </div>
        </section>

        {/* ---------------- What is UPC AI (editorial prose) ---------------- */}
        <section id="about" className={`${styles.container} ${styles.section} ${styles.bandSoft}`}>
          <Reveal>
            <p className={styles.sectionKicker}>What is UPC AI</p>
            <h2 className={styles.sectionTitle}>AI for your studies —<br />built on your college.</h2>
          </Reveal>
          <div className={styles.proseSection}>
            <Reveal>
              <p className={styles.proseLead}>
                UPC AI is an AI assistant made for Udai Pratap College. Ask anything in plain
                English or Hindi — it thinks, searches and answers in seconds. What makes it
                different is what it knows: your college, its documents, your syllabus.
              </p>
            </Reveal>
            <Reveal delay={70}>
              <p>
                Stuck on a derivation at midnight? It works through the steps with you and shows
                its reasoning — from Explain Simply up to Challenge Me. Photograph a problem or
                upload a PDF and it reads them directly in the chat.
              </p>
            </Reveal>
            <Reveal delay={140}>
              <p>
                When a question touches the college — fees, exams, hostels, scholarships — it
                answers only from official, approved documents and attaches the source. If the
                evidence isn&apos;t there, it says so instead of guessing. Free for every student
                and professor of the college.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------------- Product band (dark glass) ---------------- */}
        <section id="product" className={`${styles.bandDark} ${styles.section}`}>
          <div className={`${styles.container} ${styles.productGrid}`}>
            <Reveal>
              <p className={styles.sectionKicker}>Grounded in official documents</p>
              <h2 className={styles.sectionTitle}>Every answer shows its source.</h2>
              <p className={styles.sectionSub}>
                UPC AI doesn&apos;t guess. When you ask about fees, exams or rules, it searches the
                college&apos;s approved documents, cites the exact page, and refuses to answer when
                the evidence isn&apos;t there.
              </p>
              <button className={styles.darkLink}>See how retrieval works →</button>
            </Reveal>
            <Reveal delay={90}>
              <div className={styles.codeWindow} aria-label="Example of UPC AI solving a question">
                <div><span className="ln">1</span><span className="com">{"// Asked: Solve the integral"}</span></div>
                <div><span className="ln">2</span>∫ x²·eˣ dx</div>
                <div><span className="ln">3</span><span className="com">{"// By parts, u = x², dv = eˣdx"}</span></div>
                <div><span className="ln">4</span>= x²eˣ − ∫ 2x·eˣ dx</div>
                <div><span className="ln">5</span>= x²eˣ − 2(xeˣ − eˣ) + C</div>
                <div><span className="ln">6</span><span className="kw">return</span> eˣ(x² − <span className="num">2x</span> + <span className="num">2</span>) + C <span className="fn">✓ verified</span></div>
              </div>
              <div className={styles.sourceChip} aria-label="Every college answer carries the official source">
                <LogoMark size={14} />
                <span>Udai Pratap College — Official Website</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <p className={styles.sourceNote}>Every college answer carries this official source — or UPC AI says it doesn&apos;t know.</p>
            </Reveal>
          </div>
        </section>

        {/* ---------------- Knowledge tiles ---------------- */}
        <section id="knowledge" className={`${styles.bandSoft} ${styles.section}`}>
          <div className={styles.container}>
            <Reveal>
              <p className={styles.sectionKicker}>College knowledge</p>
              <h2 className={styles.sectionTitle}>The whole campus, searchable.</h2>
              <p className={styles.sectionSub}>
                Browse the knowledge base directly, or let the AI find it for you.
              </p>
            </Reveal>
            <div className={styles.aboutList} style={{ maxWidth: "100%" }}>
              {KNOWLEDGE_TILES.map((t) => (
                <Reveal key={t.name}>
                  <Link href={t.href} className={styles.collegeCatLink}>
                    <div className={styles.aboutRow}>
                      <span className={styles.aboutLabel}>{t.name}</span>
                      <p className={styles.aboutText}>{t.count} →</p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- For the whole campus (editorial rows) ---------------- */}
        <section id="campus" className={`${styles.container} ${styles.section}`}>
          <Reveal>
            <p className={styles.sectionKicker}>Made for the whole campus</p>
            <h2 className={styles.sectionTitle}>Why students and professors use it daily.</h2>
          </Reveal>
          <div className={styles.aboutList}>
            <Reveal>
              <div className={styles.aboutRow}>
                <span className={styles.aboutLabel}>{FOR_STUDENTS.label}</span>
                <p className={styles.aboutText}>
                  <strong>{FOR_STUDENTS.lead}</strong> {FOR_STUDENTS.text}
                </p>
              </div>
            </Reveal>
            <Reveal delay={70}>
              <div className={styles.aboutRow}>
                <span className={styles.aboutLabel}>{FOR_FACULTY.label}</span>
                <p className={styles.aboutText}>
                  <strong>{FOR_FACULTY.lead}</strong> {FOR_FACULTY.text}
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------------- Study tools ---------------- */}
        <section id="study" className={`${styles.container} ${styles.section}`}>
          <Reveal>
            <p className={styles.sectionKicker}>Study tools</p>
            <h2 className={styles.sectionTitle}>Quizzes that know your syllabus.</h2>
            <p className={styles.sectionSub}>
              Generate a quiz on any topic in seconds. Flashcards schedule themselves with spaced
              repetition — review what you&apos;re about to forget, skip what you know.
            </p>
          </Reveal>
        </section>

        {/* ---------------- Heritage (one quiet line + the founder's words) ---------------- */}
        <section id="heritage" className={`${styles.container} ${styles.section}`}>
          <Reveal>
            <p className={styles.sectionKicker}>A century of learning</p>
            <h2 className={styles.sectionTitle}>The college behind the AI.</h2>
            <p className={styles.sectionSub}>
              Established 1909 · First autonomous college in Uttar Pradesh · NAAC &apos;A&apos;
              accredited · 30 departments, 5 faculties · 100-acre campus in Varanasi.
            </p>
          </Reveal>
        </section>

        {/* ---------------- Founder quote (real words, from the college archives) ---------------- */}
        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <Reveal>
            <blockquote className={styles.quote}>
              “Knowledge was given to man to bless and not to harass mankind — to lift the
              fallen, to wipe away tears.”
            </blockquote>
            <div className={styles.quoteBy}>
              <span className={styles.quoteAvatar}>RU</span>
              <span className={styles.quoteName}>
                Rajarshi Udai Pratap Singh Ju Deo · Founder, 1909
              </span>
            </div>
          </Reveal>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section id="faq" className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <Reveal>
            <h2 className={styles.sectionTitle} style={{ textAlign: "center" }}>Questions, answered.</h2>
          </Reveal>
          <JsonLd data={faqJsonLd(FAQS)} />
          <Reveal>
            <p className={styles.prose} style={{ margin: "0 auto", textAlign: "center" }}>
              Everything students and faculty ask — <Link href="/faq">read the full FAQ</Link>,
              or <Link href="/chat">just ask UPC AI</Link>.
            </p>
          </Reveal>
        </section>

        {/* ---------------- CTA band (dark glass panel) ---------------- */}
        <section id="faculty" className={`${styles.container} ${styles.ctaSection}`}>
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
