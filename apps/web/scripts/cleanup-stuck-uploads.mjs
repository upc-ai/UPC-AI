// One-off: remove the 4 stuck "uploaded" test rows from 2026-09-05 panel
// testing (BSc Maths Sec A ×4) — abandoned uploads that can never process;
// the published original stays. Run: node scripts/cleanup-stuck-uploads.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const stuck = await sql`
  select id, title, status, created_at from documents
  where status = 'uploaded'
    and created_at < now() - interval '24 hours'
`;
console.log("stuck uploaded docs to remove:");
for (const d of stuck) console.log(`  ${d.title} (${new Date(d.created_at).toISOString().slice(0, 16)})`);

const del = await sql`
  delete from documents
  where status = 'uploaded' and created_at < now() - interval '24 hours'
  returning id
`;
console.log(`\nremoved ${del.length} stuck rows (their ingestion_jobs rows cascade)`);
await sql.end();
