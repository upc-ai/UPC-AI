// One-off: create the HNSW cosine index on embeddings.embedding_vector.
// Run: node scripts/hnsw-index.mjs  (from apps/web)
// Plain JS on purpose (agent-shell constraint) — same statement is now also
// declared in packages/db schema so future pushes keep it.
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const idx = await sql`
  select indexname from pg_indexes
  where tablename = 'embeddings' and indexname = 'embeddings_vector_hnsw'
`;
if (idx.length > 0) {
  console.log("index already exists:", idx[0].indexname);
} else {
  const t0 = Date.now();
  await sql`create index if not exists embeddings_vector_hnsw on embeddings using hnsw (embedding_vector vector_cosine_ops)`;
  console.log(`created embeddings_vector_hnsw in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

const [{ count }] = await sql`select count(*)::int as count from embeddings`;
const indexes = await sql`
  select indexname from pg_indexes where tablename = 'embeddings' order by indexname
`;
console.log("embedding rows:", count);
console.log("indexes:", indexes.map((r) => r.indexname).join(", "));
await sql.end();
