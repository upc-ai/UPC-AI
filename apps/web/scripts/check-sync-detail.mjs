// Deep-dive: per-doc chunk/vector counts + job history for synced docs.
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const rows = await sql`
  select d.id, d.title, d.status, d.embedding_model,
         count(distinct c.id)::int as chunks,
         count(distinct e.chunk_id)::int as vectors
  from documents d
  left join chunks c on c.document_id = d.id and c.status = 'active'
  left join embeddings e on e.chunk_id = c.id
  where d.source_url is not null
  group by d.id, d.title, d.status, d.embedding_model
  order by d.created_at desc
`;
console.log("synced docs:");
for (const r of rows) {
  console.log(`  ${r.title.slice(0, 60).padEnd(60)} [${r.status}] chunks=${r.chunks} vectors=${r.vectors} model=${r.embedding_model ?? "-"}`);
}

console.log("\nembedding models in use:");
for (const r of await sql`select embedding_model, count(*)::int as n from embeddings group by 1`) {
  console.log(`  ${r.embedding_model}: ${r.n}`);
}

console.log("\ningestion jobs (synced docs):");
const jobs = await sql`
  select j.document_id, d.title, j.stage, j.status, j.stage_progress, j.error, j.started_at, j.completed_at
  from ingestion_jobs j join documents d on d.id = j.document_id
  where d.source_url is not null
  order by j.started_at desc limit 12
`;
for (const j of jobs) {
  console.log(`  ${j.title.slice(0, 50).padEnd(50)} stage=${j.stage} status=${j.status} err=${j.error ?? "-"}`);
}

console.log("\nvectors created in the last 6 hours (by chunk age):");
for (const r of await sql`
  select count(*)::int as n from embeddings e join chunks c on c.id = e.chunk_id
  where c.created_at > now() - interval '6 hours'
`) {
  console.log(`  ${r.n}`);
}
await sql.end();
