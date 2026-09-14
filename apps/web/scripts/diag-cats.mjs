import { readFileSync } from "node:fs";
import postgres from "postgres";
const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(envRaw.split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
const rows = await sql`
  select c.slug, c.name, count(d.id)::int as docs
  from knowledge_categories c
  left join documents d on d.category_id = c.id and d.status = 'published' and d.is_active_version = true and d.access_level = 'public'
  group by c.slug, c.name, c.display_order
  order by c.display_order`;
for (const r of rows) console.log(`${r.slug} | ${r.name} | ${r.docs} docs`);
await sql.end();
