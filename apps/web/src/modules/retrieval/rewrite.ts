/**
 * Query rewriting (RAG v2): one cheap fast-tier call turns a messy student
 * message into a clean English search query before retrieval. Resolves
 * pronouns from recent turns ("what about hostel?" → "Udai Pratap College
 * hostel rules") and handles Hinglish ("fees kitna hai" → "Udai Pratap
 * College fee structure").
 *
 * Fail-open by design: ANY error, timeout, or unparsable response returns
 * null and the caller searches the raw query. Retrieval must never hard-fail
 * because the rewriter hiccuped.
 */
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getEnv, getCustomProviders } from "@upc/core";

const REWRITE_TIMEOUT_MS = 3500;

/** Pick the fast-tier custom provider (Gemini-lite family) for the rewrite call. */
function rewriteModel() {
  const customs = getCustomProviders();
  const fast = customs.find((c) => c.tier === "fast") ?? customs[0];
  if (fast) {
    const client = createOpenAI({ baseURL: fast.baseUrl, apiKey: fast.apiKey });
    return client(fast.model);
  }
  // No customs configured: rewriting is unavailable — fail-open (raw query)
  return null;
}

/**
 * Rewrite for retrieval. Returns the search query, or null on any failure
 * (caller falls back to the raw message).
 */
export async function rewriteQuery(
  message: string,
  history: { role: string; content: string }[],
): Promise<string | null> {
  void getEnv; // provider config is read via getCustomProviders above
  const model = rewriteModel();
  if (!model) return null;

  const recent = history
    .slice(-2)
    .map((m) => `${m.role === "assistant" ? "AI" : "Student"}: ${m.content.slice(0, 200)}`)
    .join("\n");

  const prompt = `You rewrite student questions into short English search queries for a college knowledge base (Udai Pratap College, Varanasi).

Rules:
- Output ONLY the search query. No preamble, no quotes, no explanation.
- Resolve pronouns using the conversation context.
- Translate Hindi/Hinglish to English search terms.
- Add "Udai Pratap College" prefix when the topic is college-specific (fees, hostel, exams, notices, admission, rules).
- Keep numbers, course codes, and proper nouns exactly as written.
- Max 25 words.

${recent ? `Recent conversation:\n${recent}\n\n` : ""}Student question: ${message}

Search query:`;

  try {
    const result = await Promise.race([
      generateText({ model, prompt, maxTokens: 60, temperature: 0 }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), REWRITE_TIMEOUT_MS)),
    ]);
    if (!result) return null;
    const text = result.text.trim().replace(/^["']|["']$/g, "");
    if (!text || text.length > 200 || text.includes("\n")) return null;
    return text;
  } catch {
    return null; // fail-open: search the raw message
  }
}
