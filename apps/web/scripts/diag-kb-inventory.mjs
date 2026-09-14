/** Full KB inventory: documents + chunks per category, and faculty search. */
import { readFileSync } from "node:fs";
import postgres from "postgres";
const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(envRaw.split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });

const byCat = await sql`
  select coalesce(c.name, 'Uncategorized') as category,
         count(*)::int as docs,
         coalesce(sum((select count(*) from chunks ch where ch.document_id = d.id)), 0)::int as chunks
  from documents d left join knowledge_categories c on c.id = d.category_id
  where d.is_active_version = true
  group by c.name order by chunks desc`;
console.log("=== ACTIVE knowledge base by category ===");
let tD = 0, tC = 0;
for (const r of byCat) { tD += r.docs; tC += r.chunks; console.log(`  ${r.category.padEnd(22)} ${String(r.docs).padStart(3)} docs  ${String(r.chunks).padStart(5)} chunks`); }
console.log(`  ${"TOTAL".padEnd(22)} ${String(tD).padStart(3)} docs  ${String(tC).padStart(5)} chunks`);

const fac = await sql`
  select d.title, d.status, (select count(*)::int from chunks ch where ch.document_id = d.id) as chunks
  from documents d
  where d.title ilike any(array['%faculty%', '%professor%', '%department%', '%principal%', '%staff%', '%teacher%'])
    and d.is_active_version = true
  order by d.title limit 20`;
console.log(`\n=== faculty/professor/department documents (${fac.length}) ===`);
for (const r of fac) console.log(`  "${String(r.title).slice(0, 70)}" | ${r.status} | chunks=${r.chunks}`);
if (fac.length === 0) console.log("  (none found)");

await sql.end();
