import Link from "next/link";
import styles from "./landing.module.css";
import { HeroChatDemo } from "./_components/HeroChatDemo";
import { LogoMark } from "@upc/ui";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Knowledge", href: "#knowledge" },
  { label: "Study Tools", href: "#study" },
  { label: "For Faculty", href: "#faculty" },
  { label: "FAQ", href: "#faq" },
];

const FEATURES = [
  {
    title: "Academic AI",
    text: "Ask doubts from any subject — get step-by-step solutions, derivations, and code with verification. Speaks English and Hindi.",
    icon: "graduation",
  },
  {
    title: "College Knowledge",
    text: "Fees, exams, notices, timetables — answered instantly from official college documents, always with citations.",
    icon: "landmark",
  },
  {
    title: "Study Tools",
    text: "AI-generated quizzes and spaced-repetition flashcards built from your syllabus. Study smarter, not longer.",
    icon: "notebook",
  },
];

const KNOWLEDGE_TILES = [
  { name: "Notices", count: "250+ documents", mono: "N" },
  { name: "Fee Structure", count: "All courses", mono: "₹" },
  { name: "Timetables", count: "Every section", mono: "T" },
  { name: "Syllabus", count: "All subjects", mono: "S" },
  { name: "Scholarships", count: "Latest schemes", mono: "Sch" },
  { name: "Previous Papers", count: "5 years", mono: "P" },
  { name: "Hostel", count: "Rules & fees", mono: "H" },
  { name: "Library", count: "Catalogue", mono: "L" },
];

const FAQS = [
  {
    q: "Is UPC AI free for students?",
    a: "Yes. UPC AI is free for every student and faculty member of Udai Pratap College with a college email address.",
  },
  {
    q: "How accurate are the answers?",
    a: "Every college-related answer is generated only from approved official documents and shows its source with page numbers. If the knowledge base doesn't contain an answer, UPC AI says so — it never guesses.",
  },
  {
    q: "Does it work in Hindi?",
    a: "Yes. Ask in Hindi or flip the language toggle — UPC AI answers in Hindi (Devanagari), and it understands mixed English-Hindi questions.",
  },
  {
    q: "Can I use it on my phone?",
    a: "Yes — UPC AI works in any phone browser and can be installed to your home screen like an app.",
  },
  {
    q: "Who maintains the knowledge base?",
    a: "College staff upload official documents; designated approvers review and publish them. Every answer cites the exact document version it came from.",
  },
  {
    q: "What can I ask UPC AI?",
    a: "Anything academic — doubts, derivations, code, exam prep — plus official college information: fees, exam schedules, hostel rules, scholarships, timetables and more.",
  },
];

function FeatureIcon({ name }: { name: string }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "graduation":
      return (
        <svg {...common}>
          <path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
        </svg>
      );
    case "landmark":
      return (
        <svg {...common}>
          <path d="M3 22h18" /><path d="M6 18v-7" /><path d="M10 18v-7" /><path d="M14 18v-7" /><path d="M18 18v-7" /><path d="m12 2 9 5H3l9-5Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      );
  }
}

export default function LandingPage() {
  return (
    <>
      {/* ---------------- Top nav ---------------- */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: 18, fontWeight: 500 }}>
              <LogoMark size={20} />
              UPC&nbsp;AI
            </span>
          </Link>
          <nav className={styles.navLinks} aria-label="Main">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className={styles.navLink}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className={styles.navActions}>
            <Link href="/login" className={styles.signIn}>Sign in</Link>
            <Link
              href="/signup"
              style={{
                background: "var(--primary)",
                color: "var(--on-primary)",
                borderRadius: "var(--radius-md)",
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "var(--font-body)",
                textDecoration: "none",
                minHeight: 40,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Try UPC AI
            </Link>
          </div>
          <button className={styles.hamburger} aria-label="Open menu">
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
      </header>

      <main id="main">
        {/* ---------------- Hero ---------------- */}
        <section className={`${styles.container} ${styles.hero}`}>
          <div>
            <span className={styles.heroBadge}>OFFICIAL · UDAI PRATAP COLLEGE</span>
            <h1 className={styles.heroTitle}>Meet your thinking partner for campus.</h1>
            <p className={styles.heroSub}>
              The official AI assistant that knows your courses, your campus, and your
              curriculum — inside and out. Answers with citations, in English and Hindi.
            </p>
            <div className={styles.heroCtas}>
              <Link
                href="/signup"
                style={{
                  background: "var(--primary)",
                  color: "var(--on-primary)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px 24px",
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "var(--font-body)",
                  textDecoration: "none",
                  minHeight: 48,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Get Started Free
              </Link>
              <a href="#product" className={styles.heroSecondary}>See it in action →</a>
            </div>
          </div>
          <HeroChatDemo />
        </section>

        {/* ---------------- Trust strip ---------------- */}
        <div className={styles.strip}>
          Used by 5,000+ students across 12 departments at Udai Pratap College, Varanasi
        </div>

        {/* ---------------- Features (cream cards) ---------------- */}
        <section id="features" className={`${styles.container} ${styles.section} ${styles.bandCream}`}>
          <p className={styles.sectionKicker}>Everything in one place</p>
          <h2 className={styles.sectionTitle}>Three tools. One assistant.</h2>
          <p className={styles.sectionSub}>
            Students shouldn't need five apps and a WhatsApp group to study and stay informed.
          </p>
          <div className={styles.featureGrid}>
            {FEATURES.map((f) => (
              <article key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <FeatureIcon name={f.icon} />
                </div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureText}>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------------- Product band (dark) ---------------- */}
        <section id="product" className={`${styles.bandDark} ${styles.section}`}>
          <div className={`${styles.container} ${styles.productGrid}`}>
            <div>
              <p className={styles.sectionKicker}>Grounded in official documents</p>
              <h2 className={styles.sectionTitle}>Every answer shows its source.</h2>
              <p className={styles.sectionSub}>
                UPC AI doesn't guess. When you ask about fees, exams or rules, it searches the
                college's approved documents, cites the exact page, and refuses to answer when
                the evidence isn't there.
              </p>
              <button className={styles.darkLink}>See how retrieval works →</button>
            </div>
            <div className={styles.codeWindow} aria-label="Example of UPC AI solving a question">
              <div><span className="ln">1</span><span className="com">// Asked: Solve the integral</span></div>
              <div><span className="ln">2</span>∫ x²·eˣ dx</div>
              <div><span className="ln">3</span><span className="com">// By parts, u = x², dv = eˣdx</span></div>
              <div><span className="ln">4</span>= x²eˣ − ∫ 2x·eˣ dx</div>
              <div><span className="ln">5</span>= x²eˣ − 2(xeˣ − eˣ) + C</div>
              <div><span className="ln">6</span><span className="kw">return</span> eˣ(x² − <span className="num">2x</span> + <span className="num">2</span>) + C <span className="fn">✓ verified</span></div>
            </div>
          </div>
        </section>

        {/* ---------------- Comparison ---------------- */}
        <section className={`${styles.container} ${styles.section}`}>
          <p className={styles.sectionKicker}>Two kinds of answers</p>
          <h2 className={styles.sectionTitle}>Ask anything. Or ask officially.</h2>
          <div className={styles.compareGrid} style={{ marginTop: "var(--space-xxl)" }}>
            <article className={styles.compareCard}>
              <h3>Academic AI</h3>
              <p>An open tutor for reasoning and problem-solving:</p>
              <ul>
                <li>Step-by-step math, physics, chemistry solutions</li>
                <li>Code help with explanations</li>
                <li>Ask in English, Hindi, or both</li>
                <li>Explain Simply &amp; Challenge Me study modes</li>
              </ul>
            </article>
            <article className={styles.compareCard}>
              <h3>Official answers</h3>
              <p>College facts, grounded and cited:</p>
              <ul>
                <li>Fee structures for every course and year</li>
                <li>Exam schedules, notices, timetables</li>
                <li>Hostel, library, scholarship rules</li>
                <li>Every claim linked to its source document</li>
              </ul>
            </article>
          </div>
        </section>

        {/* ---------------- Knowledge tiles ---------------- */}
        <section id="knowledge" className={`${styles.bandSoft} ${styles.section}`}>
          <div className={styles.container}>
            <p className={styles.sectionKicker}>College knowledge</p>
            <h2 className={styles.sectionTitle}>The whole campus, searchable.</h2>
            <p className={styles.sectionSub}>
              Browse the knowledge base directly, or let the AI find it for you.
            </p>
            <div className={styles.tileGrid}>
              {KNOWLEDGE_TILES.map((t) => (
                <div key={t.name} className={styles.tile}>
                  <span className={styles.tileMono}>{t.mono}</span>
                  <span>
                    <span className={styles.tileName}>{t.name}</span>
                    <br />
                    <span className={styles.tileCount}>{t.count}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Study tools ---------------- */}
        <section id="study" className={`${styles.container} ${styles.section}`}>
          <p className={styles.sectionKicker}>Study tools</p>
          <h2 className={styles.sectionTitle}>Quizzes that know your syllabus.</h2>
          <p className={styles.sectionSub}>
            Generate a quiz on any topic in seconds. Flashcards schedule themselves with spaced
            repetition — review what you're about to forget, skip what you know.
          </p>
        </section>

        {/* ---------------- Testimonial ---------------- */}
        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <blockquote className={styles.quote}>
            “I found the exact revised fee structure in seconds — with the official document
            attached. No WhatsApp groups, no rumours.”
          </blockquote>
          <div className={styles.quoteBy}>
            <span className={styles.quoteAvatar}>RS</span>
            <span className={styles.quoteName}>Rahul Sharma · BSc CS, 2nd Year</span>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section id="faq" className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <h2 className={styles.sectionTitle} style={{ textAlign: "center" }}>Questions, answered.</h2>
          <div className={styles.faqList} style={{ marginTop: "var(--space-xxl)" }}>
            {FAQS.map((f, i) => (
              <FaqItem key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} />
            ))}
          </div>
        </section>

        {/* ---------------- Coral CTA ---------------- */}
        <section id="faculty" className={styles.ctaBand}>
          <h2>Ready to study smarter?</h2>
          <p>Free for every UPC student. Sign up with your college email.</p>
          <Link
            href="/signup"
            style={{
              background: "var(--canvas)",
              color: "var(--ink)",
              borderRadius: "var(--radius-md)",
              padding: "14px 24px",
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "var(--font-body)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              minHeight: 48,
            }}
          >
            Get Started Free
          </Link>
        </section>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--on-dark)", fontSize: 18, fontWeight: 500 }}>
                <LogoMark size={20} /> UPC&nbsp;AI
              </span>
              <span className={styles.footerCollege}>
                The official AI assistant of<br />Udai Pratap College, Varanasi
              </span>
            </div>
            {[
              { h: "Product", links: ["Features", "Knowledge", "Study Tools", "Quiz"] },
              { h: "College", links: ["For Faculty", "Admin Portal", "Partnership"] },
              { h: "Resources", links: ["Help Center", "Documentation", "Contact"] },
              { h: "Legal", links: ["Privacy Policy", "Terms of Service", "Accessibility"] },
            ].map((col) => (
              <div key={col.h} className={styles.footerCol}>
                <h4>{col.h}</h4>
                <ul>
                  {col.links.map((l) => (
                    <li key={l}><a href="#">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className={styles.footerBottom}>
            © {new Date().getFullYear()} UPC AI · Udai Pratap College, Varanasi · Made with care for students
          </div>
        </div>
      </footer>
    </>
  );
}

function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  return (
    <details className={styles.faqItem} open={defaultOpen}>
      <summary className={styles.faqQ}>
        {q}
        <svg className={styles.faqChevron} width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <p className={styles.faqA}>{a}</p>
    </details>
  );
}
