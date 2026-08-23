import Link from "next/link";
import styles from "./landing.module.css";
import { HeroChatDemo } from "./_components/HeroChatDemo";
import { LandingNav } from "./_components/LandingNav";
import { Reveal } from "./_components/Reveal";
import { Wordmark } from "@upc/ui";

const ABOUT = [
  {
    label: "Academic help",
    text: "Step-by-step solutions, derivations and code help for any subject — with Explain Simply and Challenge Me study modes.",
  },
  {
    label: "Official answers",
    text: "Fees, exams, notices, timetables and rules are answered from approved college documents, with the exact source cited. If the evidence isn't there, UPC AI says so instead of guessing.",
  },
  {
    label: "Images & PDFs",
    text: "Send a photo of a problem or a PDF — UPC AI reads it and works with it directly in the chat.",
  },
  {
    label: "English & Hindi",
    text: "Ask in either language, or mix both — answers follow the language you use.",
  },
  {
    label: "Study tools",
    text: "Quizzes generated from your syllabus and flashcards that schedule themselves with spaced repetition.",
  },
  {
    label: "Free & private",
    text: "Free for the UPC community. Sign up in seconds — conversations stay private and are never shared.",
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

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <LandingNav />

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

        {/* ---------------- Trust strip ---------------- */}
        <Reveal>
          <div className={styles.strip}>
            Used by 5,000+ students across 12 departments at Udai Pratap College, Varanasi
          </div>
        </Reveal>

        {/* ---------------- About UPC AI (glass cards over ambient) ---------------- */}
        <section id="about" className={`${styles.container} ${styles.section} ${styles.bandSoft}`}>
          <Reveal>
            <p className={styles.sectionKicker}>About UPC AI</p>
            <h2 className={styles.sectionTitle}>One assistant for the whole campus.</h2>
            <p className={styles.sectionSub}>
              The official AI assistant of Udai Pratap College — built for students and faculty,
              grounded in the college&apos;s own documents, and free for the UPC community.
            </p>
          </Reveal>
          <div className={styles.aboutList}>
            {ABOUT.map((row) => (
              <Reveal key={row.label}>
                <div className={styles.aboutRow}>
                  <span className={styles.aboutLabel}>{row.label}</span>
                  <p className={styles.aboutText}>{row.text}</p>
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

        {/* ---------------- Testimonial ---------------- */}
        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <Reveal>
            <blockquote className={styles.quote}>
              “I found the exact revised fee structure in seconds — with the official document
              attached. No WhatsApp groups, no rumours.”
            </blockquote>
            <div className={styles.quoteBy}>
              <span className={styles.quoteAvatar}>RS</span>
              <span className={styles.quoteName}>Rahul Sharma · BSc CS, 2nd Year</span>
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
              <p>Free for every UPC student. Sign up with your college email.</p>
              <Link href="/signup" className={styles.ctaBtn}>
                Get Started Free
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <Wordmark size={18} />
              <span className={styles.footerCollege}>
                The official AI assistant of<br />Udai Pratap College, Varanasi
              </span>
              <div className={styles.footerSocial}>
                <a href="https://instagram.com/upc.ai" target="_blank" rel="noreferrer" aria-label="UPC AI on Instagram (@upc.ai)" title="@upc.ai on Instagram">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" />
                  </svg>
                  @upc.ai
                </a>
                <a href="https://x.com/upc_ai" target="_blank" rel="noreferrer" aria-label="UPC AI on X (@upc_ai)" title="@upc_ai on X">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.81-5.96 6.81H1.68l7.74-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.84L7.02 4.13H5.04l12.04 15.64Z" />
                  </svg>
                  @upc_ai
                </a>
                <a href="mailto:hello@helloupcai.app" aria-label="Email UPC AI" title="hello@helloupcai.app">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /><path d="m3.5 6.5 8.5 6 8.5-6" />
                  </svg>
                  hello@helloupcai.app
                </a>
              </div>
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
            © {new Date().getFullYear()} UPC AI · upcai.app · Udai Pratap College, Varanasi · Made with care for students
          </div>
        </div>
      </footer>
    </div>
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
