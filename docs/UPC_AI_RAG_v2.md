# UPC AI — RAG v2 System Design (as built, 2026-09-03)

Companion to the 7 spec docs. This documents the system **as implemented**, not
as aspired. The original retrieval spec lives in `UPC_AI_Architecture.md` §3;
this doc records RAG v2's deltas and the reasoning.

## 1. Pipeline (end to end)

```
Student question
   │
   ▼
Intent router (continuity → keywords → probe)
   │  knowledge / mixed
   ▼
Query rewriter (gemini-flash-lite, 3.5s timeout, FAIL-OPEN)
   │  "fees kitna hai" → "Udai Pratap College fee structure"
   ▼
Hybrid retrieval over PUBLISHED chunks only
   ├─ Vector: pgvector cosine (30 candidates)   ← Gemini 1536-dim embeddings
   └─ BM25: tsvector websearch (30 candidates)
   │
   ▼  Reciprocal Rank Fusion (K=60) → top 6, evidence gate 0.008
   │
   ├─ no evidence → grounded refusal (P7) — logged as refused
   ▼
System prompt: OFFICIAL CONTEXT blocks [n] (title, section, page)
   │
   ▼
Provider (UPC-1 / Plus / Pro by tier) → cited answer [1][2]
   │
   ▼
retrieval_logs row (query, rewritten, scores, refused, latency)
```

### The v1→v2 fixes (why)

- **Query embeddings were dead in v1**: `search.ts` looked for OpenAI keys only;
  the project has none, so every query ran BM25-only while the Gemini doc-side
  embeddings sat unused. v2 resolves the query embedder through the same
  managed-config chain as ingest (`EMBEDDING_*` → `AI_CUSTOM_PROVIDERS` Gemini
  fallback) — vector search actually runs now.
- **Query rewriting**: students ask messy Hinglish follow-ups ("uska fees
  kitna?"). One fast-tier call (fail-open, 3.5s cap) normalizes the query
  before retrieval, using the last 2 turns for pronoun resolution.
- **Sections in citations**: chunks carry `hierarchy_path`
  ("Doc > Unit 3 > Sorting"); both the prompt blocks and the citation chips
  now show document + section + page.

## 2. Knowledge ingestion paths

All three paths converge on the same pipeline:
`parse → chunk (500t/75overlap, tables atomic) → embed (Gemini 1536) → indexed`,
then **publish gate** — nothing is retrievable until an approver publishes.

| Path | Entry | Notes |
|---|---|---|
| File upload | Admin → Documents | Multi-file; PDF/Word/PPT/XLSX/CSV/TXT/MD/HTML, 50MB cap |
| Paste a notice | Admin → Documents | No file; becomes a txt doc through the same pipeline |
| Website sync | Admin → Documents → Sync | Crawler below; auto-queues for review |

### Website sync (crawler)

- Manual trigger only (admin decision 2026-09-02); no cron in v1.
- Same-domain, depth ≤ 3, ≤ 30 HTML pages + ≤ 10 linked PDFs, 300 ms
  politeness delay, UA `UPCAI-KnowledgeSync/1.0`.
- HTML → text strips script/style/nav/footer; headings become `## ` markers
  so chunking gets section boundaries.
- **Dedupe by content hash**: unchanged pages are skipped entirely; changed
  pages insert as `version + 1` of the same `canonical_id` (publishing the new
  version supersedes the old atomically — existing review-route behavior).
- Sync URL precedence: request body → `system_settings.sync.college_website_url`
  → `COLLEGE_WEBSITE_URL` env.
- Synced docs land at **indexed ("Ready to publish")** — the review-first rule
  is absolute (admin decision).

## 3. Coverage feedback loop (Backend §6.6 at pilot scale)

Every knowledge/mixed retrieval attempt writes a `retrieval_logs` row
(query, rewritten query, intent, top fused score, chunk count, refused,
latency — telemetry is fire-and-forget, never blocks the stream).

`GET /v1/admin/analytics/unanswered` groups refused/weak rows
(`top_score < 0.016` heuristic) into the "Questions the AI couldn't answer"
card on the Analytics page: the admin's literal to-do list — the question,
how many times it was asked, when last, and whether the base refused outright
or matched weakly. Answering those questions via sync/upload is the
knowledge-base growth loop.

## 4. Evidence & refusal policy (unchanged from v1, restated)

- Answers for college facts come ONLY from OFFICIAL CONTEXT blocks.
- Fusion score < 0.008 → no evidence → grounded refusal ("I don't have that
  in the official knowledge base yet"), never a guess.
- Only `published` + active-version + unexpired chunks are candidates —
  enforced in SQL, not in application code.

## 5. Evaluation (golden set)

`apps/web/scripts/eval-rag.ts` + `rag-eval-set.json` (edit the set as the
base grows): runs the LIVE retrieve path per question and reports
**hit@3, hit@6, MRR**. Run `pnpm --filter @upc/web eval:rag` before and
after every retrieval change. This is the eval-gate the plan requires before
any future reranking (cross-encoder rerank stays deferred to v1.1 until these
numbers exist and justify it).

## 6. Deferred (unchanged decisions)

- Cross-encoder reranking — v1.1, eval-gated.
- Agent live web-browsing — v2.0 (answers must stay curated + citable).
- Scheduled auto-sync — add a Vercel cron calling the sync route when the
  manual flow proves trustworthy.
- OCR of scanned site images — worker-only path, unchanged.
