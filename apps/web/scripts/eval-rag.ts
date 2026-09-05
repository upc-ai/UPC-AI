/**
 * Golden-set RAG evaluation (RAG v2, MASTER_PLAN "eval-gated" prerequisite).
 * Usage: pnpm eval:rag
 *
 * rag-eval-set.json format:
 *   [{ "q": "question a student would ask", "expect_title": "document title (or unique substring)" }]
 *
 * Runs the LIVE retrieve path (rewrite → hybrid → fusion) against the real
 * database for each question and reports hit@3, hit@6, MRR. Run before and
 * after any retrieval change to prove improvement — never merge a retrieval
 * change that lowers these numbers without a reason documented here.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import path from "node:path";
import { createDb } from "@upc/db";

interface EvalCase {
  q: string;
  expect_title: string;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = createDb(process.env.DATABASE_URL);

  const setPath = path.resolve(import.meta.dirname, "../rag-eval-set.json");
  const cases: EvalCase[] = JSON.parse(readFileSync(setPath, "utf8"));
  if (!cases.length) throw new Error("rag-eval-set.json is empty — add evaluation questions");

  // The retrieve module resolves Next-aliases; inline the import AFTER env is
  // loaded so getEnv() picks DATABASE_URL up.
  const { retrieve, TOP_K, EVIDENCE_THRESHOLD } = await import("../src/modules/retrieval/search");

  let hit3 = 0;
  let hit6 = 0;
  let mrrSum = 0;
  const misses: { q: string; got: string[] }[] = [];

  for (const c of cases) {
    const { chunks, effectiveQuery } = await retrieve(c.q, undefined, { skipRewrite: true });
    const titles = chunks.map((ch) => ch.documentTitle);
    const rank = titles.findIndex((t) => t.toLowerCase().includes(c.expect_title.toLowerCase()));
    if (rank >= 0 && rank < 3) hit3++;
    if (rank >= 0 && rank < TOP_K) hit6++;
    if (rank >= 0) mrrSum += 1 / (rank + 1);
    if (rank < 0) {
      misses.push({ q: c.q, got: titles.slice(0, 3) });
    }
    console.log(`${rank >= 0 ? "✓" : "✗"} [${rank >= 0 ? `#${rank + 1}` : "MISS"}] "${c.q}"${effectiveQuery !== c.q ? ` (searched: "${effectiveQuery}")` : ""}`);
  }

  const n = cases.length;
  console.log("\n───────── RAG eval ─────────");
  console.log(`Cases:        ${n}`);
  console.log(`hit@3:        ${(hit3 / n * 100).toFixed(1)}%  (${hit3}/${n})`);
  console.log(`hit@6:        ${(hit6 / n * 100).toFixed(1)}%  (${hit6}/${n})`);
  console.log(`MRR:          ${(mrrSum / n).toFixed(3)}`);
  console.log(`Evidence gate: ${EVIDENCE_THRESHOLD}`);
  if (misses.length) {
    console.log("\nMisses:");
    for (const m of misses) console.log(`  ✗ "${m.q}" → top: ${m.got.join(" | ") || "(refused — no evidence)"}`);
  }
  process.exit(0);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
