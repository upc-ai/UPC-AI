import { NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, auditLogs } from "@upc/db";
import { ApiError } from "@upc/core";
import { canPublish } from "@upc/ingest";
import { ok, fail } from "@/lib/api";
import { requireAuth, canReviewDocuments } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /v1/admin/documents/bulk-publish — publish EVERY document that passes
 * the publish guard (indexed, no processing error, one vector per chunk).
 * The per-document invariant is identical to the single-publish route; docs
 * that fail the guard are skipped and reported with the reason. One audit row
 * summarizes the action.
 */
export async function POST(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canReviewDocuments(claims)) {
      throw new ApiError("FORBIDDEN", "Insufficient permissions");
    }
    const db = getDb();

    const rows = (await db.execute(sql`
      select d.id, d.title, d.processing_error,
             (select count(*)::int from chunks c where c.document_id = d.id) as chunk_count,
             (select count(*)::int from embeddings e join chunks c on c.id = e.chunk_id where c.document_id = d.id) as embedding_count
      from documents d
      where d.status = 'indexed'
    `)) as unknown as {
      id: string;
      title: string;
      processing_error: string | null;
      chunk_count: number;
      embedding_count: number;
    }[];

    let published = 0;
    const skipped: { title: string; reason: string }[] = [];
    for (const row of rows) {
      const verdict = canPublish(
        { status: "indexed", processingError: row.processing_error },
        { chunkCount: row.chunk_count, embeddingCount: row.embedding_count },
      );
      if (!verdict.ok) {
        skipped.push({ title: row.title, reason: verdict.reason ?? "failed publish guard" });
        continue;
      }
      const [doc] = await db
        .select({ canonicalId: documents.canonicalId })
        .from(documents)
        .where(eq(documents.id, row.id))
        .limit(1);
      if (!doc) continue;
      await db
        .update(documents)
        .set({ isActiveVersion: false, status: "superseded" })
        .where(and(eq(documents.canonicalId, doc.canonicalId), eq(documents.isActiveVersion, true)));
      await db
        .update(documents)
        .set({ status: "published", isActiveVersion: true, approvedBy: claims.sub, approvedAt: new Date(), publishedAt: new Date() })
        .where(eq(documents.id, row.id));
      published++;
    }

    await db.insert(auditLogs).values({
      actorId: claims.sub,
      action: "bulk_publish",
      resourceType: "document",
      changeSummary: `Bulk published ${published} documents${skipped.length ? `, skipped ${skipped.length} (failed publish guard)` : ""}`,
    });

    return ok({ published, skipped_count: skipped.length, skipped: skipped.slice(0, 10) });
  } catch (err) {
    return fail(err);
  }
}
