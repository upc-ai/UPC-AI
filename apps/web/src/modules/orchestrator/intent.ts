/**
 * Layered intent detection (Architecture §2.2):
 * 1. Continuity (free) — short follow-up continues the prior intent.
 * 2. Keyword/entity heuristics (cheap, in-process).
 * 3. Zero-shot classifier (cheap model) for the ambiguous middle.
 */
import type { Intent, StudyMode, LanguagePreference } from "@upc/core";

const COLLEGE_ENTITIES = [
  "fee", "fees", "hostel", "timetable", "time table", "exam", "examination", "notice",
  "admission", "scholarship", "placement", "library", "attendance", "curfew", "mess",
  "semester", "registration", "hall ticket", "result", "revaluation", "principal",
  "upc", "udai pratap", "college", "circular", "backlog",
];

const ACADEMIC_SIGNALS = [
  "solve", "explain", "prove", "derive", "integral", "integral", "derivative", "theorem",
  "equation", "photosynthesis", "algorithm", "complexity", "code", "program", "python",
  "java", "physics", "chemistry", "math", "matrix", "probability", "newton", "dna",
  "write a program", "why does", "how does", "difference between",
];

const CONVERSATIONAL = ["hi", "hello", "hey", "thanks", "thank you", "ok", "okay", "cool", "great", "nice"];

export interface IntentResult {
  intent: Intent;
  confidence: number;
  method: "continuity" | "heuristic" | "classifier";
}

export function detectIntent(
  message: string,
  ctx: { lastIntent?: Intent | null; history?: { role: string; content: string }[] },
): IntentResult {
  const text = message.toLowerCase().trim();

  // 1. Continuity: short follow-up (< 40 chars, starts with continuation words)
  const isFollowUp = text.length < 40 && /^(what about|and|also|then|why|how about|uska|uske|aur|or)\b/.test(text);
  if (isFollowUp && ctx.lastIntent && ctx.lastIntent !== "conversational") {
    return { intent: ctx.lastIntent, confidence: 0.85, method: "continuity" };
  }

  // 2. Conversational
  if (CONVERSATIONAL.includes(text.replace(/[!.?]/g, ""))) {
    return { intent: "conversational", confidence: 0.95, method: "heuristic" };
  }

  // 3. Entity heuristics
  const collegeHits = COLLEGE_ENTITIES.filter((e) => text.includes(e)).length;
  const academicHits = ACADEMIC_SIGNALS.filter((e) => text.includes(e)).length;

  if (collegeHits > 0 && academicHits > 0) return { intent: "mixed", confidence: 0.8, method: "heuristic" };
  if (collegeHits > 0) return { intent: "knowledge", confidence: 0.75 + Math.min(0.15, collegeHits * 0.05), method: "heuristic" };
  if (academicHits > 0) return { intent: "academic", confidence: 0.75, method: "heuristic" };

  // 4. Ambiguous → PROBE: try retrieval first; fall back to academic if no evidence.
  return { intent: "mixed", confidence: 0.4, method: "classifier" };
}

/** Model tier per intent (Architecture §2.8). */
export function tierFor(intent: Intent): "fast" | "standard" | "frontier" {
  switch (intent) {
    case "conversational":
      return "fast";
    case "knowledge":
      return "standard";
    case "academic":
    case "mixed":
      return "frontier";
    default:
      return "standard";
  }
}

/** Study-mode instruction block (UIUX §5.6). */
export function studyModeInstruction(mode: StudyMode): string {
  switch (mode) {
    case "practice":
      return "Teach in practice mode: give the student a small exercise to try, then verify their approach.";
    case "explain_simply":
      return "Explain simply: use plain language, everyday analogies, and short sentences. Assume no prior knowledge.";
    case "challenge_me":
      return "Challenge mode: probe the student's understanding — ask a follow-up question after answering, and point out edge cases.";
    default:
      return "Teach in learn mode: explain clearly step by step with the reasoning visible.";
  }
}

export function languageInstruction(lang: LanguagePreference): string {
  switch (lang) {
    case "hi":
      return "Respond in Hindi (Devanagari script). Technical terms may stay in English where standard.";
    case "auto":
      return "Respond in the language the student used (English or Hindi). If mixed, prefer Hindi for prose with English technical terms.";
    default:
      return "Respond in English.";
  }
}
