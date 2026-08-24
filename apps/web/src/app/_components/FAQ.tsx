import styles from "../landing.module.css";

/** FAQ data — shared by the landing section and the /faq page. */
export const FAQS = [
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

export function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
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
