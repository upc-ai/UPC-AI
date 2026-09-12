import Link from "next/link";
import styles from "./landing.module.css";
import { HeroChatDemo } from "./_components/HeroChatDemo";
import { HeritageStats } from "./_components/HeritageStats";
import { Reveal } from "./_components/Reveal";
import { MarketingPage } from "./_components/MarketingPage";
import { FAQS, FaqItem } from "./_components/FAQ";

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
  { name: "Notices", count: "260+ documents", mono: "N" },
  { name: "Fee Structure", count: "All courses", mono: "₹" },
  { name: "Timetables", count: "Every section", mono: "T" },
  { name: "Syllabus", count: "All subjects", mono: "S" },
  { name: "Scholarships", count: "Latest schemes", mono: "Sch" },
  { name: "Previous Papers", count: "Past papers", mono: "P" },
  { name: "Hostel", count: "Rules & fees", mono: "H" },
  { name: "Library", count: "Catalogue", mono: "L" },
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
              Meet your thinking partner for campus.
            </h1>
            <p className={`${styles.heroItem} ${styles.d3} ${styles.heroSub}`}>
              The official AI assistant that knows your courses, your campus, and your
              curriculum — inside and out. Answers with citations, in English and Hindi.
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

        {/* ---------------- Trust strip (real college facts) ---------------- */}
        <Reveal>
          <div className={styles.strip}>
            Established 1909 · First autonomous college in Uttar Pradesh · NAAC &apos;A&apos;
            Accredited · 30 departments, 5 faculties
          </div>
        </Reveal>

        {/* ---------------- What is UPC AI (editorial prose, no card grid) ---------------- */}
        <section id="about" className={`${styles.container} ${styles.section} ${styles.bandSoft}`}>
          <Reveal>
            <p className={styles.sectionKicker}>What is UPC AI</p>
            <h2 className={styles.sectionTitle}>AI for your studies —<br />built on your college.</h2>
          </Reveal>
          <div className={styles.proseSection}>
            <Reveal>
              <p className={styles.proseLead}>
                UPC AI is an AI assistant made for Udai Pratap College. It works like the AI
                tools you already know — ask anything, in plain English or Hindi, and it thinks,
                searches and answers in seconds. What makes it different is what it knows:
                your college, its documents, your syllabus.
              </p>
            </Reveal>
            <Reveal delay={70}>
              <p>
                Studying with it is simple. Stuck on a derivation at midnight? It works through
                the steps with you and shows its reasoning. Starting from zero, ask it to explain
                simply; ready to be pushed, switch to Challenge Me. Photograph a problem or
                upload a PDF and it reads them directly in the chat.
              </p>
            </Reveal>
            <Reveal delay={140}>
              <p>
                When a question touches the college — fees, exams, hostels, scholarships — it
                answers only from official, approved documents and attaches the source. If the
                evidence isn&apos;t there, it says so instead of guessing. No rumours, no
                out-of-date PDFs, no waiting for office hours.
              </p>
            </Reveal>
            <Reveal delay={210}>
              <p>
                It is free for every student and professor of the college, private by design,
                and made for how UPC actually studies — including Hindi.
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
            <div className={styles.tileGrid}>
              {KNOWLEDGE_TILES.map((t, i) => (
                <Reveal key={t.name} delay={(i % 4) * 60}>
                  <div className={styles.tile}>
                    <span className={styles.tileMono}>{t.mono}</span>
                    <span>
                      <span className={styles.tileName}>{t.name}</span>
                      <br />
                      <span className={styles.tileCount}>{t.count}</span>
                    </span>
                  </div>
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

        {/* ---------------- Heritage — real milestones (replaces the old placeholder testimonial) ---------------- */}
        <section id="heritage" className={`${styles.container} ${styles.section}`}>
          <Reveal>
            <p className={styles.sectionKicker}>A century of learning</p>
            <h2 className={styles.sectionTitle}>The college behind the AI.</h2>
            <p className={styles.sectionSub}>
              Udai Pratap College has stood in Varanasi since 1909 — the knowledge base behind
              every answer is its own.
            </p>
          </Reveal>
          <HeritageStats />
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
          <div className={styles.faqList}>
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={Math.min(i * 50, 200)}>
                <FaqItem q={f.q} a={f.a} defaultOpen={i === 0} />
              </Reveal>
            ))}
          </div>
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
