import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, auditLogs } from "@upc/db";
import { ApiError, getEnv } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth, canManageDocuments } from "@/lib/auth/guard";
import { resolveStorageConfig, deleteObject } from "@upc/ingest";

export const dynamic = "force-dynamic";

/**
 * DELETE /v1/admin/documents/[id] — permanently removes the document and every
 * version sharing its canonicalId. Chunks, embeddings and ingestion jobs
 * cascade at the DB level; raw storage objects are deleted best-effort with
 * the service key (local-disk rows keep their files — they die with the row's
 * data anyway). Audited with the document title.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const claims = await requireAuth(req);
    if (!canManageDocuments(claims)) {
      throw new ApiError("FORBIDDEN", "Only knowledge-base admins can delete documents");
    }

    const db = getDb();
    const [doc] = await db
      .select({ id: documents.id, title: documents.title, canonicalId: documents.canonicalId })
      .from(documents)
      .where(eq(documents.id, params.id))
      .limit(1);
    if (!doc) throw new ApiError("RESOURCE_NOT_FOUND", "Document not found");

    const versions = await db
      .select({ id: documents.id, storagePath: documents.storagePath })
      .from(documents)
      .where(eq(documents.canonicalId, doc.canonicalId));

    const env = getEnv();
    const storage = resolveStorageConfig({
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    });

    // Best-effort raw-file cleanup — never blocks the DB delete.
    const storageErrors: string[] = [];
    if (storage) {
      for (const v of versions) {
        if (!v.storagePath || !v.storagePath.startsWith(`${storage.bucket}/`)) continue;
        try {
          await deleteObject(storage, v.storagePath.slice(storage.bucket.length + 1));
        } catch (err) {
          storageErrors.push(err instanceof Error ? err.message : String(err));
        }
      }
    }

    await db.delete(documents).where(eq(documents.canonicalId, doc.canonicalId));

    await db.insert(auditLogs).values({
      actorId: claims.sub,
      action: "document_deleted",
      resourceType: "document",
      resourceId: doc.id,
      changeSummary: `Deleted "${doc.title}"${versions.length > 1 ? ` (+${versions.length - 1} older version(s))` : ""}${
        storageErrors.length ? ` — ${storageErrors.length} storage file(s) could not be removed` : ""
      }`,
    });

    return ok({ deleted: versions.length, storage_errors: storageErrors });
  } catch (err) {
    return fail(err);
  }
}
