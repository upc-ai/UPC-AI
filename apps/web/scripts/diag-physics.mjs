/** Does the Physics department doc actually name an HOD/Head? */
import { readFileSync } from "node:fs";
import postgres from "postgres";
const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(envRaw.split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
const docs = await sql`select id, title from documents where title ilike '%physics%' and is_active_version = true`;
for (const d of docs) {
  const chunks = await sql`select chunk_index, content from chunks where document_id = ${d.id} order by chunk_index`;
  console.log(`\n=== "${d.title}" — ${chunks.length} chunks ===`);
  for (const c of chunks) {
    const hasHOD = /hod|head of|head &|head and|chief/i.test(c.content);
    const names = c.content.match(/Dr\.|Prof\.[^\n,]{0,40}/g)?.slice(0, 4) ?? [];
    console.log(`  chunk ${c.chunk_index}: ${c.content.length} chars | HOD/Head mention: ${hasHOD ? "YES" : "no"} | names: ${names.join(" / ") || "none"}`);
    if (hasHOD) console.log(`    → ${c.content.split("\n").filter((l) => /hod|head of|head &|head and|chief/i.test(l)).slice(0, 2).join(" | ").slice(0, 200)}`);
  }
}
await sql.end();
