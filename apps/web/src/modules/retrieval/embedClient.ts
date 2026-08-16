/** Web-side embedding client (query path) — same contract as the worker's batch embedder. */

const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;

export interface EmbedResult {
  vector: string; // pgvector literal "[0.1,0.2,...]"
  model: string;
  dimensions: number;
}

export async function embedBatch(texts: string[], apiKey: string): Promise<EmbedResult[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, input: texts.map((t) => t.slice(0, 8000)) }),
  });
  if (!res.ok) throw new Error(`Embedding API failed: ${res.status}`);
  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  const out: EmbedResult[] = new Array(texts.length);
  for (const d of json.data) {
    out[d.index] = {
      vector: `[${d.embedding.map((x) => x.toFixed(6)).join(",")}]`,
      model: MODEL,
      dimensions: DIMENSIONS,
    };
  }
  return out;
}
