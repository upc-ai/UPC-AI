import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents } from "@upc/db";
import { ApiError, getEnv } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth, canManageDocuments } from "@/lib/auth/guard";
import { resolveStorageConfig, objectExists } from "@upc/ingest";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  document_id: z.string().uuid(),
  content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
});

/**
 * POST /v1/documents/upload-complete — step 2 of the Supabase flow, called by
 * the browser after its direct PUT succeeds. Verifies the object actually
 * landed in the bucket (HEAD) and records the client-computed sha256.
 * Local mode never calls this (the multipart route already wrote the hash).
 */
export async function POST(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canManageDocuments(claims)) {
      throw new ApiError("FORBIDDEN", "Only knowledge-base admins can upload documents");
    }

    const body = bodySchema.parse(await req.json());
    const db = getDb();

    const [doc] = await db
      .select({ id: documents.id, storagePath: documents.storagePath, uploadedBy: documents.uploadedBy })
      .from(documents)
      .where(eq(documents.id, body.document_id))
      .limit(1);
    if (!doc) throw new ApiError("RESOURCE_NOT_FOUND", "Document not found");

    const env = getEnv();
    const storage = resolveStorageConfig({ SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY });
    if (!storage) {
      // Local mode: nothing to verify — the file already arrived with step 1.
      return ok({ document_id: doc.id, storage_mode: "local" });
    }

    const objectPath = doc.storagePath.slice(storage.bucket.length + 1);
    const exists = await objectExists(storage, objectPath);
    if (!exists) {
      throw new ApiError("VALIDATION_ERROR", "Upload didn't complete — the file never reached storage. Please retry.");
    }

    if (body.content_hash) {
      await db.update(documents).set({ contentHash: body.content_hash, updatedAt: new Date() }).where(eq(documents.id, doc.id));
    }

    return ok({ document_id: doc.id, storage_mode: "supabase" });
  } catch (err) {
    return fail(err);
  }
}
