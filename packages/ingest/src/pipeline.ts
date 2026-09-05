/**
 * Ingestion pipeline: parse → chunk → embed → index, with per-stage status
 * updates (Architecture §3.1, §8.3). Extracted from the BullMQ worker so the
 * web process route can run it inline — the missing "producer" — while the
 * worker remains the future Railway path over the same code.
 */
import { eq } from "drizzle-orm";
import { documents, chunks, embeddings, ingestionJobs } from "@upc/db";
import { parseDocument } from "./parse";
import { chunkDocument, approxTokens } from "./chunk";
import { embedBatch, resolveEmbedConfig, type EmbedConfig } from "./embed";
import { readRawFile, resolveStorageConfig, type StorageConfig } from "./storage";
import type { ParsedDocument } from "./types";

/** Minimal DB surface so both web (getDb singleton) and worker (own client) can supply it. */
export type IngestDb = ReturnType<typeof import("@upc/db").createDb>;

export interface IngestEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  EMBEDDING_PROVIDER?: string;
  EMBEDDING_API_KEY?: string;
  EMBEDDING_BASE_URL?: string;
  OPENAI_EMBEDDING_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

export interface IngestResult {
  documentId: string;
  chunks: number;
  embedded: boolean;
}

function stageStatus(stage: string, status: "processing" | "completed" | "failed"): "parsing" | "chunking" | "embedding" | "indexed" | "parse_failed" | "chunk_failed" | "embed_failed" {
  if (status === "completed") return "indexed";
  if (status === "failed") {
    if (stage === "parsing") return "parse_failed";
    if (stage === "chunking") return "chunk_failed";
    return "embed_failed";
  }
  return stage as "parsing" | "chunking" | "embedding";
}

async function setStage(db: IngestDb, documentId: string, jobId: string, stage: string, progress: number, status: "processing" | "completed" | "failed" = "processing", error?: string) {
  await db
    .update(documents)
    .set({ status: stageStatus(stage, status), processingError: error ?? null, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
  await db
    .update(ingestionJobs)
    .set({
      stage,
      stageProgress: progress,
      status,
      ...(status === "completed" ? { completedAt: new Date() } : {}),
      ...(status === "processing" ? { startedAt: new Date() } : {}),
      error: error ?? null,
    })
    .where(eq(ingestionJobs.id, jobId));
}

/** Resolve the embed config, preferring @upc/core's AI_CUSTOM_PROVIDERS Gemini key as a fallback. */
function resolveConfig(env: IngestEnv, customProviders?: { name: string; baseUrl: string; apiKey: string }[]): EmbedConfig | null {
  const direct = resolveEmbedConfig(env);
  if (direct) return direct;
  const gemini = customProviders?.find((p) => /generativelanguage/.test(p.baseUrl));
  return gemini ? { provider: "gemini", apiKey: gemini.apiKey, baseUrl: gemini.baseUrl } : null;
}

/**
 * Run the full pipeline for one document. Idempotent: prior chunks are
 * deleted first, so re-running after a failure (or a Retry click) is safe.
 * Throws on failure after recording the failed stage.
 */
export async function runIngestion(
  db: IngestDb,
  documentId: string,
  env: IngestEnv,
  customProviders?: { name: string; baseUrl: string; apiKey: string }[],
): Promise<IngestResult> {
  const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.documentId, documentId)).limit(1);
  const jobId = job?.id ?? documentId;

  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!doc) throw new Error(`Document ${documentId} not found`);

  const storageConfig = resolveStorageConfig(env);
  const embedConfig = resolveConfig(env, customProviders);

  // 1. Read raw file
  const raw = await readRawFile(doc.storagePath, storageConfig);

  // 2. Parse
  await setStage(db, documentId, jobId, "parsing", 10);
  const parsed: ParsedDocument = await parseDocument(raw, doc.mimeType ?? "application/octet-stream");
  if (parsed.error) throw new IngestError("parsing", parsed.error);
  if (!parsed.text.trim()) throw new IngestError("parsing", "No extractable text (scanned PDF? Upload a text-native file)");

  // 3. Chunk
  await setStage(db, documentId, jobId, "chunking", 40);
  const rawChunks = chunkDocument(parsed.text, { pageTexts: parsed.pageTexts, tables: parsed.tables, docTitle: doc.title });

  // Replace any previous chunks for this document version (idempotent reprocessing)
  await db.delete(chunks).where(eq(chunks.documentId, documentId));

  // 4. Embed — fail-open: no key → BM25-only retrieval, doc still indexes
  await setStage(db, documentId, jobId, "embedding", 60);
  let vectors: Awaited<ReturnType<typeof embedBatch>> = [];
  if (embedConfig) {
    try {
      vectors = await embedBatch(rawChunks.map((c) => c.content), embedConfig);
    } catch (err) {
      // Provider burst-quota (e.g. Gemini 429 on a large batch): the document
      // still indexes — BM25 keeps it searchable; Retry re-attempts embeddings.
      console.warn("[ingest] embedding failed, indexing without vectors:", err instanceof Error ? err.message : err);
    }
  }

  // 5. Index (insert chunks + embeddings, then mark indexed)
  for (let i = 0; i < rawChunks.length; i++) {
    const c = rawChunks[i]!;
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
    const v = vectors[i];
    if (v) {
      await db.insert(embeddings).values({
        chunkId: inserted!.id,
        embeddingVector: v.vector,
        embeddingModel: v.model,
        dimensions: v.dimensions,
      });
    }
  }

  await db
    .update(documents)
    .set({
      pageCount: parsed.pages,
      wordCount: parsed.text.split(/\s+/).length,
      chunkCount: rawChunks.length,
      embeddingModel: vectors[0]?.model ?? null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  await setStage(db, documentId, jobId, "embedding", 100, "completed");
  return { documentId, chunks: rawChunks.length, embedded: vectors.length > 0 };
}

/** Error carrying the stage that failed — the route maps it to the failed-status + retry UX. */
export class IngestError extends Error {
  constructor(
    public readonly stage: "parsing" | "chunking" | "embedding",
    message: string,
  ) {
    super(message);
  }
}

/** Mark failure on both rows (documents + ingestion_jobs) with the right failed-status. */
export async function recordIngestFailure(db: IngestDb, documentId: string, stage: "parsing" | "chunking" | "embedding", message: string) {
  const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.documentId, documentId)).limit(1);
  await setStage(db, documentId, job?.id ?? documentId, stage, 0, "failed", message).catch(() => undefined);
}
