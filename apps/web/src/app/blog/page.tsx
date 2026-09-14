import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog — What's New in UPC AI",
  description:
    "Every improvement to UPC AI: new models, named search, photo solving, knowledge base growth, and student-requested features.",
  alternates: { canonical: "/blog" },
};

const UPDATES = [
  {
    date: "September 14, 2026",
    title: "Search by name — professors, students, roll numbers",
    body: "Retrieval now treats names and ids as exact matches. Ask for a professor by name or a student by roll number and the right record surfaces first — no more keyword guessing.",
  },
  {
    date: "September 13, 2026",
    title: "Photo solving, hardened end-to-end",
    body: "Images are downscaled before upload so phone photos work every time, vision answers were extended to the full time budget, and a dead stream now tells you honestly instead of hanging.",
  },
  {
    date: "September 12, 2026",
    title: "A new look, true black",
    body: "The app moved to a true-black dark theme with a thought-orb that shows what the AI is doing — thinking, searching college documents, reading sections — and the landing tells the college's real story: 1909, first autonomous college in UP.",
  },
  {
    date: "September 10, 2026",
    title: "The knowledge base is complete",
    body: "262 published documents — syllabi, notices, fees, departments, facilities — verified end-to-end. Answers now cite the official college website, and every refused question is logged so the gaps get filled.",
  },
];

export default function BlogPage() {
  return (
    <main id="main" style={{ fontFamily: "var(--font-body)", color: "var(--ink)", background: "var(--canvas)", minHeight: "100dvh", padding: "clamp(48px, 8vw, 96px) clamp(20px, 6vw, 48px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{ fontSize: 12, fontWeight: 550, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Changelog</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4.5vw, 48px)", fontWeight: 500, margin: "0 0 40px" }}>
          What&apos;s new in UPC AI.
        </h1>
        {UPDATES.map((u) => (
          <article key={u.title} style={{ borderTop: "1px solid var(--hairline, #eee)", padding: "24px 0" }}>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>{u.date}</p>
            <h2 style={{ fontSize: 20, fontWeight: 550, margin: "0 0 8px" }}>{u.title}</h2>
            <p style={{ margin: 0, lineHeight: 1.7, color: "var(--body, #555)" }}>{u.body}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
