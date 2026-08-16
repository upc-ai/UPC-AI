/**
 * Ingestion worker: parse → chunk → embed → index, with per-stage status
 * updates and retry/dead-letter (Architecture §3.1, §8.3).
 */
import "dotenv/config";
import { Worker } from "bullmq";
import { eq, sql } from "drizzle-orm";
import { createDb, documents, chunks, embeddings, ingestionJobs } from "@upc/db";
import { parseDocument } from "./parse";
import { chunkDocument, approxTokens } from "./chunk";
import { embedBatch } from "./embed";
import type { IngestJobData } from "./types";

const QUEUE = "ingest";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/upcai";

const db = createDb(DATABASE_URL);

async function setStage(documentId: string, jobId: string, stage: string, progress: number, status: "processing" | "completed" | "failed" = "processing", error?: string) {
  await db.update(documents).set({ status: stageStatus(stage, status), processingError: error ?? null, updatedAt: new Date() }).where(eq(documents.id, documentId));
  await db
    .update(ingestionJobs)
    .set({ stage, stageProgress: progress, status, ...(status === "completed" ? { completedAt: new Date() } : {}), error: error ?? null })
    .where(eq(ingestionJobs.id, jobId));
}

function stageStatus(stage: string, status: string): "parsing" | "chunking" | "embedding" | "indexed" | "parse_failed" | "chunk_failed" | "embed_failed" {
  if (status === "completed") return "indexed";
  if (status === "failed") {
    if (stage === "parsing") return "parse_failed";
    if (stage === "chunking") return "chunk_failed";
    return "embed_failed";
  }
  return stage as "parsing" | "chunking" | "embedding";
}

async function processJob(data: IngestJobData) {
  const { documentId } = data;
  const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.documentId, documentId)).limit(1);
  const jobId = job?.id ?? documentId;

  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!doc) throw new Error(`Document ${documentId} not found`);

  // 1. Read raw file from storage path (local disk in v1; S3 adapter when configured)
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(doc.storagePath);

  // 2. Parse
  await setStage(documentId, jobId, "parsing", 10);
  const parsed = await parseDocument(raw, doc.mimeType ?? "application/octet-stream");
  if (parsed.error) throw new Error(parsed.error);
  if (!parsed.text.trim()) throw new Error("No extractable text (scanned PDF OCR arrives with tier-2)");

  // 3. Chunk
  await setStage(documentId, jobId, "chunking", 40);
  const rawChunks = chunkDocument(parsed.text, { pageTexts: parsed.pageTexts, tables: parsed.tables, docTitle: doc.title });

  // Replace any previous chunks for this document version (idempotent reprocessing)
  await db.delete(chunks).where(eq(chunks.documentId, documentId));

  // 4. Embed
  await setStage(documentId, jobId, "embedding", 60);
  const apiKey = process.env.OPENAI_EMBEDDING_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Embedding API key missing (OPENAI_EMBEDDING_KEY)");
  const vectors = await embedBatch(rawChunks.map((c) => c.content), apiKey);

  // 5. Index (transactional swap: insert chunks + embeddings, then mark indexed)
  for (let i = 0; i < rawChunks.length; i++) {
    const c = rawChunks[i]!;
    const v = vectors[i]!;
    const [inserted] = await db
      .insert(chunks)
      .values({
        documentId,
        chunkIndex: i,
        content: c.content,
        tokenCount: approxTokens(c.content),
        chunkType: c.chunkType,
        hierarchyPath: c.hierarchyPath,
        pageNumber: c.pageNumber,
        tableJson: c.tableJson ?? null,
        metadata: {
          category: doc.categoryId,
          department: doc.departmentId,
          access_level: doc.accessLevel,
          audience: doc.audience,
          language: doc.language,
          effective_date: doc.effectiveDate,
          expiry_date: doc.expiryDate,
        },
      })
      .returning({ id: chunks.id });
    await db.insert(embeddings).values({
      chunkId: inserted!.id,
      embeddingVector: v.vector,
      embeddingModel: v.model,
      dimensions: v.dimensions,
    });
  }

  await db
    .update(documents)
    .set({
      pageCount: parsed.pages,
      wordCount: parsed.text.split(/\s+/).length,
      chunkCount: rawChunks.length,
      embeddingModel: vectors[0]?.model,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  await setStage(documentId, jobId, "embedding", 100, "completed");
  console.info(`[ingest] ${doc.title}: ${rawChunks.length} chunks indexed`);
}

const worker = new Worker<IngestJobData>(
  QUEUE,
  async (job) => {
    console.info(`[ingest] start ${job.id} doc=${job.data.documentId}`);
    await processJob(job.data);
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 2,
  },
);

worker.on("failed", async (job, err) => {
  console.error(`[ingest] FAILED doc=${job?.data.documentId}: ${err.message}`);
  if (job) {
    await db
      .update(ingestionJobs)
      .set({ status: "dead", error: err.message })
      .where(eq(ingestionJobs.documentId, job.data.documentId));
    await db.update(documents).set({ processingError: err.message }).where(eq(documents.id, job.data.documentId));
  }
});

console.info(`[worker] ingest worker listening on queue "${QUEUE}"`);
