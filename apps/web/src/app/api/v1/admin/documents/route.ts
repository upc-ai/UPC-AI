import { NextRequest } from "next/server";
import { and, desc, eq, count, SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, knowledgeCategories, users, ingestionJobs } from "@upc/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth, canManageDocuments } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const VALID_STATUSES = new Set([
  "uploaded", "parsing", "chunking", "embedding", "indexed",
  "draft", "published", "superseded",
  "parse_failed", "chunk_failed", "embed_failed",
]);

/**
 * GET /v1/admin/documents?status=&page= — staff-visible document list for the
 * admin page (upload → review → publish lifecycle in one table).
 */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canManageDocuments(claims)) throw new ApiError("FORBIDDEN", "Only knowledge-base admins can view documents");

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    if (status && !VALID_STATUSES.has(status)) {
      throw new ApiError("VALIDATION_ERROR", `Unknown status filter: ${status}`);
    }
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

    const db = getDb();
    const where: SQL | undefined = status ? eq(documents.status, status as typeof documents.$inferSelect.status) : undefined;

    const rows = await db
      .select({
        id: documents.id,
        title: documents.title,
        fileType: documents.fileType,
        fileSizeBytes: documents.fileSizeBytes,
        status: documents.status,
        version: documents.version,
        canonicalId: documents.canonicalId,
        isActiveVersion: documents.isActiveVersion,
        chunkCount: documents.chunkCount,
        processingError: documents.processingError,
        createdAt: documents.createdAt,
        publishedAt: documents.publishedAt,
        categoryName: knowledgeCategories.name,
        categorySlug: knowledgeCategories.slug,
        uploaderName: users.displayName,
        jobStage: ingestionJobs.stage,
        jobProgress: ingestionJobs.stageProgress,
      })
      .from(documents)
      .leftJoin(knowledgeCategories, eq(documents.categoryId, knowledgeCategories.id))
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .leftJoin(ingestionJobs, eq(ingestionJobs.documentId, documents.id))
      .where(where ? and(where) : undefined)
      .orderBy(desc(documents.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

    const [totals] = await db.select({ total: count() }).from(documents).where(where ? and(where) : undefined);

    return ok({
      documents: rows,
      total: totals?.total ?? 0,
      page,
      page_size: PAGE_SIZE,
    });
  } catch (err) {
    return fail(err);
  }
}
