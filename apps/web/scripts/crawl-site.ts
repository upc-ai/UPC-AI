/**
 * Local bulk crawl of the college website (RAG v2 bootstrap, item 28 plan).
 * Usage: pnpm crawl:site -- --url https://www.upcollege.ac.in/ [--pages 120] [--pdfs 40] [--depth 3]
 *
 * Same lifecycle as the server sync route (hash-dedupe, version lineage,
 * Website Sync category, lands at "indexed" = Ready to publish — NEVER auto-
 * published) but with a bigger crawl budget than the Vercel 60s route allows
 * plus the pacing + verification the free-tier embedding quota needs:
 *   - 4s pause between documents (Gemini free tier 429s degrade silently to
 *     BM25-only otherwise)
 *   - after runIngestion, if embedded=false while an embedder IS configured,
 *     re-run the pipeline with backoff (idempotent — chunks are rebuilt)
 *   - full report at the end: new / changed / unchanged / failed / no-text
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, desc } from "drizzle-orm";
import { createDb, documents, ingestionJobs, knowledgeCategories, auditLogs } from "@upc/db";
import {
  resolveStorageConfig,
  uploadRaw,
  writeRawLocal,
  sha256Hex,
  objectPathFor,
  STORAGE_BUCKET,
  runIngestion,
  recordIngestFailure,
  IngestError,
  type IngestEnv,
} from "@upc/ingest";
import { crawlCollegeSite } from "../src/modules/sync/crawler";

const SYNC_SLUG = "website-sync";
const DOC_PAUSE_MS = 4_000; // pacing between document ingests (embedding quota)
const EMBED_RETRY_DELAYS = [15_000, 45_000, 90_000]; // backoff for embed-degraded docs

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const url =
    get("--url") ??
    process.env.COLLEGE_WEBSITE_URL ??
    "https://www.upcollege.ac.in/";
  const maxPages = Number(get("--pages") ?? 120);
  const maxPdfs = Number(get("--pdfs") ?? 40);
  const maxDepth = Number(get("--depth") ?? 3);
  if (!/^https?:\/\//.test(url)) throw new Error(`Invalid URL: ${url}`);

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = createDb(process.env.DATABASE_URL);

  const ingestEnv: IngestEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY,
    EMBEDDING_BASE_URL: process.env.EMBEDDING_BASE_URL,
    OPENAI_EMBEDDING_KEY: process.env.OPENAI_EMBEDDING_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };
  let customProviders: { name: string; baseUrl: string; apiKey: string }[] = [];
  try {
    customProviders = process.env.AI_CUSTOM_PROVIDERS ? JSON.parse(process.env.AI_CUSTOM_PROVIDERS) : [];
  } catch {
    /* malformed env — embeddings fall through to managed fallback */
  }
  // Sanity: resolve what the pipeline will use for embeddings
  const { resolveEmbedConfig } = await import("@upc/ingest");
  const direct = resolveEmbedConfig(ingestEnv);
  const gemini = customProviders.find((p) => /generativelanguage/.test(p.baseUrl));
  const embedder = direct ?? (gemini ? { provider: "gemini" as const, apiKey: gemini.apiKey, baseUrl: gemini.baseUrl } : null);
  if (!embedder) {
    throw new Error("No embedding config resolved (EMBEDDING_API_KEY / GEMINI_API_KEY / AI_CUSTOM_PROVIDERS) — refusing to run a BM25-only bulk load");
  }
  console.log(`[crawl] embedder: ${embedder.provider} (model gemini-embedding-001 / text-embedding-3-small, 1536d)`);
  console.log(`[crawl] start: ${url}  budget: ${maxPages} pages, ${maxPdfs} pdfs, depth ${maxDepth}`);

  const storage = resolveStorageConfig(ingestEnv);
  console.log(`[crawl] storage: ${storage ? `supabase (${STORAGE_BUCKET})` : "local disk (apps/web/storage)"}`);

  // ── Phase 1: crawl ─────────────────────────────────────────────────────
  console.log(`[crawl] crawling… (politeness 300ms, this takes a few minutes)`);
  const pages = await crawlCollegeSite(url, { maxPages, maxPdfs, maxDepth });
  const htmlPages = pages.filter((p) => p.kind === "html");
  const pdfDocs = pages.filter((p) => p.kind === "pdf");
  console.log(`[crawl] got ${htmlPages.length} text pages + ${pdfDocs.length} PDFs`);

  // ── Phase 2: ensure category ────────────────────────────────────────────
  let [category] = await db.select().from(knowledgeCategories).where(eq(knowledgeCategories.slug, SYNC_SLUG)).limit(1);
  if (!category) {
    [category] = await db
      .insert(knowledgeCategories)
      .values({ slug: SYNC_SLUG, name: "Website Sync", icon: "🌐" })
      .returning();
  }

  // uploadedBy: the super_admin account (audit trail shows who/what)
  const { users } = await import("@upc/db");
  const [admin] = await db.select().from(users).where(eq(users.email, "theupcai@gmail.com")).limit(1);
  const uploadedBy = admin?.id ?? null;

  // ── Phase 3: ingest each unit, paced ───────────────────────────────────
  let created = 0;
  let changed = 0;
  let unchanged = 0;
  const failed: { title: string; reason: string }[] = [];
  const noText: string[] = []; // scanned PDFs etc. — flagged, not indexed
  const degraded: string[] = []; // ended BM25-only after retries

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const label = `[${i + 1}/${pages.length}] ${page.title || page.url}`;
    try {
      const bytes = page.kind === "pdf" ? page.bytes! : Buffer.from(page.text, "utf-8");
      const hash = sha256Hex(bytes);

      const [prev] = await db
        .select({ id: documents.id, canonicalId: documents.canonicalId, version: documents.version, contentHash: documents.contentHash })
        .from(documents)
        .where(eq(documents.sourceUrl, page.url))
        .orderBy(desc(documents.version))
        .limit(1);

      if (prev && prev.contentHash === hash) {
        unchanged++;
        console.log(`[skip] ${label} — unchanged since last sync`);
        continue;
      }

      const mimeType = page.kind === "pdf" ? "application/pdf" : "text/plain";
      const extension = page.kind === "pdf" ? "pdf" : "txt";

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
          uploadedBy,
          status: "uploaded",
          ...(prev ? { canonicalId: prev.canonicalId, version: prev.version + 1 } : {}),
        })
        .returning({ id: documents.id });
      await db.insert(ingestionJobs).values({ documentId: doc!.id, jobType: "ingest_document", status: "queued" });

      // Pipeline; embedding-degraded results get paced retries
      let result: Awaited<ReturnType<typeof runIngestion>>;
      try {
        result = await runIngestion(db, doc!.id, ingestEnv, customProviders);
        for (let attempt = 0; !result.embedded && attempt < EMBED_RETRY_DELAYS.length; attempt++) {
          console.log(`[embed-retry ${attempt + 1}/${EMBED_RETRY_DELAYS.length}] ${label} — no vectors, waiting ${EMBED_RETRY_DELAYS[attempt]! / 1000}s…`);
          await sleep(EMBED_RETRY_DELAYS[attempt]!);
          result = await runIngestion(db, doc!.id, ingestEnv, customProviders);
        }
      } catch (err) {
        if (err instanceof IngestError) {
          await recordIngestFailure(db, doc!.id, err.stage, err.message);
          if (err.stage === "parsing") {
            noText.push(page.title || page.url);
            console.log(`[no-text] ${label} — ${err.message}`);
          } else {
            failed.push({ title: page.title || page.url, reason: `${err.stage}: ${err.message}` });
            console.log(`[failed] ${label} — ${err.message}`);
          }
          continue;
        }
        throw err;
      }

      const finalResult = result;
      if (!finalResult.embedded) {
        degraded.push(page.title || page.url);
        console.log(`[degraded] ${label} — ${finalResult.chunks} chunks, BM25-only (all embed retries exhausted)`);
      } else if (prev) {
        changed++;
        console.log(`[changed] ${label} — v${prev.version + 1}, ${finalResult.chunks} chunks embedded`);
      } else {
        created++;
        console.log(`[new] ${label} — ${finalResult.chunks} chunks embedded`);
      }

      // Inter-document pacing (skip only after actual pipeline work)
      await sleep(DOC_PAUSE_MS);
    } catch (err) {
      failed.push({ title: page.title || page.url, reason: err instanceof Error ? err.message : String(err) });
      console.log(`[failed] ${label} — ${err instanceof Error ? err.message : err}`);
    }
  }

  const stillDegraded = [...new Set(degraded)];

  // ── Audit + report ───────────────────────────────────────────────────
  if (uploadedBy) {
    await db.insert(auditLogs).values({
      actorId: uploadedBy,
      action: "website_sync",
      resourceType: "setting",
      changeSummary: `Local bulk crawl of ${url}: ${created} new, ${changed} changed, ${unchanged} unchanged, ${noText.length} no-text, ${stillDegraded.length} embed-degraded, ${failed.length} failed`,
    });
  }

  console.log("\n────────────── Crawl report ──────────────");
  console.log(`Start URL:    ${url}`);
  console.log(`Pages found:  ${htmlPages.length} text + ${pdfDocs.length} PDFs`);
  console.log(`New:          ${created}`);
  console.log(`Changed:      ${changed}`);
  console.log(`Unchanged:    ${unchanged} (hash-deduped)`);
  console.log(`No-text:      ${noText.length} (scanned/empty — not indexed)`);
  console.log(`Embed-degraded (BM25-only): ${stillDegraded.length}`);
  console.log(`Failed:       ${failed.length}`);
  if (noText.length) {
    console.log("\nNo-text (set aside, needs OCR):");
    for (const t of noText) console.log(`  - ${t}`);
  }
  if (stillDegraded.length) {
    console.log("\nBM25-only (re-run sync later or Process→Retry in panel):");
    for (const t of stillDegraded) console.log(`  - ${t}`);
  }
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  - ${f.title}: ${f.reason}`);
  }
  console.log("\nAll indexed docs are at 'Ready to publish' — review in /admin/documents.");
  process.exit(0);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
