/**
 * Embeddings via OpenAI-compatible REST (Architecture §3.4).
 * Provider-switchable at env level: OpenAI text-embedding-3-small or Gemini
 * gemini-embedding-001, both emitting 1536-dim vectors to match the pgvector
 * column (schema: embeddings.embedding_vector vector(1536)).
 *
 * When no key is configured, embedBatch returns [] — callers index the
 * document without vectors and retrieval runs BM25-only (fail-open by design:
 * the knowledge base must never be blocked on a provider key).
 */
const OPENAI_MODEL = "text-embedding-3-small";
const GEMINI_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 1536;
const BATCH = 64;

export interface EmbedResult {
  vector: string; // pgvector literal "[0.1,0.2,...]"
  model: string;
  dimensions: number;
}

export interface EmbedConfig {
  provider: "openai" | "gemini";
  apiKey: string;
  baseUrl?: string; // gemini: OpenAI-compat base (default https://generativelanguage.googleapis.com/v1beta/openai)
}

/** Parse provider + key from environment. Returns null when unconfigured. */
export function resolveEmbedConfig(env: {
  EMBEDDING_PROVIDER?: string;
  EMBEDDING_API_KEY?: string;
  EMBEDDING_BASE_URL?: string;
  OPENAI_EMBEDDING_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
}): EmbedConfig | null {
  const explicit = env.EMBEDDING_API_KEY?.trim();
  if (explicit) {
    const provider = env.EMBEDDING_PROVIDER?.trim() === "openai" ? "openai" : "gemini";
    return { provider, apiKey: explicit, baseUrl: env.EMBEDDING_BASE_URL?.trim() || undefined };
  }
  // Legacy/implicit: OpenAI keys → openai; Gemini key → gemini
  if (env.OPENAI_EMBEDDING_KEY?.trim()) return { provider: "openai", apiKey: env.OPENAI_EMBEDDING_KEY.trim() };
  if (env.OPENAI_API_KEY?.trim()) return { provider: "openai", apiKey: env.OPENAI_API_KEY.trim() };
  if (env.GEMINI_API_KEY?.trim()) return { provider: "gemini", apiKey: env.GEMINI_API_KEY.trim() };
  return null;
}

function endpointFor(config: EmbedConfig): string {
  if (config.baseUrl) return config.baseUrl.replace(/\/$/, "") + "/embeddings";
  if (config.provider === "openai") return "https://api.openai.com/v1/embeddings";
  return "https://generativelanguage.googleapis.com/v1beta/openai/embeddings";
}

function modelFor(config: EmbedConfig): string {
  return config.provider === "openai" ? OPENAI_MODEL : GEMINI_MODEL;
}

/** Batched embedding (64/call). Returns [] when texts is empty or no config. */
export async function embedBatch(texts: string[], config: EmbedConfig | null): Promise<EmbedResult[]> {
  if (!texts.length || !config) return [];
  const model = modelFor(config);
  const endpoint = endpointFor(config);
  const all: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model,
        input: slice.map((t) => t.slice(0, 8000)),
        // Gemini defaults to 3072-dim; pgvector column is 1536 — pin it.
        ...(config.provider === "gemini" ? { dimensions: EMBEDDING_DIMENSIONS } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Embedding API failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    for (const d of json.data) all[i + d.index] = d.embedding;
  }

  return all.map((v) => ({
    vector: `[${v.map((x) => x.toFixed(6)).join(",")}]`,
    model,
    dimensions: EMBEDDING_DIMENSIONS,
  }));
}
