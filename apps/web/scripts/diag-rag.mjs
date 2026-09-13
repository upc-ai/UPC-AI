/**
 * RAG diagnostic — reads the app's own retrieval_logs from Supabase and shows
 * exactly what happened on recent questions: did retrieval run, how many
 * chunks were found, what the top similarity score was, whether it refused.
 * Also checks the published-document count the search actually sees.
 * Usage (from apps/web):  ..\node_modules\.bin\tsx.cmd scripts/diag-rag.mjs
 * Prints no secrets.
 */
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

const url = env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL not found in .env.local");
  process.exit(1);
}
console.log("env check (names only):", {
  EMBEDDING_PROVIDER: env.EMBEDDING_PROVIDER || "(unset)",
  EMBEDDING_API_KEY: env.EMBEDDING_API_KEY ? `set (${env.EMBEDDING_API_KEY.length} chars)` : "(unset)",
  EMBEDDING_BASE_URL: env.EMBEDDING_BASE_URL || "(unset)",
  GEMINI_API_KEY: env.GEMINI_API_KEY ? `set (${env.GEMINI_API_KEY.length} chars)` : "(unset)",
  AI_CUSTOM_PROVIDERS: env.AI_CUSTOM_PROVIDERS ? `${env.AI_CUSTOM_PROVIDERS.length} chars` : "(unset)",
});

const sql = postgres(url, { prepare: false, max: 1 });

const published = await sql`select status, count(*)::int as n from documents group by status order by n desc`;
console.log("\ndocuments by status:", published.map((r) => `${r.status}=${r.n}`).join(", "));

const logs = await sql`select * from retrieval_logs order by created_at desc limit 8`;
console.log(`\nlast ${logs.length} retrieval attempts:`);
for (const r of logs) {
  const q = String(r.query ?? "").slice(0, 60);
  const keys = { ...r };
  delete keys.query;
  delete keys.rewritten;
  console.log(
    `· [${new Date(r.created_at).toISOString().slice(5, 16)}] "${q}" → ` +
      Object.entries(keys)
        .filter(([k]) => !["id", "session_id", "created_at"].includes(k))
        .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
        .join(" "),
  );
}
if (logs.length === 0) {
  console.log("  (no retrieval logs at all — either no college-intent questions were asked yet, or logging failed)");
}

await sql.end();
