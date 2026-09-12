import Link from "next/link";
import styles from "./landing.module.css";
import { HeroChatDemo } from "./_components/HeroChatDemo";
import { HeritageStats } from "./_components/HeritageStats";
import { Reveal } from "./_components/Reveal";
import { MarketingPage } from "./_components/MarketingPage";
import { FAQS, FaqItem } from "./_components/FAQ";

const FEATURES = [
  {
    icon: "✦",
    title: "Ask anything, get the steps",
    text: "Doubts, derivations, code, exam prep — UPC AI works through the problem with you, shows the reasoning, and adapts from Explain Simply to Challenge Me as you grow.",
  },
  {
    icon: "◈",
    title: "Answers from official documents",
    text: "Fees, exam dates, hostel rules, scholarships — answered only from college-approved documents, with the official source attached. No rumours, no guessing.",
  },
  {
    icon: "⚡",
    title: "Instant, any hour",
    text: "No waiting for office hours or scrolling WhatsApp groups. The answer to most college questions arrives in seconds — at 2 AM during exam week too.",
  },
  {
    icon: "⌘",
    title: "Reads photos & PDFs",
    text: "Snap a photo of a problem or upload the syllabus PDF — UPC AI reads it and works with it directly in the chat.",
  },
  {
    icon: "अ",
    title: "English & Hindi",
    text: "Ask in either language, or mix both — the answer follows the language you think in, Devanagari included.",
  },
  {
    icon: "◎",
    title: "Free for the UPC family",
    text: "Every student and professor of Udai Pratap College gets it free. Sign up in seconds with your Gmail address.",
  },
];

const FOR_STUDENTS = [
  "Instant, cited answers to college questions — fees, forms, deadlines, rules",
  "Step-by-step academic help that shows its work, not just the final answer",
  "Explain Simply when you're starting out; Challenge Me when you're ready",
  "Revision from your own syllabus — quizzes and flashcards that adapt to you",
  "Ask in Hindi or English — the language you're comfortable in",
];

const FOR_FACULTY = [
  "One official source of truth — stop re-answering the same fee and exam questions",
  "Upload a circular once; the AI answers from the latest version, with the source",
  "Your syllabus and past papers become searchable knowledge in seconds",
  "Notices reach students as answers — not as buried PDF links",
  "See what students are actually asking (anonymised) and fix the gaps",
];

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

        {/* ---------------- What is UPC AI (feature cards over ambient) ---------------- */}
        <section id="about" className={`${styles.container} ${styles.section} ${styles.bandSoft}`}>
          <Reveal>
            <p className={styles.sectionKicker}>What is UPC AI</p>
            <h2 className={styles.sectionTitle}>AI for your studies — built on your college.</h2>
            <p className={styles.sectionSub}>
              UPC AI is an AI assistant made for Udai Pratap College. It explains any subject
              step by step, and when a question touches the college — fees, exams, hostel,
              scholarships — it answers only from official documents, with the source attached.
            </p>
          </Reveal>
          <div className={styles.featureGrid}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 60}>
                <div className={styles.featureCard}>
                  <span className={styles.featureIcon} aria-hidden="true">{f.icon}</span>
                  <h3 className={styles.featureTitle}>{f.title}</h3>
                  <p className={styles.featureText}>{f.text}</p>
                </div>
              </Reveal>
            ))}
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

        {/* ---------------- For the whole campus ---------------- */}
        <section id="campus" className={`${styles.container} ${styles.section}`}>
          <Reveal>
            <p className={styles.sectionKicker}>Made for the whole campus</p>
            <h2 className={styles.sectionTitle}>Why students and professors use it daily.</h2>
            <p className={styles.sectionSub}>
              One assistant, two superpowers — study help that explains, and official information
              that&apos;s actually findable.
            </p>
          </Reveal>
          <div className={styles.compareGrid}>
            <Reveal>
              <div className={styles.compareCard}>
                <h3>For students</h3>
                <p>Less hunting, more understanding.</p>
                <ul>
                  {FOR_STUDENTS.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={90}>
              <div className={styles.compareCard}>
                <h3>For professors</h3>
                <p>Your knowledge, amplified.</p>
                <ul>
                  {FOR_FACULTY.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
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
