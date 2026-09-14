import { readFileSync } from "node:fs";
import postgres from "postgres";
const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(envRaw.split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
console.log("chunk status distribution:", (await sql`select status, count(*)::int as n from chunks group by status`).map((r) => `${r.status}=${r.n}`).join(", "));
console.log("embeddings rows:", (await sql`select count(*)::int as n from embeddings`).map((r) => r.n)[0]);
const p = await sql`
  select c.chunk_index, c.status, (e.id is not null) as has_embedding
  from chunks c
  join documents d on d.id = c.document_id
  left join embeddings e on e.chunk_id = c.id
  where d.title = 'Department of Physics'`;
console.log("Department of Physics chunks:", p.map((r) => `#${r.chunk_index}:${r.status}${r.has_embedding ? "+emb" : "-emb"}`).join(" "));
await sql.end();
