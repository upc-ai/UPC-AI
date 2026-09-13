/** Check the student-details / B.Sc documents: status, chunks, publish state. */
import { readFileSync } from "node:fs";
import postgres from "postgres";

const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envRaw
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });

const rows = await sql`
  select d.title, d.status, d.is_active_version, d.canonical_id,
         (select count(*)::int from chunks c where c.document_id = d.id) as chunks,
         d.created_at
  from documents d
  where d.title ilike any(array['%student%', '%b.sc%', '%bsc%', '%3rd sem%', '%ugm%'])
  order by d.created_at desc
  limit 12`;

console.log(`student/B.Sc related documents: ${rows.length}`);
for (const r of rows) {
  console.log(
    `· "${r.title}" | status=${r.status} | active=${r.is_active_version} | chunks=${r.chunks} | ${new Date(r.created_at).toISOString().slice(0, 10)}`,
  );
}
if (rows.length === 0) console.log("  (none found — the upload may have a different title)");

await sql.end();
