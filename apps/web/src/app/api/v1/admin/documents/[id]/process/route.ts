import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { documents } from "@upc/db";
import { ApiError, getEnv } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth, canManageDocuments } from "@/lib/auth/guard";
import { runIngestion, recordIngestFailure, IngestError, NeedsOcrError, type IngestEnv } from "@upc/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  document_id: z.string().uuid(),
});

/**
 * POST /v1/admin/documents/[id]/process — the missing pipeline producer.
 * Runs parse → chunk → embed → index inline (maxDuration 300). Idempotent:
 * re-running after a failure (or a Retry click) is safe — the pipeline
 * deletes prior chunks first. Embedding failures fail-open to BM25-only.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const claims = await requireAuth(req);
    if (!canManageDocuments(claims)) {
      throw new ApiError("FORBIDDEN", "Only knowledge-base admins can process documents");
    }

    const { id } = params;
    const body = bodySchema.parse({ document_id: id });

    const db = getDb();
    const [doc] = await db
      .select({ id: documents.id, status: documents.status })
      .from(documents)
      .where(eq(documents.id, body.document_id))
      .limit(1);
    if (!doc) throw new ApiError("RESOURCE_NOT_FOUND", "Document not found");

    const env = getEnv();
    const customProviders = env.AI_CUSTOM_PROVIDERS
      ? (JSON.parse(env.AI_CUSTOM_PROVIDERS) as { name: string; baseUrl: string; apiKey: string }[])
      : [];
    const ingestEnv: IngestEnv = {
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      EMBEDDING_PROVIDER: env.EMBEDDING_PROVIDER,
      EMBEDDING_API_KEY: env.EMBEDDING_API_KEY,
      EMBEDDING_BASE_URL: env.EMBEDDING_BASE_URL,
      OPENAI_EMBEDDING_KEY: env.OPENAI_EMBEDDING_KEY,
      OPENAI_API_KEY: env.OPENAI_API_KEY,
    };

    try {
      const result = await runIngestion(db, body.document_id, ingestEnv, customProviders);
      return ok({
        document_id: result.documentId,
        status: "indexed",
        chunks: result.chunks,
        embedded: result.embedded,
      });
    } catch (err) {
      if (err instanceof NeedsOcrError) {
        // Status already set to needs_ocr by the pipeline (markNeedsOcr) —
        // surfaced as a normal result, not an error.
        return ok({ document_id: body.document_id, status: "needs_ocr", error: err.message }, { status: 200 });
      }
      if (err instanceof IngestError) {
        await recordIngestFailure(db, body.document_id, err.stage, err.message);
        return ok(
          {
            document_id: body.document_id,
            status: err.stage === "parsing" ? "parse_failed" : err.stage === "chunking" ? "chunk_failed" : "embed_failed",
            error: err.message,
          },
          { status: 200 },
        );
      }
      // Storage/DB/unknown failures (e.g. "Supabase download failed") — record
      // them on the document so the panel shows the REAL reason, and return a
      // graceful error instead of an unhandled 500.
      const message = err instanceof Error ? err.message : String(err);
      await recordIngestFailure(db, body.document_id, "parsing", message).catch(() => undefined);
      return ok({ document_id: body.document_id, status: "parse_failed", error: message }, { status: 200 });
    }
  } catch (err) {
    return fail(err);
  }
}
