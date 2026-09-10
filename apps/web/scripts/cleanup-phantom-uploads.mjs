// One-off: remove the 5 phantom upload rows from 2026-09-08 (created before
// the upc-docs bucket existed — no file in storage, can never process).
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const phantoms = await sql`
  select id, title, status, created_at from documents
  where created_at > '2026-09-08' and content_hash is null and status in ('uploaded', 'parse_failed')
`;
console.log("phantom rows to remove:");
for (const d of phantoms) console.log(`  [${d.status}] ${d.title.slice(0, 50)} (${new Date(d.created_at).toISOString().slice(0, 16)})`);

const del = await sql`
  delete from documents
  where created_at > '2026-09-08' and content_hash is null and status in ('uploaded', 'parse_failed')
  returning id
`;
console.log(`\nremoved ${del.length} phantom rows`);
await sql.end();
