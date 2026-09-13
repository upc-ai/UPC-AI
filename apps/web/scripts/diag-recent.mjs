import { readFileSync } from "node:fs";
import postgres from "postgres";
const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(envRaw.split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
const rows = await sql`select title, status, is_active_version, (select count(*)::int from chunks c where c.document_id = d.id) as chunks, created_at from documents d order by created_at desc limit 15`;
for (const r of rows) console.log(`· "${String(r.title).slice(0, 70)}" | ${r.status} | active=${r.is_active_version} | chunks=${r.chunks} | ${new Date(r.created_at).toISOString().slice(0, 10)}`);
await sql.end();
