import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents } from "@upc/db";
import { ApiError, getEnv } from "@upc/core";
import { fail } from "@/lib/api";
import { requireAuth, canManageDocuments } from "@/lib/auth/guard";
import { readRawFile, resolveStorageConfig } from "@upc/ingest";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/plain",
  html: "text/html",
};

/**
 * GET /v1/documents/[id]/file — stream the raw uploaded file to staff
 * (preview/download in the admin documents page). Streams from Supabase
 * Storage in prod, local disk in dev. Storage paths never reach the client.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const claims = await requireAuth(req);
    if (!canManageDocuments(claims)) {
      throw new ApiError("FORBIDDEN", "Only knowledge-base admins can view document files");
    }

    const db = getDb();
    const [doc] = await db
      .select({
        id: documents.id,
        title: documents.title,
        fileType: documents.fileType,
        mimeType: documents.mimeType,
        storagePath: documents.storagePath,
      })
      .from(documents)
      .where(eq(documents.id, params.id))
      .limit(1);
    if (!doc) throw new ApiError("RESOURCE_NOT_FOUND", "Document not found");

    const env = getEnv();
    const storage = resolveStorageConfig({
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    });
    const bytes = await readRawFile(doc.storagePath, storage);

    const contentType = doc.mimeType || CONTENT_TYPES[doc.fileType ?? ""] || "application/octet-stream";
    const safeTitle = doc.title.replace(/[^\w\s.-]/g, "").trim() || doc.id;
    const ext = doc.fileType ?? "bin";

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(safeTitle)}.${ext}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return fail(err);
  }
}
