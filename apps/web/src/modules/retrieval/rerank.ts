/**
 * LLM rerank of the fused retrieval shortlist (fail-open). The fast-tier model
 * reorders chunks by relevance to the question; on ANY failure (timeout, 429,
 * malformed output, no key) the fusion order is kept untouched. Gated by
 * RERANK_ENABLED (default on) — set RERANK_ENABLED=false to skip the call.
 */

export interface RerankableChunk {
  content: string;
  documentTitle?: string;
}

const RERANK_TIMEOUT_MS = 2500;

export function rerankEnabled(): boolean {
  return (process.env.RERANK_ENABLED ?? "true") !== "false";
}

interface FastChatConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** Same fallback chain as the embedding config (search.ts): env keys → AI_CUSTOM_PROVIDERS Gemini. */
export function resolveFastChat(): FastChatConfig | null {
  const direct = process.env.EMBEDDING_API_KEY?.trim();
  if (direct) {
    return {
      baseUrl: (process.env.EMBEDDING_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/$/, ""),
      apiKey: direct,
      model: process.env.RERANK_MODEL?.trim() || "gemini-flash-lite-latest",
    };
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    return {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: process.env.GEMINI_API_KEY.trim(),
      model: process.env.RERANK_MODEL?.trim() || "gemini-flash-lite-latest",
    };
  }
  if (process.env.AI_CUSTOM_PROVIDERS) {
    try {
      const customs = JSON.parse(process.env.AI_CUSTOM_PROVIDERS) as { name: string; baseUrl: string; apiKey: string; model?: string; tier?: string }[];
      const fast = customs.find((p) => /generativelanguage/.test(p.baseUrl) && p.tier === "fast") ?? customs.find((p) => /generativelanguage/.test(p.baseUrl));
      if (fast) {
        return { baseUrl: fast.baseUrl.replace(/\/$/, ""), apiKey: fast.apiKey, model: fast.model || "gemini-flash-lite-latest" };
      }
    } catch {
      /* malformed env — rerank stays off */
    }
  }
  return null;
}

/** Parse the model's index ordering out of its reply; tolerate prose around a JSON array. */
export function parseRerankOrder(text: string, poolSize: number): number[] | null {
  const m = text.match(/\[[\s\S]*?\]/);
  if (!m) return null;
  try {
    const arr = JSON.parse(m[0]) as unknown;
    if (!Array.isArray(arr)) return null;
    const seen = new Set<number>();
    const order: number[] = [];
    for (const v of arr) {
      const i = Number(v);
      if (Number.isInteger(i) && i >= 0 && i < poolSize && !seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
    // Any index the model omitted keeps its fusion rank at the back
    for (let i = 0; i < poolSize; i++) if (!seen.has(i)) order.push(i);
    return order;
  } catch {
    return null;
  }
}

/** Reorder chunks by relevance. Never throws — fail-open returns the input order. */
export async function rerankChunks<T extends RerankableChunk>(query: string, chunks: T[]): Promise<T[]> {
  if (chunks.length < 2 || !rerankEnabled()) return chunks;
  const cfg = resolveFastChat();
  if (!cfg) return chunks;
  try {
    const listing = chunks
      .map((c, i) => `[${i}] ${c.documentTitle ?? ""} — ${c.content.replace(/\s+/g, " ").slice(0, 400)}`)
      .join("\n");
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          {
            role: "system",
            content:
              "You rerank retrieved knowledge-base chunks for a college Q&A assistant. Return ONLY a JSON array of chunk indices, most relevant to the question first. No prose, no explanation.",
          },
          { role: "user", content: `Question: ${query}\n\nChunks:\n${listing}` },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(RERANK_TIMEOUT_MS),
    });
    if (!res.ok) return chunks;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const order = parseRerankOrder(json.choices?.[0]?.message?.content ?? "", chunks.length);
    if (!order) return chunks;
    return order.map((i) => chunks[i]!);
  } catch {
    return chunks;
  }
}
