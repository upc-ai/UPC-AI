// Knowledge-base quality audit (RAG hardening, item 8).
// Checks: published docs with missing embeddings · orphan chunks/embeddings ·
// duplicate documents (same content hash) · stuck ingestion · needs_ocr
// inventory · published docs with processing errors.
// Exit 1 on hard failures (missing embeddings, orphans, duplicates).
// Run: pnpm kb:audit
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });
let hardFailures = 0;

// 1. Published documents must have one vector per chunk
const published = await sql`
  select d.id, d.title,
         (select count(*)::int from chunks c where c.document_id = d.id) as chunks,
         (select count(*)::int from embeddings e join chunks c on c.id = e.chunk_id where c.document_id = d.id) as vectors,
         d.embedding_model, d.processing_error
  from documents d where d.status = 'published'
`;
const missingVecs = published.filter((d) => d.chunks !== d.vectors || !d.embedding_model || d.processing_error);
console.log(`── published documents: ${published.length}`);
if (missingVecs.length) {
  hardFailures += missingVecs.length;
  console.log(`  ✗ ${missingVecs.length} published docs with embedding gaps:`);
  for (const d of missingVecs) console.log(`    - ${d.title.slice(0, 60)} (${d.vectors}/${d.chunks} vectors, model=${d.embedding_model ?? "none"}, err=${d.processing_error ?? "-"})`);
} else {
  console.log(`  ✓ all published docs fully vectorized, no processing errors`);
}

// 2. Orphan chunks / embeddings (should be impossible via FK — audit anyway)
const orphans = await sql`
  select
    (select count(*)::int from chunks c left join documents d on d.id = c.document_id where d.id is null) as orphan_chunks,
    (select count(*)::int from embeddings e left join chunks c on c.id = e.chunk_id where c.id is null) as orphan_embeddings
`;
console.log(`── orphans: chunks=${orphans[0].orphan_chunks}, embeddings=${orphans[0].orphan_embeddings}`);
if (orphans[0].orphan_chunks || orphans[0].orphan_embeddings) {
  hardFailures++;
  console.log(`  ✗ orphan rows found — cleanup required`);
}

// 3. Duplicate LIVE documents by content hash (draft/rejected/superseded
// copies are normal version history — only two simultaneously-live docs
// with identical content are a real problem)
const dupes = await sql`
  select content_hash, count(*)::int as n, min(title) as example_title
  from documents
  where content_hash is not null
    and status in ('published', 'indexed', 'in_review', 'approved')
  group by content_hash having count(*) > 1 order by n desc limit 10
`;
console.log(`── duplicate documents (same content hash): ${dupes.length} hash group(s)`);
if (dupes.length) {
  hardFailures++;
  for (const d of dupes) console.log(`  ✗ ${d.n}× "${d.example_title.slice(0, 60)}" (${d.content_hash.slice(0, 24)}…)`);
}

// 4. Stuck ingestion (processing statuses older than 24h)
const stuck = await sql`
  select title, status, updated_at from documents
  where status in ('uploaded', 'scanning', 'parsing', 'chunking', 'embedding')
    and updated_at < now() - interval '24 hours'
  order by updated_at limit 10
`;
console.log(`── stuck in processing >24h: ${stuck.length}`);
for (const d of stuck) console.log(`  ! ${d.status}: ${d.title.slice(0, 60)} (since ${new Date(d.updated_at).toISOString().slice(0, 16)})`);

// 5. needs_ocr inventory
const needsOcr = await sql`select title, processing_error from documents where status = 'needs_ocr' order by title`;
console.log(`── needs_ocr (scanned, awaiting OCR pass): ${needsOcr.length}`);
for (const d of needsOcr.slice(0, 8)) console.log(`  · ${d.title.slice(0, 70)}`);
if (needsOcr.length > 8) console.log(`  … and ${needsOcr.length - 8} more`);

// 6. Ready-to-publish queue (status only — is_active_version flips at publish)
const ready = await sql`
  select count(*)::int as n from documents where status = 'indexed'
`;
console.log(`── ready to publish (indexed): ${ready[0].n}`);

console.log(hardFailures ? `\n✗ AUDIT FAILED — ${hardFailures} issue group(s)` : `\n✓ AUDIT PASSED`);
await sql.end();
process.exit(hardFailures ? 1 : 0);
