/**
 * Publish gate (safety invariant): a document may only go live to students
 * when ingestion is COMPLETE and its embeddings are intact. Pure logic —
 * unit-tested; enforced server-side in the review route.
 */

export interface PublishCheckDoc {
  status: string;
  processingError?: string | null;
}

export interface PublishCheckCounts {
  chunkCount: number;
  embeddingCount: number;
}

export interface PublishVerdict {
  ok: boolean;
  reason?: string;
}

/**
 * Only fully-indexed, error-free documents with one vector per chunk can be
 * published. Blocks: parse/chunk/embed failures, needs_ocr docs, BM25-only
 * (missing-vector) documents, and anything with a recorded processing error.
 */
export function canPublish(doc: PublishCheckDoc, counts: PublishCheckCounts): PublishVerdict {
  if (doc.status !== "indexed") {
    return { ok: false, reason: `Document status is "${doc.status}" — only fully indexed documents can be published` };
  }
  if (doc.processingError) {
    return { ok: false, reason: `Document has a recorded processing error: ${doc.processingError}` };
  }
  if (!counts.chunkCount || counts.chunkCount <= 0) {
    return { ok: false, reason: "Document has no indexed chunks" };
  }
  if (counts.embeddingCount !== counts.chunkCount) {
    return {
      ok: false,
      reason: `${counts.chunkCount - counts.embeddingCount} of ${counts.chunkCount} chunks are missing embeddings (run backfill or re-process first)`,
    };
  }
  return { ok: true };
}
