import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, ingestionJobs, knowledgeCategories, auditLogs } from "@upc/db";
import { ApiError, getEnv } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth, canManageDocuments } from "@/lib/auth/guard";
import {
  resolveStorageConfig,
  createSignedUploadUrl,
  writeRawLocal,
  sha256Hex,
  objectPathFor,
  STORAGE_BUCKET,
} from "@upc/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Route files may only export HTTP handlers + route config — these stay local.
const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
};

const MAX_BYTES = 50 * 1024 * 1024;
void MAX_BYTES;

const metadataSchema = z.object({
  title: z.string().min(1).max(500),
  category_slug: z.string().min(1),
  mime_type: z.string().min(1).optional(),
  size_bytes: z.coerce.number().int().nonnegative().optional(),
  filename: z.string().min(1).max(300).optional(),
  department_id: z.string().uuid().nullable().optional(),
  access_level: z.enum(["public", "internal", "restricted"]).default("public"),
  language: z.enum(["en", "hi", "en_hi"]).default("en"),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  description: z.string().max(2000).optional(),
  /** When replacing an older document, carry the canonicalId and bump version. */
  supersedes_document_id: z.string().uuid().nullable().optional(),
});

/**
 * POST /v1/documents/upload — step 1 of the two-phase flow.
 * Supabase mode: creates the document row and returns a signed upload URL;
 * the browser PUTs the raw bytes straight to Supabase Storage (bypasses the
 * Vercel ~4.5MB body cap), then calls /documents/upload-complete.
 * Local mode (dev, no SUPABASE_*): accepts multipart file+metadata and
 * writes to disk — the single-request legacy path.
 */
export async function POST(req: NextRequest) {
  try {
    const claims = await requireAuth(req);

    // Role-only gate (see guard.ts) — user_type alone must never pass.
    if (!canManageDocuments(claims)) {
      throw new ApiError("FORBIDDEN", "Only knowledge-base admins can upload documents");
    }

    const db = getDb();
    const env = getEnv();
    const storage = resolveStorageConfig({ SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY });

    // ── Local mode: multipart (legacy single-request path) ─────────────
    if (!storage) {
      return localMultipartUpload(req, claims.sub, db);
    }

    // ── Supabase mode: JSON metadata only, file goes browser → Supabase ─
    const body = metadataSchema.parse(await req.json());
    const mime = body.mime_type ?? "";
    if (!ALLOWED_MIME[mime]) {
      throw new ApiError("VALIDATION_ERROR", `Unsupported file type: ${mime}`);
    }
    if ((body.size_bytes ?? 0) > MAX_BYTES) {
      throw new ApiError("VALIDATION_ERROR", "File exceeds 50MB limit");
    }

    const [category] = await db.select().from(knowledgeCategories).where(eq(knowledgeCategories.slug, body.category_slug)).limit(1);
    if (!category) throw new ApiError("VALIDATION_ERROR", `Unknown category: ${body.category_slug}`);

    // Version lineage when superseding. crypto.randomUUID() returns a narrow
    // template-literal type while the column reads as plain string — widen here.
    let canonicalId: string = randomUUID();
    let version = 1;
    if (body.supersedes_document_id) {
      const [prev] = await db.select({ id: documents.canonicalId, version: documents.version })
        .from(documents)
        .where(eq(documents.id, body.supersedes_document_id))
        .limit(1);
      if (prev) {
        canonicalId = prev.id;
        version = prev.version + 1;
      }
    }

    const documentId = randomUUID();
    const extension = ALLOWED_MIME[mime]!;
    const objectPath = objectPathFor(documentId, extension);
    const storagePath = `${STORAGE_BUCKET}/${objectPath}`;

    const [doc] = await db
      .insert(documents)
      .values({
        id: documentId,
        title: body.title,
        description: body.description ?? null,
        fileType: extension,
        fileSizeBytes: body.size_bytes ?? null,
        mimeType: mime,
        storagePath,
        categoryId: category.id,
        departmentId: body.department_id ?? null,
        accessLevel: body.access_level,
        language: body.language,
        effectiveDate: body.effective_date ?? null,
        expiryDate: body.expiry_date ?? null,
        uploadedBy: claims.sub,
        status: "uploaded",
        canonicalId,
        version,
      })
      .returning({ id: documents.id });

    const { url, token } = await createSignedUploadUrl(storage, objectPath);

    const [job] = await db
      .insert(ingestionJobs)
      .values({ documentId: doc!.id, jobType: "ingest_document", status: "queued" })
      .returning({ id: ingestionJobs.id });

    await db.insert(auditLogs).values({
      actorId: claims.sub,
      action: "upload",
      resourceType: "document",
      resourceId: doc!.id,
      changeSummary: `Uploaded "${body.title}"`,
    });

    return ok(
      {
        document_id: doc!.id,
        job_id: job!.id,
        upload_url: url,
        upload_token: token,
        storage_mode: "supabase",
        estimated_processing_time_seconds: 60,
      },
      { status: 202 },
    );
  } catch (err) {
    return fail(err);
  }
}

/** Local-disk upload (dev): file bytes arrive in the same request. */
async function localMultipartUpload(req: NextRequest, userId: string, db: ReturnType<typeof getDb>) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const form = await req.formData();
  const file = form.get("file");
  const metadataRaw = form.get("metadata");
  if (!(file instanceof File)) throw new ApiError("VALIDATION_ERROR", "file is required");
  if (file.size > MAX_BYTES) throw new ApiError("VALIDATION_ERROR", "File exceeds 50MB limit");

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME[mime]) {
    throw new ApiError("VALIDATION_ERROR", `Unsupported file type: ${mime}`);
  }
  const metadata = metadataSchema.parse(JSON.parse(typeof metadataRaw === "string" ? metadataRaw : "{}"));

  const [category] = await db
    .select()
    .from(knowledgeCategories)
    .where(eq(knowledgeCategories.slug, metadata.category_slug))
    .limit(1);
  if (!category) throw new ApiError("VALIDATION_ERROR", `Unknown category: ${metadata.category_slug}`);

  // Version lineage when superseding (string-typed: see the Supabase branch above)
  let canonicalId: string = randomUUID();
  let version = 1;
  if (metadata.supersedes_document_id) {
    const [prev] = await db.select({ id: documents.canonicalId, version: documents.version })
      .from(documents)
      .where(eq(documents.id, metadata.supersedes_document_id))
      .limit(1);
    if (prev) {
      canonicalId = prev.id;
      version = prev.version + 1;
    }
  }

  const fileName = `${randomUUID()}.${ALLOWED_MIME[mime]}`;
  const storagePath = `storage/raw/${fileName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeRawLocal(storagePath, bytes);
  const contentHash = sha256Hex(bytes);

  const [doc] = await db
    .insert(documents)
    .values({
      title: metadata.title,
      description: metadata.description ?? null,
      fileType: ALLOWED_MIME[mime]!,
      fileSizeBytes: file.size,
      mimeType: mime,
      storagePath,
      contentHash,
      categoryId: category.id,
      departmentId: metadata.department_id ?? null,
      accessLevel: metadata.access_level,
      language: metadata.language,
      effectiveDate: metadata.effective_date ?? null,
      expiryDate: metadata.expiry_date ?? null,
      uploadedBy: userId,
      status: "uploaded",
      canonicalId,
      version,
    })
    .returning({ id: documents.id });

  const [job] = await db
    .insert(ingestionJobs)
      .values({ documentId: doc!.id, jobType: "ingest_document", status: "queued" })
    .returning({ id: ingestionJobs.id });

  await db.insert(auditLogs).values({
    actorId: userId,
    action: "upload",
    resourceType: "document",
    resourceId: doc!.id,
    changeSummary: `Uploaded "${metadata.title}"`,
  });

  return ok(
    {
      document_id: doc!.id,
      job_id: job!.id,
      storage_mode: "local",
      content_hash: contentHash,
      status: "processing",
      estimated_processing_time_seconds: 61,
    },
    { status: 202 },
  );
}

/** GET /v1/documents/upload?id=... — polling status (SSE arrives with the portal polish). */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new ApiError("VALIDATION_ERROR", "id is required");
    const db = getDb();
    const [doc] = await db
      .select({
        id: documents.id,
        status: documents.status,
        chunkCount: documents.chunkCount,
        processingError: documents.processingError,
      })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (!doc) throw new ApiError("RESOURCE_NOT_FOUND", "Document not found");
    return ok(doc);
  } catch (err) {
    return fail(err);
  }
}
