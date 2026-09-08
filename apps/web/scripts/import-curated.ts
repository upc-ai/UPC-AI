/**
 * Curation-driven bulk importer (RAG organization, execution step).
 * Reads to-import/curation.csv (user-reviewed; include=Y rows only) and
 * imports each item through the standard pipeline: parse → chunk → embed
 * (paced + retried) → Ready to publish. NEVER auto-publishes — retrieval only
 * serves `published` docs, so nothing reaches students until reviewed.
 *
 * Idempotent + resumable:
 *   - global content-hash dedupe across ALL documents (re-runs skip everything
 *     already imported, so a crash mid-run is recoverable by re-running)
 *   - same-sourceURL lineage bumps the version instead of duplicating
 *   - unchanged chunks reuse their stored vectors (pipeline-side), so retry
 *     passes only embed genuinely new/missing content
 *
 * Usage: pnpm import:curated [--dry-run]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createDb, documents, ingestionJobs, knowledgeCategories, auditLogs, users } from "@upc/db";
import {
  resolveStorageConfig,
  writeRawLocal,
  uploadRaw,
  sha256Hex,
  objectPathFor,
  STORAGE_BUCKET,
  runIngestion,
  recordIngestFailure,
  IngestError,
  NeedsOcrError,
  type IngestEnv,
} from "@upc/ingest";

const OUT = path.resolve(import.meta.dirname, "../../../to-import/crawl");
const CSV_PATH = path.resolve(import.meta.dirname, "../../../to-import/curation.csv");
const DOC_PAUSE_MS = 4_000;
const EMBED_RETRY_DELAYS = [15_000, 45_000, 90_000];

const CATEGORY_NAMES: Record<string, string> = {
  "about-college": "About the College",
  courses: "Courses & Programs",
  facilities: "Facilities",
  "study-material": "Old Papers & E-Content",
  forms: "Forms & Certificates",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Minimal RFC-4180 CSV parser (quoted fields, doubled quotes, CRLF). */
function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const header = nonEmpty[0]!.map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((k, i) => [k, (r[i] ?? "").trim()])));
}

interface CuratedRow {
  include: string;
  file: string;
  kind: string;
  url: string;
  title: string;
  category: string;
  language: string;
  text_status: string;
  notes: string;
}

function normalizeRow(r: Record<string, string>): CuratedRow {
  return {
    include: r.include ?? "",
    file: r.file ?? "",
    kind: r.kind ?? "",
    url: r.url ?? "",
    title: r.title ?? "",
    category: r.category ?? "",
    language: r.language ?? "",
    text_status: r.text_status ?? "",
    notes: r.notes ?? "",
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = createDb(process.env.DATABASE_URL);

  const rows: CuratedRow[] = parseCsv(readFileSync(CSV_PATH, "utf-8")).map(normalizeRow);
  const selected = rows.filter((r) => (r.include ?? "").toUpperCase() === "Y");
  console.log(`[import] curation: ${rows.length} rows, ${selected.length} selected (include=Y)${dryRun ? " — DRY RUN" : ""}`);

  // Categories: ensure every needed slug exists
  const neededSlugs = [...new Set(selected.map((r) => r.category).filter(Boolean))];
  const catIdBySlug = new Map<string, string>();
  for (const cat of await db.select().from(knowledgeCategories)) catIdBySlug.set(cat.slug, cat.id);
  for (const slug of neededSlugs) {
    if (!catIdBySlug.has(slug)) {
      const name = CATEGORY_NAMES[slug];
      if (!name) {
        console.log(`[category] unknown slug "${slug}" with no name mapping — rows will be skipped`);
        continue;
      }
      const [created] = await db.insert(knowledgeCategories).values({ slug, name, icon: "📚" }).returning();
      catIdBySlug.set(slug, created!.id);
      console.log(`[category] created ${slug}`);
    }
  }

  // Existing documents: hash → done-or-stale (resume), + URL lineage (versioning)
  const doneHashes = new Set<string>();
  const staleByHash = new Map<string, string>();
  const lineage = new Map<string, { canonicalId: string; version: number }>();
  const TERMINAL = new Set(["indexed", "published", "draft", "superseded", "archived", "needs_ocr"]);
  for (const d of await db
    .select({ id: documents.id, hash: documents.contentHash, url: documents.sourceUrl, canonicalId: documents.canonicalId, version: documents.version, status: documents.status })
    .from(documents)) {
    if (d.hash) {
      if (TERMINAL.has(d.status)) doneHashes.add(d.hash);
      else staleByHash.set(d.hash, d.id); // content stored, ingestion unfinished → resumable
    }
    if (d.url) lineage.set(d.url, { canonicalId: d.canonicalId, version: d.version });
  }

  async function runPipeline(docId: string, label: string) {
    let result = await runIngestion(db, docId, ingestEnv, customProviders);
    for (let attempt = 0; !result.embedded && attempt < EMBED_RETRY_DELAYS.length; attempt++) {
      console.log(`[embed-retry ${attempt + 1}] ${label} — waiting ${EMBED_RETRY_DELAYS[attempt]! / 1000}s…`);
      await sleep(EMBED_RETRY_DELAYS[attempt]!);
      result = await runIngestion(db, docId, ingestEnv, customProviders);
    }
    return result;
  }

  const [admin] = await db.select().from(users).where(eq(users.email, "theupcai@gmail.com")).limit(1);
  const uploadedBy = admin?.id ?? null;

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
    /* embeddings fall through to managed fallback */
  }
  const storage = resolveStorageConfig(ingestEnv);
  console.log(`[import] storage: ${storage ? `supabase (${STORAGE_BUCKET})` : "local disk"} | pacing ${DOC_PAUSE_MS / 1000}s between docs`);

  let imported = 0;
  let skippedDuplicate = 0;
  const requeued = new Set<string>();
  const needsOcr: string[] = [];
  const failed: { title: string; reason: string }[] = [];

  for (let i = 0; i < selected.length; i++) {
    const row = selected[i]!;
    const label = `[${i + 1}/${selected.length}] ${row.title.slice(0, 60)}`;
    const categoryId = catIdBySlug.get(row.category);
    if (!categoryId) {
      failed.push({ title: row.title, reason: `unknown category "${row.category}"` });
      continue;
    }

    // Read source bytes: pages → harvested .txt sibling; PDFs → the file itself
    const srcRel = row.kind === "page" ? row.file.replace(/\.html$/i, ".txt") : row.file;
    const abs = path.join(OUT, srcRel);
    let bytes: Buffer;
    try {
      bytes = readFileSync(abs);
    } catch (err) {
      failed.push({ title: row.title, reason: `source missing: ${err instanceof Error ? err.message : err}` });
      continue;
    }
    if (bytes.length < 80) {
      failed.push({ title: row.title, reason: `source too small (${bytes.length}b)` });
      continue;
    }

    const hash = sha256Hex(bytes);
    if (doneHashes.has(hash)) {
      skippedDuplicate++;
      continue; // idempotent re-run: content fully processed (any URL)
    }
    const staleId = staleByHash.get(hash);
    if (staleId) {
      // Resume: raw content already stored but ingestion never finished
      // (crash / network outage) — re-run the pipeline, never duplicate.
      try {
        const result = await runPipeline(staleId, label);
        staleByHash.delete(hash);
        doneHashes.add(hash);
        imported++;
        console.log(`[resumed] ${label} → ${row.category}${result.embedded ? "" : " (BM25-only — retried on next run)"}`);
        await sleep(DOC_PAUSE_MS);
      } catch (err) {
        if (err instanceof NeedsOcrError) {
          needsOcr.push(row.title);
          console.log(`[needs-ocr] ${label}`);
          continue;
        }
        failed.push({ title: row.title, reason: err instanceof Error ? err.message : String(err) });
        console.log(`[failed] ${label} — ${err instanceof Error ? err.message : err}`);
      }
      continue;
    }

    if (dryRun) {
      imported++;
      console.log(`[dry-run] ${label} → ${row.category} (${row.language}, ${(bytes.length / 1024).toFixed(0)} KB)`);
      continue;
    }

    try {
      const mimeType = row.kind === "pdf" ? "application/pdf" : "text/plain";
      const extension = row.kind === "pdf" ? "pdf" : "txt";

      let storagePath: string;
      if (storage) {
        const objectPath = objectPathFor(crypto.randomUUID(), extension);
        await uploadRaw(storage, objectPath, bytes, mimeType);
        storagePath = `${STORAGE_BUCKET}/${objectPath}`;
      } else {
        storagePath = `storage/raw/${crypto.randomUUID()}.${extension}`;
        await writeRawLocal(storagePath, bytes);
      }

      const prev = row.url ? lineage.get(row.url) : undefined;
      const [doc] = await db
        .insert(documents)
        .values({
          title: row.title.slice(0, 500),
          description: `Imported from ${row.url || "harvest"}`,
          fileType: extension,
          fileSizeBytes: bytes.length,
          mimeType,
          storagePath,
          contentHash: hash,
          sourceUrl: row.url || null,
          categoryId,
          uploadedBy,
          status: "uploaded",
          language: row.language || "en", // documents.language is notNull
          audience: "student",
          accessLevel: "public",
          ...(prev ? { canonicalId: prev.canonicalId, version: prev.version + 1 } : {}),
        })
        .returning({ id: documents.id });
      await db.insert(ingestionJobs).values({ documentId: doc!.id, jobType: "ingest_document", status: "queued" });

      doneHashes.add(hash);
      if (row.url) lineage.set(row.url, { canonicalId: prev?.canonicalId ?? doc!.id, version: prev ? prev.version + 1 : 1 });

      let embeddedAfterRetries = false;
      try {
        const result = await runPipeline(doc!.id, label);
        embeddedAfterRetries = result.embedded;
      } catch (err) {
        if (err instanceof NeedsOcrError) {
          needsOcr.push(row.title);
          console.log(`[needs-ocr] ${label}`);
          await sleep(DOC_PAUSE_MS);
          continue;
        }
        if (err instanceof IngestError) {
          await recordIngestFailure(db, doc!.id, err.stage, err.message);
          failed.push({ title: row.title, reason: `${err.stage}: ${err.message}` });
          console.log(`[failed] ${label} — ${err.message}`);
          continue;
        }
        throw err;
      }

      console.log(`[imported] ${label} → ${row.category}${embeddedAfterRetries ? "" : " (BM25-only — will retry on next run)"}`);
      imported++;
      await sleep(DOC_PAUSE_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Transient network (the direct DB host is IPv6-only and DNS flakes):
      // requeue once at the end of the run instead of failing the item.
      if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/i.test(msg) && !requeued.has(row.file)) {
        requeued.add(row.file);
        selected.push(row);
        console.log(`[conn-retry] ${label} — network error, requeued for end of run`);
        continue;
      }
      failed.push({ title: row.title, reason: msg });
      console.log(`[failed] ${label} — ${msg}`);
    }
  }

  if (!dryRun && uploadedBy) {
    try {
      await db.insert(auditLogs).values({
        actorId: uploadedBy,
        action: "bulk_import",
        resourceType: "document",
        changeSummary: `Curated bulk import: ${imported} imported, ${skippedDuplicate} duplicates skipped, ${needsOcr.length} needs-OCR, ${failed.length} failed (source: curation.csv)`,
      });
    } catch (err) {
      console.log(`[warn] audit log write failed (non-fatal): ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("\n────────────── Import report ──────────────");
  console.log(`Imported:          ${imported}${dryRun ? " (dry run — nothing written)" : ""}`);
  console.log(`Duplicates skipped:${skippedDuplicate}`);
  console.log(`Needs OCR:         ${needsOcr.length}`);
  console.log(`Failed:            ${failed.length}`);
  if (needsOcr.length) {
    console.log("\nNeeds OCR (set aside — worker OCR pass later):");
    for (const t of needsOcr) console.log(`  - ${t}`);
  }
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed.slice(0, 20)) console.log(`  - ${f.title}: ${f.reason}`);
    if (failed.length > 20) console.log(`  … and ${failed.length - 20} more`);
  }
  console.log("\nAll imported docs are at 'Ready to publish' — review + publish in /admin/documents.");
  process.exit(0);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
