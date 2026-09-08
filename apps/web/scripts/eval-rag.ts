/**
 * Golden-set RAG evaluation (RAG v2, MASTER_PLAN "eval-gated" prerequisite).
 * Usage: pnpm eval:rag [--with-answers]
 *
 * rag-eval-set.json format:
 *   { "q": "question", "lang": "en|hi|hinglish", "type": "fact|lookup|syllabus|no-answer",
 *     "expect_title": "document title substring",     ← knowable questions
 *     "expect_refusal": true }                        ← no-answer questions
 *
 * Retrieval metrics (per language): hit@3, Recall@5, Recall@10, MRR.
 * Refusal cases pass when retrieval finds no evidence (P7 gate).
 * --with-answers additionally generates real answers with the fast-tier model
 * over the retrieved context and checks citation correctness (knowable) and
 * refusal behavior (no-answer) — a smoke test of end-to-end answer quality.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import path from "node:path";
import { createDb } from "@upc/db";

interface EvalCase {
  q: string;
  lang?: "en" | "hi" | "hinglish";
  type?: string;
  expect_title?: string;
  expect_refusal?: boolean;
}

const REFUSAL_MARKERS = [
  "no information", "not available", "couldn't find", "could not find", "do not have",
  "don't have", "no specific", "no records", "unable to find", "not mentioned",
  "कोई जानकारी", "उपलब्ध नहीं", "नहीं मिल",
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = createDb(process.env.DATABASE_URL);
  void db;

  const withAnswers = process.argv.includes("--with-answers");
  const setPath = path.resolve(import.meta.dirname, "rag-eval-set.json");
  const cases: EvalCase[] = JSON.parse(readFileSync(setPath, "utf8"));
  if (!cases.length) throw new Error("rag-eval-set.json is empty — add evaluation questions");

  // The retrieve module resolves Next-aliases; inline the import AFTER env is
  // loaded so getEnv() picks DATABASE_URL up.
  const { retrieve, TOP_K } = await import("../src/modules/retrieval/search");
  const { resolveFastChat } = await import("../src/modules/retrieval/rerank");

  interface Agg { n: number; hit3: number; hit5: number; hit10: number; mrr: number; refusals: number; refusalsCorrect: number }
  const agg: Record<string, Agg> = {};
  const aggFor = (lang: string): Agg => (agg[lang] ??= { n: 0, hit3: 0, hit5: 0, hit10: 0, mrr: 0, refusals: 0, refusalsCorrect: 0 });
  const misses: { q: string; got: string[] }[] = [];
  let citationCorrect = 0;
  let citationChecked = 0;
  let refusalAnswersCorrect = 0;
  let refusalAnswersChecked = 0;

  const fast = withAnswers ? resolveFastChat() : null;
  if (withAnswers && !fast) console.log("[warn] no fast-tier chat config — skipping answer generation");

  for (const c of cases) {
    const lang = c.lang ?? "en";
    const a = aggFor(lang);
    const aAll = aggFor("ALL");
    a.n++; aAll.n++;

    const { chunks } = await retrieve(c.q, undefined, { skipRewrite: true, limit: 10 });
    const titles = chunks.map((ch) => ch.documentTitle);

    if (c.expect_refusal) {
      const correct = chunks.length === 0;
      a.refusals++; aAll.refusals++;
      if (correct) { a.refusalsCorrect++; aAll.refusalsCorrect++; }
      console.log(`${correct ? "✓" : "✗"} [${correct ? "REFUSED" : "EVIDENCE FOUND!"}] "${c.q}"${chunks.length ? ` → ${titles.slice(0, 2).join(" | ")}` : ""}`);
      if (fast && chunks.length === 0) {
        // with no evidence the production path refuses by design — count as correct
        refusalAnswersChecked++; refusalAnswersCorrect++;
      } else if (fast) {
        const answer = await generateAnswer(fast, c.q, chunks);
        const refused = REFUSAL_MARKERS.some((m) => answer.toLowerCase().includes(m));
        refusalAnswersChecked++;
        if (refused) refusalAnswersCorrect++;
        console.log(`    [answer] ${answer.slice(0, 100).replace(/\n/g, " ")}`);
      }
      continue;
    }

    const expect = (c.expect_title ?? "").toLowerCase();
    const rank = titles.findIndex((t) => t.toLowerCase().includes(expect));
    if (rank >= 0 && rank < 3) { a.hit3++; aAll.hit3++; }
    if (rank >= 0 && rank < 5) { a.hit5++; aAll.hit5++; }
    if (rank >= 0 && rank < 10) { a.hit10++; aAll.hit10++; }
    if (rank >= 0) { a.mrr += 1 / (rank + 1); aAll.mrr += 1 / (rank + 1); }
    if (rank < 0) misses.push({ q: c.q, got: titles.slice(0, 3) });
    console.log(`${rank >= 0 ? "✓" : "✗"} [${rank >= 0 ? `#${rank + 1}` : "MISS"}] "${c.q}"`);

    if (fast) {
      const answer = await generateAnswer(fast, c.q, chunks);
      citationChecked++;
      const citedIdx = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      const citedTitles = citedIdx.map((i) => titles[i - 1] ?? "").filter(Boolean);
      if (citedTitles.some((t) => t.toLowerCase().includes(expect))) citationCorrect++;
      else console.log(`    [citation-miss] expected "${c.expect_title}", cited: ${citedTitles.join(" | ") || "none"}`);
    }
  }

  const n = cases.length;
  console.log("\n───────────── RAG eval ─────────────");
  console.log(`Cases: ${n} (${cases.filter((c) => c.expect_refusal).length} refusal)`);

  const pct = (x: number, d: number) => (d ? ((x / d) * 100).toFixed(1) : "n/a");
  for (const [lang, a] of Object.entries(agg).sort((x, y) => (x[0] === "ALL" ? 1 : 0) - (y[0] === "ALL" ? 1 : 0))) {
    const knowable = a.n - a.refusals;
    console.log(
      `${lang.padEnd(9)} n=${String(a.n).padStart(2)}  hit@3=${pct(a.hit3, knowable)}%  R@5=${pct(a.hit5, knowable)}%  R@10=${pct(a.hit10, knowable)}%  MRR=${(a.mrr / Math.max(knowable, 1)).toFixed(3)}  refusal-correct=${a.refusalsCorrect}/${a.refusals}`,
    );
  }
  if (withAnswers && fast) {
    console.log(`\nAnswers:   citation-correct=${citationCorrect}/${citationChecked}  refusal-correct=${refusalAnswersCorrect}/${refusalAnswersChecked}`);
  }
  console.log(`Evidence gate: ${(await import("../src/modules/retrieval/search")).EVIDENCE_THRESHOLD}  TOP_K=${TOP_K}`);
  if (misses.length) {
    console.log("\nMisses:");
    for (const m of misses) console.log(`  ✗ "${m.q}" → top: ${m.got.join(" | ") || "(refused — no evidence)"}`);
  }
  process.exit(0);
}

/** Generate an answer with the fast-tier model using the production context format. */
async function generateAnswer(
  fast: { baseUrl: string; apiKey: string; model: string },
  q: string,
  chunks: { documentTitle: string; hierarchyPath: string | null; content: string }[],
): Promise<string> {
  const ctx = chunks
    .map((c, i) => `[${i + 1}] (${c.documentTitle}, ${c.hierarchyPath ?? "section n/a"})\n${c.content.slice(0, 800)}`)
    .join("\n\n");
  try {
    const res = await fetch(`${fast.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${fast.apiKey}` },
      body: JSON.stringify({
        model: fast.model,
        messages: [
          {
            role: "system",
            content:
              "You are UPC AI, the assistant of Udai Pratap College. Answer ONLY from the provided context. Cite sources as [n] matching the context numbering. If the context does not contain the answer, say you don't have that information. Be concise.",
          },
          { role: "user", content: `Context:\n${ctx || "(no context)"}\n\nQuestion: ${q}` },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return `(generation failed: ${res.status})`;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? "(empty)";
  } catch (err) {
    return `(generation failed: ${err instanceof Error ? err.message : err})`;
  }
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
