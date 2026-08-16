/**
 * Prompt assembly (Architecture §2.6). Templates are simple builders in v1;
 * they migrate to the prompt_templates table with versioning when A/B starts.
 */
import type { CoreMessage } from "ai";
import type { Intent, StudyMode, LanguagePreference, ResponseLength, Difficulty } from "@upc/core";
import { studyModeInstruction, languageInstruction } from "./intent";
import type { RetrievedChunk } from "../retrieval/search";

const LENGTH: Record<ResponseLength, string> = {
  concise: "Be concise: the answer and the essential steps, nothing more.",
  detailed: "Be detailed: explain each step with its reasoning.",
  exhaustive: "Be exhaustive: cover the full derivation, edge cases, and common mistakes.",
};

const DIFFICULTY: Record<Difficulty, string> = {
  beginner: "The student is a beginner — define terms on first use.",
  intermediate: "Assume undergraduate familiarity with the subject.",
  advanced: "Assume strong undergraduate command; go deep.",
};

const BASE_IDENTITY = `You are UPC AI, the official AI assistant of Udai Pratap College (UPC), Varanasi.
You help students with (1) academic questions — solving, explaining, verifying — and (2) official college information.
You are patient, warm, and precise. You use Markdown, LaTeX for math, and fenced code blocks.`;

const KNOWLEDGE_GROUNDING = `COLLEGE KNOWLEDGE RULES (non-negotiable):
- Answer ONLY from the OFFICIAL CONTEXT below.
- Cite sources inline as [1], [2] matching the numbered context blocks.
- If the context does not contain the answer, say exactly: "I don't have that in the official knowledge base yet." Then suggest asking the college office concerned.
- Never guess fees, dates, rules, or numbers.`;

export function buildSystemPrompt(opts: {
  intent: Intent;
  studyMode: StudyMode;
  language: LanguagePreference;
  responseLength: ResponseLength;
  difficulty: Difficulty;
  contextChunks?: RetrievedChunk[];
}): string {
  const parts = [BASE_IDENTITY, studyModeInstruction(opts.studyMode), LENGTH[opts.responseLength], DIFFICULTY[opts.difficulty], languageInstruction(opts.language)];

  if ((opts.intent === "knowledge" || opts.intent === "mixed") && opts.contextChunks?.length) {
    parts.push(KNOWLEDGE_GROUNDING);
    parts.push(
      "OFFICIAL CONTEXT:\n" +
        opts.contextChunks
          .map((c, i) => `[${i + 1}] (${c.documentTitle}${c.pageNumber ? `, p.${c.pageNumber}` : ""})\n${c.content}`)
          .join("\n\n"),
    );
  }

  return parts.join("\n\n");
}

/** Compress history: keep the last 10 turns. */
export function buildHistory(history: { role: string; content: string }[]): CoreMessage[] {
  return history.slice(-10).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  })) as CoreMessage[];
}
