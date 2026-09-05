/**
 * Ingestion worker: parse → chunk → embed → index, with per-stage status
 * updates and retry/dead-letter (Architecture §3.1, §8.3).
 * The pipeline itself lives in @upc/ingest — this entry only owns the
 * BullMQ transport (future Railway deployment) and the OCR-capable parse
 * (tesseract stays worker-only, never enters the web bundle).
 */
import "dotenv/config";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { createDb, documents, ingestionJobs } from "@upc/db";
import { runIngestion, recordIngestFailure, type IngestEnv, type IngestJobData } from "@upc/ingest";
import { getEnv } from "@upc/core";

const QUEUE = "ingest";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/upcai";

const db = createDb(DATABASE_URL);

/** Env slice for the shared pipeline: process.env + AI_CUSTOM_PROVIDERS' Gemini key. */
function ingestEnv(): IngestEnv & { customProviders?: { name: string; baseUrl: string; apiKey: string }[] } {
  const env = getEnv();
  const customProviders = env.AI_CUSTOM_PROVIDERS ? (JSON.parse(env.AI_CUSTOM_PROVIDERS) as { name: string; baseUrl: string; apiKey: string }[]) : [];
  return {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    EMBEDDING_PROVIDER: env.EMBEDDING_PROVIDER,
    EMBEDDING_API_KEY: env.EMBEDDING_API_KEY,
    EMBEDDING_BASE_URL: env.EMBEDDING_BASE_URL,
    OPENAI_EMBEDDING_KEY: env.OPENAI_EMBEDDING_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    customProviders,
  };
}

const worker = new Worker<IngestJobData>(
  QUEUE,
  async (job) => {
    console.info(`[ingest] start ${job.id} doc=${job.data.documentId}`);
    const env = ingestEnv();
    await runIngestion(db, job.data.documentId, env, env.customProviders);
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 2,
  }
);

worker.on("failed", async (job, err) => {
  console.error(`[ingest] FAILED doc=${job?.data.documentId}: ${err.message}`);
  if (job) {
    const stage = err instanceof Error && "stage" in err ? ((err as { stage: "parsing" | "chunking" | "embedding" }).stage) : "parsing";
    await recordIngestFailure(db, job.data.documentId, stage, err.message).catch(() => undefined);
    await db
      .update(ingestionJobs)
      .set({ status: "dead", error: err.message })
      .where(eq(ingestionJobs.documentId, job.data.documentId));
    await db.update(documents).set({ processingError: err.message }).where(eq(documents.id, job.data.documentId));
  }
});

console.info(`[worker] ingest worker listening on queue "${QUEUE}"`);
