import { NextRequest } from "next/server";
import { asc, count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { knowledgeCategories, documents } from "@upc/db";
import { ApiError, getEnv } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth, canManageDocuments } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * GET /v1/documents/categories — category picker for the upload form
 * (staff-gated: category slugs reveal internal knowledge-base organization).
 */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canManageDocuments(claims)) throw new ApiError("FORBIDDEN", "Only knowledge-base admins can view categories");

    const db = getDb();
    const rows = await db
      .select({
        id: knowledgeCategories.id,
        slug: knowledgeCategories.slug,
        name: knowledgeCategories.name,
        icon: knowledgeCategories.icon,
        documentCount: count(documents.id),
      })
      .from(knowledgeCategories)
      .leftJoin(documents, eq(documents.categoryId, knowledgeCategories.id))
      .groupBy(knowledgeCategories.id, knowledgeCategories.slug, knowledgeCategories.name, knowledgeCategories.icon)
      .orderBy(asc(knowledgeCategories.name));

    // storage_mode tells the upload UI which protocol step 1 speaks:
    // "supabase" = JSON + signed-URL PUT; "local" = single multipart POST.
    const storageMode = getEnv().SUPABASE_URL && getEnv().SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local";

    return ok({ categories: rows, storage_mode: storageMode });
  } catch (err) {
    return fail(err);
  }
}
