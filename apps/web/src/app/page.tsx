import Link from "next/link";
import type { Metadata } from "next";
import { LogoMark } from "@upc/ui";
import { Markdown } from "@/components/chat/Markdown";
import styles from "./landing.module.css";
import { HeroChatDemo } from "./_components/HeroChatDemo";
import { Reveal } from "./_components/Reveal";
import { MarketingPage } from "./_components/MarketingPage";
import { FAQS, FaqItem } from "./_components/FAQ";
import { JsonLd, faqJsonLd } from "./_components/JsonLd";
import { InstallAppButton } from "./_components/InstallAppButton";

export const metadata: Metadata = {
  title: { absolute: "UPC AI" },
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
  { name: "Notices & Circulars", count: "66 official documents" },
  { name: "Syllabus", count: "67 subject-wise syllabi" },
  { name: "Fee Structure", count: "Course-wise, from the official schedule" },
  { name: "Admissions", count: "Process, eligibility, dates" },
  { name: "Faculty & Departments", count: "All 30 departments" },
  { name: "Exams, Hostel & Library", count: "Rules, timings, papers" },
];

export default function LandingPage() {
  return (
    <MarketingPage>
      <main id="main">
        {/* ---------------- Hero (staggered entrance) ---------------- */}
        <section className={`${styles.container} ${styles.hero}`}>
          <div>
            <h1 className={`${styles.heroItem} ${styles.d2} ${styles.heroTitle}`}>
              The Smarter Way to Study with AI.
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
              <InstallAppButton />
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

        {/* ---------------- Product: receipts ---------------- */}
        <section id="knowledge" className={`${styles.bandSoft} ${styles.section}`}>
          <div className={styles.container}>
            <Reveal>
              <p className={styles.sectionKicker}>Answers with receipts</p>
              <h2 className={styles.sectionTitle}>The whole campus, searchable.</h2>
              <p className={styles.sectionSub}>
                Every college answer comes from the approved documents — and carries the
                official source. No rumours, no guesswork.
              </p>
            </Reveal>
            <div className={styles.aboutList} style={{ maxWidth: "100%" }}>
              {KNOWLEDGE_TILES.map((t) => (
                <Reveal key={t.name}>
                  <div className={styles.aboutRow}>
                    <span className={styles.aboutLabel}>{t.name}</span>
                    <p className={styles.aboutText}>{t.count}</p>
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

        {/* ---------------- Product: step-by-step math ---------------- */}
        <section id="math" className={`${styles.bandDark} ${styles.section}`}>
          <div className={`${styles.container} ${styles.productGrid}`}>
            <Reveal>
              <p className={styles.sectionKicker}>Real understanding</p>
              <h2 className={styles.sectionTitle}>Solutions, step by step.</h2>
              <p className={styles.sectionSub}>
                UPC AI doesn&apos;t just give the final answer — it works the derivation with
                you, shows every step, and explains the reasoning behind it.
              </p>
            </Reveal>
            <Reveal delay={90}>
              <div className={styles.mockup}>
                <div className={styles.mockupUser}>Solve: ∫ x²·eˣ dx</div>
                <Markdown content={"By parts — let **u = x²** and **dv = eˣdx**:\n\n$$\\int x^2 e^x\\,dx = e^x(x^2 - 2x + 2) + C$$\n\nDifferentiate the result and it collapses back to the integrand — verified."} />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------------- Product: photo solving ---------------- */}
        <section id="photo" className={`${styles.container} ${styles.section}`}>
          <div className={styles.productGrid}>
            <Reveal>
              <div className={styles.mockup}>
                <div className={styles.msgChip}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>
                  <span>mechanics-problem.jpg</span>
                </div>
                <div className={styles.mockupUser}>Solve this problem.</div>
                <div className={styles.mockupAnswer}>
                  <span className={styles.line}>
                    Reading the problem: a point mass on an inclined plane, friction
                    coefficient μ — set up Newton&apos;s laws along the slope…
                  </span>
                  <span className={styles.line}>a = g(sin θ − μcos θ) <strong>✓ step-by-step solution follows</strong></span>
                </div>
              </div>
            </Reveal>
            <Reveal delay={90}>
              <div style={{ alignSelf: "center" }}>
                <p className={styles.sectionKicker}>Show it a photo</p>
                <h2 className={styles.sectionTitle}>Snap the problem. Get the method.</h2>
                <p className={styles.sectionSub}>
                  Photograph a handwritten problem or upload a PDF — UPC AI reads it and
                  teaches the solution the way a good teacher would: method first, answer last.
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
          <div className={styles.faqList}>
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={Math.min(i * 50, 200)}>
                <FaqItem q={f.q} a={f.a} defaultOpen={i === 0} />
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className={styles.prose} style={{ margin: "var(--space-lg) auto 0", textAlign: "center" }}>
              More questions? <Link href="/faq">Visit the full help center</Link>.
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
