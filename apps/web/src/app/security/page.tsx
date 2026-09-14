import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security — How UPC AI Protects Student Data",
  description:
    "How UPC AI protects student data: encrypted passwords, hashed OTPs, rotating sessions, access-controlled documents, and no training on student conversations.",
  alternates: { canonical: "/security" },
};

const SECTIONS = [
  {
    h: "Your account",
    p: "Passwords are hashed with bcrypt (never stored in readable form). Sign-in codes are single-use, expire in 10 minutes, and are stored hashed. Sessions use short-lived signed tokens with rotating refresh credentials — if a refresh token is ever replayed, the session is revoked automatically.",
  },
  {
    h: "Your conversations",
    p: "Chats are tied to your account and are never used to train AI models. You can delete your account at any time — your profile is anonymised and your sessions are revoked everywhere.",
  },
  {
    h: "College documents",
    p: "Documents live in access-controlled storage. Every document carries an access level: public documents power answers for everyone; internal and restricted documents are invisible to students at the database-query level — not just hidden in the interface.",
  },
  {
    h: "API keys & infrastructure",
    p: "AI provider keys live only in server-side encrypted environment variables — never in the browser, never in the database, never in the admin panel. The site enforces strict security headers, including HSTS and a Content Security Policy.",
  },
  {
    h: "Abuse protection",
    p: "Login lockouts, hashed one-time codes, per-account and per-IP rate limits, and daily usage quotas protect the service and your account from brute-force attacks.",
  },
  {
    h: "Questions?",
    p: "Write to hello@upcai.app and we will answer — usually within a day.",
  },
];

export default function SecurityPage() {
  return (
    <main id="main" style={{ fontFamily: "var(--font-body)", color: "var(--ink)", background: "var(--canvas)", minHeight: "100dvh", padding: "clamp(48px, 8vw, 96px) clamp(20px, 6vw, 48px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{ fontSize: 12, fontWeight: 550, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Security</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4.5vw, 48px)", fontWeight: 500, margin: "0 0 16px" }}>
          How UPC AI protects student data.
        </h1>
        {SECTIONS.map((s) => (
          <section key={s.h} style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 550, margin: "0 0 8px" }}>{s.h}</h2>
            <p style={{ margin: 0, lineHeight: 1.7, color: "var(--body, #555)" }}>{s.p}</p>
          </section>
        ))}
        <p style={{ marginTop: 40, fontSize: 13, color: "var(--muted)" }}>
          Last updated: September 2026 · UPC AI, Udai Pratap College, Varanasi
        </p>
      </div>
    </main>
  );
}
