// Quick knowledge-base state check. Run: node scripts/check-kb.mjs (from apps/web)
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const docs = await sql`
  select title, status, chunk_count, embedding_model,
         (source_url is not null) as synced, created_at
  from documents
  order by created_at desc
  limit 15
`;
console.log(`documents (latest ${docs.length}):`);
for (const d of docs) {
  console.log(
    `  [${d.status}]${d.synced ? " [sync]" : ""} ${d.title.slice(0, 70)} — ${d.chunk_count ?? 0} chunks, embed: ${d.embedding_model ?? "none"}`,
  );
}

const [{ synced }] = await sql`select count(*)::int as synced from documents where source_url is not null`;
const [{ vectors }] = await sql`select count(*)::int as vectors from embeddings`;
const [{ publishable }] = await sql`select count(*)::int as publishable from documents where status = 'indexed'`;
console.log(`\ntotals: ${synced} synced docs, ${publishable} indexed (ready to publish), ${vectors} vectors`);
await sql.end();
