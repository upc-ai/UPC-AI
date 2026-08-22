import { NextRequest } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { Queue } from "bullmq";
import { getDb } from "@/lib/db";
import { documents, ingestionJobs, knowledgeCategories, auditLogs } from "@upc/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
  "image/png": "image",
  "image/jpeg": "image",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
};

const metadataSchema = z.object({
  title: z.string().min(1).max(500),
  category_slug: z.string().min(1),
  department_id: z.string().uuid().nullable().optional(),
  access_level: z.enum(["public", "internal", "restricted"]).default("public"),
  language: z.enum(["en", "hi", "en_hi"]).default("en"),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  description: z.string().max(2000).optional(),
});

const MAX_BYTES = 50 * 1024 * 1024;

/**
 * POST /v1/documents/upload (multipart: file + metadata JSON).
 * v1 stores to local disk and enqueues ingestion; presigned+S3 adapter swaps in via env.
 */
export async function POST(req: NextRequest) {
  try {
    const claims = await requireAuth(req);

    // Staff-only: students must not feed documents into the knowledge base
    // (the approver role list matches the review endpoint's).
    const isStaff =
      claims.user_type === "faculty" ||
      claims.user_type === "admin" ||
      claims.roles.some((r) => ["faculty", "approver", "knowledge_admin", "super_admin"].includes(r));
    if (!isStaff) throw new ApiError("FORBIDDEN", "Only faculty and admins can upload documents");

    const db = getDb();

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

    // Category by slug
    const [category] = await db
      .select()
      .from(knowledgeCategories)
      .where(eq(knowledgeCategories.slug, metadata.category_slug))
      .limit(1);
    if (!category) throw new ApiError("VALIDATION_ERROR", `Unknown category: ${metadata.category_slug}`);

    // Store raw file (content-addressed-ish path)
    const storageDir = path.join(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"), "raw");
    await mkdir(storageDir, { recursive: true });
    const fileName = `${randomUUID()}.${ALLOWED_MIME[mime]}`;
    const storagePath = path.join(storageDir, fileName);
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(storagePath, bytes);
    const { createHash } = await import("node:crypto");
    const contentHash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

    // Document record (v1 uploads go straight to review after indexing)
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
        uploadedBy: claims.sub,
        status: "uploaded",
      })
      .returning({ id: documents.id });

    // Job record + enqueue
    const [job] = await db
      .insert(ingestionJobs)
      .values({ documentId: doc!.id, jobType: "ingest_document", status: "queued" })
      .returning({ id: ingestionJobs.id });

    // Ingestion queue needs a real Redis (Upstash) — without it, fail clearly
    // instead of hanging on a localhost connection that can't exist.
    if (!process.env.REDIS_URL) {
      throw new ApiError("INTERNAL_ERROR", "Document ingestion is not configured yet (missing REDIS_URL). Please try again later.");
    }
    const queue = new Queue("ingest", { connection: { url: process.env.REDIS_URL } });
    await queue.add("ingest", { documentId: doc!.id }, { jobId: job!.id, attempts: 3, backoff: { type: "exponential", delay: 5000 } });
    await queue.close();

    await db.insert(auditLogs).values({
      actorId: claims.sub,
      action: "upload",
      resourceType: "document",
      resourceId: doc!.id,
      changeSummary: `Uploaded "${metadata.title}"`,
    });

    return ok(
      {
        document_id: doc!.id,
        job_id: job!.id,
        status: "processing",
        estimated_processing_time_seconds: 60,
      },
      { status: 202 },
    );
  } catch (err) {
    return fail(err);
  }
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
    void getRedis;
    return ok(doc);
  } catch (err) {
    return fail(err);
  }
}
