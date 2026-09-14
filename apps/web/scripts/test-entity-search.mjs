/**
 * Named-entity retrieval test — proves name/UGM-id lookups rank the right chunk.
 * Usage (from apps/web):  ..\node_modules\.bin\tsx.cmd scripts/test-entity-search.mjs "Prof. Shashikant Dwivedi" "UGM20230123"
 * Without args it tests built-in defaults. Reads .env.local; prints no secrets.
 */
import { readFileSync } from "node:fs";

const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envRaw.split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trim().startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}

const { retrieve } = await import("../src/modules/retrieval/search");

const queries =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : ["Who is Prof. Shashikant Dwivedi", "HOD of Physics department"];

for (const q of queries) {
  console.log(`\n=== "${q}" ===`);
  const { chunks, effectiveQuery } = await retrieve(q, undefined, { skipRewrite: true });
  console.log(`  effective query: "${effectiveQuery}" | ${chunks.length} chunks`);
  const hard = q
    .split(/\s+/)
    .filter((w) => /[A-Z]/.test(w[0] ?? "") || /\d/.test(w))
    .map((w) => w.replace(/[^\w.-]/g, ""));
  for (const c of chunks) {
    const hit = hard.filter((h) => h.length > 2 && c.content.toLowerCase().includes(h.toLowerCase()));
    console.log(
      `  [${c.relevanceScore.toFixed(4)}] ${c.documentTitle.slice(0, 45)} | exact name match: ${hit.length ? `✅ ${hit.join(", ")}` : "—"}`,
    );
    console.log(`      ${c.content.slice(0, 140).replace(/\n/g, " ")}`);
  }
}
