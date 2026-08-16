/**
 * Embeddings via OpenAI-compatible REST (text-embedding-3-small, 1536d).
 * Batched (64/call) — the authoritative model record lives on the embeddings table.
 */
const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;
const BATCH = 64;

export interface EmbedResult {
  vector: string; // pgvector literal "[0.1,0.2,...]"
  model: string;
  dimensions: number;
}

export async function embedBatch(texts: string[], apiKey: string): Promise<EmbedResult[]> {
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, input: slice.map((t) => t.slice(0, 8000)) }),
    });
    if (!res.ok) {
      throw new Error(`Embedding API failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    for (const d of json.data) all[i + d.index] = d.embedding;
  }
  return all.map((v) => ({
    vector: `[${v.map((x) => x.toFixed(6)).join(",")}]`,
    model: MODEL,
    dimensions: DIMENSIONS,
  }));
}
