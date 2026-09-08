/**
 * Backfill the chunk-0 vectors lost to the Gemini index-omission bug
 * (embed.ts scatter wrote to all[NaN] when the provider omitted index=0).
 * Finds chunks with no embedding row, embeds ONLY those, inserts the rows.
 * Idempotent — re-running is a no-op once every chunk has its vector.
 * Usage: pnpm backfill:vectors
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, isNull, sql } from "drizzle-orm";
import { createDb, chunks, embeddings, documents } from "@upc/db";
import { embedBatch, resolveEmbedConfig, type EmbedConfig } from "@upc/ingest";

const BATCH_PAUSE_MS = 4_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = createDb(process.env.DATABASE_URL);

  const env = {
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY,
    EMBEDDING_BASE_URL: process.env.EMBEDDING_BASE_URL,
    OPENAI_EMBEDDING_KEY: process.env.OPENAI_EMBEDDING_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };
  // Key rotation for free-tier quota: GEMINI_API_KEY_BACKUP → GEMINI_API_KEY →
  // every Gemini key in AI_CUSTOM_PROVIDERS. Per-BATCH rotation: a 429 moves the
  // run to the next key; when every key is burst-limited, wait out the window.
  const candidates: EmbedConfig[] = [];
  if (process.env.GEMINI_API_KEY_BACKUP?.trim()) {
    candidates.push({ provider: "gemini", apiKey: process.env.GEMINI_API_KEY_BACKUP.trim() });
  }
  if (process.env.GEMINI_API_KEY_BACKUP2?.trim()) {
    candidates.push({ provider: "gemini", apiKey: process.env.GEMINI_API_KEY_BACKUP2.trim() });
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    candidates.push({ provider: "gemini", apiKey: process.env.GEMINI_API_KEY.trim() });
  }
  try {
    const customs = process.env.AI_CUSTOM_PROVIDERS ? JSON.parse(process.env.AI_CUSTOM_PROVIDERS) : [];
    for (const p of customs) {
      if (/generativelanguage/.test(p.baseUrl ?? "")) {
        const cfg = { provider: "gemini" as const, apiKey: p.apiKey, baseUrl: p.baseUrl };
        if (!candidates.some((c) => c.apiKey === cfg.apiKey)) candidates.push(cfg);
      }
    }
  } catch {
    /* malformed env — rely on GEMINI_API_KEY only */
  }
  if (!candidates.length) throw new Error("No Gemini embedding keys configured");
  let keyIdx = 0;
  const nextKey = (): EmbedConfig => candidates[keyIdx % candidates.length]!;
  console.log(`[backfill] ${candidates.length} keys in rotation, starting with …${nextKey().apiKey.slice(-8)}`);

  /** Embed one batch, rotating keys on burst-limit 429s; wait out the window if all keys are hot. */
  async function embedWithRotation(texts: string[]): Promise<Awaited<ReturnType<typeof embedBatch>>> {
    for (let round = 0; ; round++) {
      try {
        return await embedBatch(texts, nextKey());
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/429|RESOURCE_EXHAUSTED/i.test(msg)) {
          keyIdx++; // rotate to the next key
          if (keyIdx % candidates.length === 0 && round >= candidates.length * 4) {
            throw new Error("all keys exhausted across multiple rounds — daily cap reached");
          }
          // completed a full rotation of hot keys → wait out the ~1-minute burst window
          if (keyIdx % candidates.length === 0) {
            console.log(`[backfill] all keys burst-limited — waiting 65s (round ${Math.floor(keyIdx / candidates.length)})`);
            await new Promise((r) => setTimeout(r, 65_000));
          } else {
            console.log(`[backfill] 429 — rotating to key …${nextKey().apiKey.slice(-8)}`);
          }
          continue;
        }
        throw err;
      }
    }
  }

  // Every active chunk missing its vector (the bug lost exactly chunk 0 per doc,
  // but query generically so any hole gets repaired)
  const holes = (await db
    .select({ id: chunks.id, content: chunks.content, documentId: chunks.documentId, chunkIndex: chunks.chunkIndex })
    .from(chunks)
    .leftJoin(embeddings, eq(embeddings.chunkId, chunks.id))
    .where(isNull(embeddings.chunkId))
    .orderBy(chunks.documentId, chunks.chunkIndex)) as { id: string; content: string; documentId: string; chunkIndex: number }[];

  console.log(`[backfill] ${holes.length} chunks missing vectors across ${new Set(holes.map((h) => h.documentId)).size} documents`);
  if (!holes.length) {
    console.log("[backfill] nothing to do");
    process.exit(0);
  }

  // Free-tier RPM walls: a 64-input batch counts as ~64 instantaneous requests
  // and trips the burst limit even on fresh keys. Slice into BATCH_SIZE sub-
  // batches with pacing — quota math stays identical, request rate stays sane.
  const BATCH_SIZE = Number(process.env.BACKFILL_BATCH_SIZE ?? 16);
  const PAUSE_MS = Number(process.env.BACKFILL_PAUSE_MS ?? 1500);
  let done = 0;
  for (let i = 0; i < holes.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
    const slice = holes.slice(i, i + BATCH_SIZE);
    const results = await embedWithRotation(
      slice.map((h) => h.content),
    );
    for (let k = 0; k < slice.length; k++) {
      const v = results[k];
      if (!v) throw new Error(`backfill: no vector returned for chunk ${slice[k]!.id} (batch starting at ${i})`);
      await db.insert(embeddings).values({
        chunkId: slice[k]!.id,
        embeddingVector: v.vector,
        embeddingModel: v.model,
        dimensions: v.dimensions,
      });
      // The bug also left documents.embedding_model null (vectors[0] was undefined)
      await db
        .update(documents)
        .set({ embeddingModel: v.model })
        .where(eq(documents.id, slice[k]!.documentId));
      // Clear the recorded embedding failure once a doc's LAST hole is filled —
      // the panel should show the document clean again.
      await db.execute(sql`
        update documents set processing_error = null
        where id = ${slice[k]!.documentId}
          and processing_error like 'embedding_failed:%'
          and (select count(*) from chunks c left join embeddings e on e.chunk_id = c.id
               where c.document_id = documents.id and e.chunk_id is null) = 0
      `);
    }
    done += slice.length;
    console.log(`[backfill] ${done}/${holes.length} vectors inserted`);
    if (i + BATCH_SIZE < holes.length) await sleep(PAUSE_MS);
  }

  const verify = (await db.execute(sql`
    select count(*)::int as missing from chunks c
    left join embeddings e on e.chunk_id = c.id where e.chunk_id is null
  `)) as unknown as { missing: number }[];
  console.log(`[backfill] complete — ${done} inserted, ${verify[0]?.missing ?? "?"} still missing`);
  process.exit(0);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
