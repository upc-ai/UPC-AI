import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, auditLogs } from "@upc/db";
import { ApiError } from "@upc/core";
import { canPublish } from "@upc/ingest";
import { ok, fail } from "@/lib/api";
import { requireAuth, canReviewDocuments } from "@/lib/auth/guard";

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "publish"]),
  notes: z.string().max(2000).optional(),
});

/** POST /v1/admin/documents/[id]/review — approve → publish (atomic active-version swap). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const claims = await requireAuth(req);
    const body = actionSchema.parse(await req.json());
    if (!canReviewDocuments(claims)) {
      throw new ApiError("FORBIDDEN", "Insufficient permissions");
    }

    const db = getDb();
    const [doc] = await db.select().from(documents).where(eq(documents.id, params.id)).limit(1);
    if (!doc) throw new ApiError("RESOURCE_NOT_FOUND", "Document not found");

    if (body.action === "reject") {
      if (doc.status !== "in_review" && doc.status !== "indexed") {
        throw new ApiError("VALIDATION_ERROR", `Cannot reject a document in status ${doc.status}`);
      }
      await db.update(documents).set({ status: "draft", processingError: body.notes ?? null }).where(eq(documents.id, doc.id));
    } else {
      if (doc.status !== "indexed") {
        throw new ApiError("VALIDATION_ERROR", `Document must be indexed before approval (current: ${doc.status})`);
      }
      // Safety invariant: failed/unfinished ingestion and missing embeddings
      // can never be published (pure logic in @upc/ingest, unit-tested).
      const [counts] = (await db.execute(sql`
        select
          (select count(*)::int from chunks c where c.document_id = ${doc.id}) as chunk_count,
          (select count(*)::int from embeddings e join chunks c on c.id = e.chunk_id where c.document_id = ${doc.id}) as embedding_count
      `)) as unknown as { chunk_count: number; embedding_count: number }[];
      const verdict = canPublish(
        { status: doc.status, processingError: doc.processingError },
        { chunkCount: counts?.chunk_count ?? 0, embeddingCount: counts?.embedding_count ?? 0 },
      );
      if (!verdict.ok) throw new ApiError("VALIDATION_ERROR", `Cannot publish: ${verdict.reason}`);
      // Supersede previous active version of this canonical doc, then publish.
      await db
        .update(documents)
        .set({ isActiveVersion: false, status: "superseded" })
        .where(and(eq(documents.canonicalId, doc.canonicalId), eq(documents.isActiveVersion, true)));
      await db
        .update(documents)
        .set({ status: "published", isActiveVersion: true, approvedBy: claims.sub, approvedAt: new Date(), publishedAt: new Date() })
        .where(eq(documents.id, doc.id));
    }

    await db.insert(auditLogs).values({
      actorId: claims.sub,
      action: body.action,
      resourceType: "document",
      resourceId: doc.id,
      changeSummary: `${body.action}d "${doc.title}"${body.notes ? ` — ${body.notes}` : ""}`,
    });

    return ok({ document_id: doc.id, status: body.action === "reject" ? "draft" : "published" });
  } catch (err) {
    return fail(err);
  }
}

/** GET /v1/admin/documents/[id]/review — single document fetch (reviewers). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const claims = await requireAuth(req);
    if (!canReviewDocuments(claims)) {
      throw new ApiError("FORBIDDEN", "Insufficient permissions");
    }
    const db = getDb();
    const [doc] = await db.select().from(documents).where(eq(documents.id, params.id)).limit(1);
    if (!doc) throw new ApiError("RESOURCE_NOT_FOUND", "Document not found");
    return ok(doc);
  } catch (err) {
    return fail(err);
  }
}
