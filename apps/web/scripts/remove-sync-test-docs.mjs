// Remove the smoke-run website-sync test docs (user directive: no entire
// webpages in the knowledge base). They were never published. Chunks and
// embeddings cascade. Run: node scripts/remove-sync-test-docs.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const rows = await sql`
  select id, title, status, source_url from documents where source_url is not null
`;
console.log("docs to remove:");
for (const r of rows) console.log(`  [${r.status}] ${r.title} — ${r.source_url}`);

const del = await sql`
  delete from documents where source_url is not null returning id
`;
console.log(`\ndeleted ${del.length} documents (chunks/vectors cascaded)`);

const cat = await sql`
  delete from knowledge_categories where slug = 'website-sync' returning slug
`;
console.log(`deleted category: ${cat.map((c) => c.slug).join(", ") || "(none)"}`);

const [{ chunks }] = await sql`select count(*)::int as chunks from chunks`;
const [{ vectors }] = await sql`select count(*)::int as vectors from embeddings`;
console.log(`remaining: ${chunks} chunks, ${vectors} vectors (user-uploaded PDFs only)`);
await sql.end();
