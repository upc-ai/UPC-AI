import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guide — How to Use UPC AI",
  description:
    "How to get the best answers from UPC AI: asking about fees and exams, solving problems step by step, sending photos, using study modes, and switching to Hindi.",
  alternates: { canonical: "/guide" },
};

const STEPS = [
  {
    h: "Ask like you'd ask a teacher",
    p: "\u201CWhat is the BSc CS fee for 2nd year?\u201D — college questions get answers from official documents, with the official source attached. If the documents don't contain it, UPC AI says so instead of guessing.",
  },
  {
    h: "Snap a photo of the problem",
    p: "Tap the attachment icon and send a photo of a handwritten question. UPC AI reads it and teaches the solution step by step — method first, answer last.",
  },
  {
    h: "Choose how hard it pushes you",
    p: "Explain Simply breaks topics down from zero. Challenge Me pushes you with harder follow-ups. Switch modes in the composer at any time.",
  },
  {
    h: "Ask in Hindi or English",
    p: "Flip the language toggle or just write in Hindi — answers follow the language you use, Devanagari included.",
  },
  {
    h: "Pick your speed",
    p: "UPC-1 answers instantly, Plus balances depth, and Pro thinks harder for the toughest problems. Switch models from the composer menu.",
  },
  {
    h: "What it won't do",
    p: "It never invents official information. If the approved documents don't contain an answer about the college, it tells you — that honesty is the point.",
  },
];

export default function GuidePage() {
  return (
    <main id="main" style={{ fontFamily: "var(--font-body)", color: "var(--ink)", background: "var(--canvas)", minHeight: "100dvh", padding: "clamp(48px, 8vw, 96px) clamp(20px, 6vw, 48px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{ fontSize: 12, fontWeight: 550, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Guide</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4.5vw, 48px)", fontWeight: 500, margin: "0 0 16px" }}>
          Get the most out of UPC AI.
        </h1>
        <p style={{ lineHeight: 1.7, color: "var(--body, #555)", margin: "0 0 32px" }}>
          Six habits that turn a chat into a study partner.
        </p>
        {STEPS.map((s, i) => (
          <section key={s.h} style={{ borderTop: "1px solid var(--hairline, #eee)", padding: "22px 0" }}>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px" }}>{String(i + 1).padStart(2, "0")}</p>
            <h2 style={{ fontSize: 19, fontWeight: 550, margin: "0 0 8px" }}>{s.h}</h2>
            <p style={{ margin: 0, lineHeight: 1.7, color: "var(--body, #555)" }}>{s.p}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
