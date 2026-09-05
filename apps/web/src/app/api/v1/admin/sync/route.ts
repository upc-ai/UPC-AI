import { NextRequest } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { documents, ingestionJobs, knowledgeCategories, auditLogs } from "@upc/db";
import { ApiError, getEnv } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth, canAdminPanel } from "@/lib/auth/guard";
import { resolveStorageConfig, uploadRaw, writeRawLocal, sha256Hex, objectPathFor, STORAGE_BUCKET, runIngestion, type IngestEnv } from "@upc/ingest";
import { crawlCollegeSite } from "@/modules/sync/crawler";

export const dynamic = "force-dynamic";
/** Vercel Hobby caps at 60s — the crawl budget (30 pages + 10 PDFs, 300ms delay)
 *  is sized to fit; Pro plans may raise this to 300. */
export const maxDuration = 60;

const bodySchema = z.object({
  url: z.string().url().optional(), // overrides the saved setting for this run
});

const SYNC_SLUG = "website-sync";
const SYNC_URL_KEY = "sync.college_website_url";

/**
 * POST /v1/admin/sync — crawl the college website and queue every new/changed
 * page through the standard ingest pipeline. Synced documents land at
 * "indexed" (Ready to publish) — nothing goes live without review (user rule).
 * Idempotent by content hash: unchanged pages are skipped entirely.
 */
export async function POST(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canAdminPanel(claims)) throw new ApiError("FORBIDDEN", "Admin panel access is restricted");

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const db = getDb();
    const env = getEnv();

    // URL precedence: request body > system_settings > COLLEGE_WEBSITE_URL env
    let startUrl = body.url ?? env.COLLEGE_WEBSITE_URL ?? "";
    if (!startUrl) {
      const rows = (await db.execute(
        sql`select value from system_settings where setting_key = ${SYNC_URL_KEY}`,
      )) as unknown as { value?: { url?: string } }[];
      startUrl = rows[0]?.value?.url ?? "";
    }
    if (!startUrl || !/^https?:\/\//.test(startUrl)) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "No college website URL configured — enter it in the Documents page sync card or set COLLEGE_WEBSITE_URL.",
      );
    }

    const pages = await crawlCollegeSite(startUrl);
    if (pages.length === 0) {
      return ok({
        new: 0,
        changed: 0,
        unchanged: 0,
        failed: 0,
        message: "Crawled the site but found no readable pages — check the URL.",
      });
    }

    // Ensure the sync category exists (idempotent)
    let [category] = await db.select().from(knowledgeCategories).where(eq(knowledgeCategories.slug, SYNC_SLUG)).limit(1);
    if (!category) {
      [category] = await db
        .insert(knowledgeCategories)
        .values({ slug: SYNC_SLUG, name: "Website Sync", icon: "🌐" })
        .returning();
    }

    const storage = resolveStorageConfig({
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    });
    const ingestEnv: IngestEnv = {
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      EMBEDDING_PROVIDER: env.EMBEDDING_PROVIDER,
      EMBEDDING_API_KEY: env.EMBEDDING_API_KEY,
      EMBEDDING_BASE_URL: env.EMBEDDING_BASE_URL,
      OPENAI_EMBEDDING_KEY: env.OPENAI_EMBEDDING_KEY,
      OPENAI_API_KEY: env.OPENAI_API_KEY,
    };
    let customProviders: { name: string; baseUrl: string; apiKey: string }[] = [];
    try {
      customProviders = env.AI_CUSTOM_PROVIDERS ? JSON.parse(env.AI_CUSTOM_PROVIDERS) : [];
    } catch {
      /* malformed env — embeddings fall through to managed fallback */
    }

    let created = 0;
    let changed = 0;
    let unchanged = 0;
    const failures: string[] = [];

    for (const page of pages) {
      try {
        const bytes = page.kind === "pdf" ? page.bytes! : Buffer.from(page.text, "utf-8");
        const hash = sha256Hex(bytes);

        // Previous sync lineage for this URL — newest version row
        const [prev] = await db
          .select({ id: documents.id, canonicalId: documents.canonicalId, version: documents.version, contentHash: documents.contentHash })
          .from(documents)
          .where(eq(documents.sourceUrl, page.url))
          .orderBy(desc(documents.version))
          .limit(1);

        if (prev && prev.contentHash === hash) {
          unchanged++;
          continue;
        }

        const mimeType = page.kind === "pdf" ? "application/pdf" : "text/plain";
        const extension = page.kind === "pdf" ? "pdf" : "txt";

        // Store raw (Supabase when configured, local disk otherwise)
        let storagePath: string;
        if (storage) {
          const objectPath = objectPathFor(crypto.randomUUID(), extension);
          await uploadRaw(storage, objectPath, bytes, mimeType);
          storagePath = `${STORAGE_BUCKET}/${objectPath}`;
        } else {
          storagePath = `storage/raw/${crypto.randomUUID()}.${extension}`;
          await writeRawLocal(storagePath, bytes);
        }

        const [doc] = await db
          .insert(documents)
          .values({
            title: page.title.slice(0, 500),
            description: `Synced from ${page.url}`,
            fileType: extension,
            fileSizeBytes: bytes.length,
            mimeType,
            storagePath,
            contentHash: hash,
            sourceUrl: page.url,
            categoryId: category!.id,
            uploadedBy: claims.sub,
            status: "uploaded",
            // A changed page becomes the next version of the same canonical doc
            ...(prev ? { canonicalId: prev.canonicalId, version: prev.version + 1 } : {}),
          })
          .returning({ id: documents.id });

        await db.insert(ingestionJobs).values({ documentId: doc!.id, jobType: "ingest_document", status: "queued" });

        // Standard pipeline inline (parse → chunk → embed → indexed)
        try {
          await runIngestion(db, doc!.id, ingestEnv, customProviders);
          if (prev) changed++;
          else created++;
        } catch {
          failures.push(page.title);
        }
      } catch {
        failures.push(page.title);
      }
    }

    await db.insert(auditLogs).values({
      actorId: claims.sub,
      action: "website_sync",
      resourceType: "setting",
      resourceId: SYNC_SLUG,
      changeSummary: `Synced ${startUrl}: ${created} new, ${changed} changed, ${unchanged} unchanged${failures.length ? `, ${failures.length} failed` : ""}`,
    });

    return ok({
      new: created,
      changed,
      unchanged,
      failed: failures.length,
      failures: failures.slice(0, 5),
      message: `${created} new, ${changed} changed, ${unchanged} unchanged. New and changed pages are waiting in the Documents queue for your review.`,
    });
  } catch (err) {
    return fail(err);
  }
}

/**
 * GET /v1/admin/sync — the currently configured sync URL (for the UI field).
 */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canAdminPanel(claims)) throw new ApiError("FORBIDDEN", "Admin panel access is restricted");
    const db = getDb();
    const env = getEnv();
    const rows = (await db.execute(
      sql`select value from system_settings where setting_key = ${SYNC_URL_KEY}`,
    )) as unknown as { value?: { url?: string } }[];
    return ok({ url: rows[0]?.value?.url ?? env.COLLEGE_WEBSITE_URL ?? "" });
  } catch (err) {
    return fail(err);
  }
}

/**
 * PUT /v1/admin/sync — persist the sync URL into system_settings.
 */
export async function PUT(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canAdminPanel(claims)) throw new ApiError("FORBIDDEN", "Admin panel access is restricted");
    const body = bodySchema.parse(await req.json());
    if (!body.url) throw new ApiError("VALIDATION_ERROR", "url is required");
    const db = getDb();
    await db.execute(sql`
      insert into system_settings (setting_key, value, category, updated_by, updated_at)
      values (${SYNC_URL_KEY}, ${JSON.stringify({ url: body.url })}::jsonb, 'general', ${claims.sub}, now())
      on conflict (setting_key) do update set value = ${JSON.stringify({ url: body.url })}::jsonb, updated_by = ${claims.sub}, updated_at = now()
    `);
    return ok({ url: body.url });
  } catch (err) {
    return fail(err);
  }
}
