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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Exponential backoff with ±25% jitter: attempt 0 → ~base, 1 → ~2×base, …
 *  Capped so a minute-throttled free tier (429 retry-after up to ~60s) is
 *  always out-waited: 2s → 4s → 8s → 16s → 32s → 64s covers any burst window. */
export function backoffDelay(attempt: number, baseMs = Number(process.env.EMBED_BASE_DELAY_MS ?? 2000)): number {
  const exp = Math.min(baseMs * 2 ** attempt, 90_000);
  return Math.round(exp * (0.75 + Math.random() * 0.5));
}

function maxRetries(): number {
  return Number(process.env.EMBED_MAX_RETRIES ?? 6);
}

function minDelayMs(): number {
  return Number(process.env.EMBED_MIN_DELAY_MS ?? 0);
}

/**
 * POST the embeddings request with retries on transient failures (429
 * rate-limit, 5xx, network errors) using exponential backoff. Non-transient
 * 4xx failures throw immediately. Returns an ok() Response or throws.
 */
async function fetchEmbeddings(endpoint: string, headers: Record<string, string>, body: string): Promise<Response> {
  const retries = maxRetries();
  let lastError: Error = new Error("Embedding API failed");
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(endpoint, { method: "POST", headers, body });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (res) {
      if (res.ok) return res;
      const detail = await res.text().catch(() => "");
      lastError = new Error(`Embedding API failed: ${res.status} ${detail}`);
      if (res.status !== 429 && res.status < 500) throw lastError; // permanent — no retry
      // Honor the provider's own retry-after hint (e.g. Google's RetryInfo) when parseable
      const retryAfter = detail.match(/"retryDelay":\s*"(\d+)s"/);
      if (res.status === 429 && retryAfter && attempt < retries) {
        await sleep(Math.min(Number(retryAfter[1]) * 1000, 90_000));
        continue;
      }
    }
    if (attempt < retries) await sleep(backoffDelay(attempt));
  }
  throw lastError;
}

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

/** Public model identity for a config — lets callers check vector/model compatibility. */
export function modelNameFor(config: EmbedConfig): string {
  return modelFor(config);
}

/**
 * Scatter one provider response batch into the results array at `offset`.
 * OpenAI always sets index (0-based, may be shuffled); Gemini's compat layer
 * omits index when it is 0 (proto3 default-value omission) — fall back to the
 * array position, which Gemini keeps in input order.
 */
export function placeBatch(all: number[][], offset: number, data: { embedding: number[]; index?: number }[]): void {
  data.forEach((d, k) => {
    all[offset + (d.index ?? k)] = d.embedding;
  });
}

/** Batched embedding (64/call). Returns [] when texts is empty or no config. */
export async function embedBatch(texts: string[], config: EmbedConfig | null): Promise<EmbedResult[]> {
  if (!texts.length || !config) return [];
  const model = modelFor(config);
  const endpoint = endpointFor(config);
  const all: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    if (i > 0 && minDelayMs() > 0) await sleep(minDelayMs()); // configurable rate limiting between batches
    const slice = texts.slice(i, i + BATCH);
    const res = await fetchEmbeddings(
      endpoint,
      { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      JSON.stringify({
        model,
        input: slice.map((t) => t.slice(0, 8000)),
        // Gemini defaults to 3072-dim; pgvector column is 1536 — pin it.
        ...(config.provider === "gemini" ? { dimensions: EMBEDDING_DIMENSIONS } : {}),
      }),
    );
    const json = (await res.json()) as { data: { embedding: number[]; index?: number }[] };
    placeBatch(all, i, json.data);
  }

  return all.map((v) => ({
    vector: `[${v.map((x) => x.toFixed(6)).join(",")}]`,
    model,
    dimensions: EMBEDDING_DIMENSIONS,
  }));
}
