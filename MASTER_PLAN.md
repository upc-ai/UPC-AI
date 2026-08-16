# UPC AI — MASTER PLAN

**The one document that runs the project.** Everything else (the 7 docs in `docs/`) is the specification; this is the operating manual: what we build, in what order, with what money, and how a solo founder + AI agents ship a world-class product.

- **Builder:** 1 founder + AI coding agents
- **Scope:** Udai Pratap College only — perfect it, then think about anything else
- **Design language:** warm-editorial (Design System v2.0) — cream canvas, serif display, coral CTAs
- **Architecture:** modular monolith + worker, not microservices
- **Timeline:** 12 weeks to v1.0 launch, then hardening
- **Version:** 1.0 — 2026-08-16

---

## 1. Vision & Non-Goals

**Vision.** UPC AI is the official AI assistant of Udai Pratap College: one place where 5,000+ students ask academic questions, get answers grounded in official college documents with citations, and study with AI-generated quizzes and flashcards. It replaces "ask in the WhatsApp group and hope" with "ask UPC AI and get the cited, official answer in seconds."

**The three product pillars (unchanged from the architecture docs):**
1. Academic AI — a patient tutor that solves, explains, and verifies.
2. College knowledge — RAG over official documents, always cited, never hallucinated. When the knowledge base doesn't contain the answer, it says so.
3. Study tools — quizzes and spaced-repetition flashcards generated from the syllabus.

**Non-goals for v1.0 (we do NOT build these now):**
- Multi-college / multi-tenant anything
- Native mobile apps (responsive web + installable manifest only)
- ERP integrations, attendance, fees payment, results
- Video/file generation, voice mode
- Agent browsing the open web (knowledge stays in the official KB)

**Success at week 12 looks like:** 50+ real students using it weekly in one pilot department, retrieval precision@5 ≥ 80% on the golden set, p95 first-token < 1.5s, infra+AI cost < $150/month, and the college administration willing to put its name on it.

---

## 2. v1.0 Feature Cut

### IN (build in the 12 weeks)

| Area | v1.0 scope |
|---|---|
| Auth | College-email signup + password, Google OAuth (college domain), OTP verify + password reset, JWT access (15 min) + rotating refresh with reuse detection, sessions list/revoke |
| Chat | Streaming SSE chat, markdown + KaTeX + code highlighting, conversation history (sidebar, grouped), regenerate, feedback 👍/👎, EN/HI response toggle, study modes (Learn/Practice/Explain Simply/Challenge Me) |
| AI core | Intent routing (academic/knowledge/mixed/conversational), provider gateway with 3 providers + failover + cost tracking per request, model tiering (cheap/mid/frontier), prompt templates versioned in DB |
| RAG | Upload (PDF/DOCX/PPTX/XLSX/images) via presigned URLs, virus scan, parse, Tesseract OCR for scanned pages, type-aware chunking, pgvector embeddings, hybrid search (vector + BM25 + RRF), metadata filters (category/dept/audience/dates), citations with source panel |
| Admin portal | Document approval queue (upload → review → approve → publish), indexing status + retry, basic user list + role assignment, cost dashboard, first Super Admin via CLI seed |
| Knowledge search | Category pills + filters + result cards + detail view + "Ask AI about this" |
| Study tools | AI quiz generation (MCQ + true/false) with taking + results + explanations; SM-2 flashcards with due scheduling and 3D flip UI |
| Design | Full warm-editorial system (Design System v2.0): Claude-style landing page, cream chat with serif greeting, coral CTAs, warm dark mode |
| Quality | Typecheck/lint gates, unit tests for core logic, Playwright smoke suite, retrieval golden-set eval (100 queries), Sentry error tracking |

### OUT (deferred, each with a target)

| Deferred | Why | Target |
|---|---|---|
| Semantic answer cache | Needs traffic patterns first; biggest v1.1 cost win | v1.1 |
| Email/push notifications | In-app notices suffice at pilot scale | v1.1 |
| Document Workspace (PDF viewer + doc chat + highlights) | Big frontend surface; citations + search cover the need first | v1.1 |
| Revision notes + bookmarks UI | Nice-to-have | v1.1 |
| Cross-encoder re-ranking | RRF hybrid only first; add if eval shows < 80% precision | v1.1 (eval-gated) |
| Hash-chained audit store | Simple append-only audit table in v1 | v1.2 |
| Analytics warehouse + admin analytics tabs | Cost + usage dashboards read from the OLTP tables at pilot scale | v1.2 |
| Cloud OCR tier-2 (Google Document AI) | Only if Tesseract < 85% on the Hindi test set | eval-gated |
| Read replicas, partitioning, PgBouncer tuning | 50 users ≠ 50k users | v2.0 |
| PWA offline shell, share chats, web_search tool, code executor | — | v2.0 |

**The rule:** if a feature is not in the IN table, it is not in v1.0 — no matter who asks. Scope changes update this file first, then the specs, then the code.

---

## 3. v1 Architecture — Modular Monolith

One Next.js app + one worker process. The architecture doc's services become **enforced module boundaries** inside the monorepo, so the path to microservices stays open without paying microservice costs now.

```
apps/
  web/                     # Next.js 14 (App Router) — UI + API routes
    src/modules/
      auth/                # register/login/OTP/JWT/refresh rotation/RBAC
      chat/                # sessions, messages, SSE streaming endpoint
      orchestrator/        # intent detection, routing, prompt assembly
      providers/           # provider gateway: adapters, failover, cost tracking
      retrieval/           # hybrid search, metadata filters, citations
      ingestion/           # upload API, job enqueue, status
      portal/              # admin APIs: approvals, users, indexing, costs
    src/app/               # routes/pages only — no business logic
  worker/                  # BullMQ worker: virus scan, parse, OCR, chunk, embed
packages/
  db/                      # Drizzle schema + client + migrations (single source of truth)
  ui/                      # design tokens (CSS custom properties) + common components
  core/                    # shared types, zod schemas, config
```

**Boundary rules (enforced by ESLint import rules):** modules import only each other's exported interfaces (`modules/x/index.ts`), never internals. `app/` routes only call modules. The worker reuses `packages/db` and ingestion code but runs as its own process — ingestion load can never touch chat latency (failure isolation, principle P5, kept even in the monolith).

**Service split triggers (when a module becomes a real service):**
1. Ingestion CPU degrades chat p95 latency > 20% for 7 days → split worker to its own box (already separate process; just move it).
2. Provider gateway needs independent rate-limit key management or per-provider isolation → extract.
3. Sustained > 200 RPS or team > 4 engineers → extract retrieval.
4. None of these → stay monolith. A monolith with clean seams is not technical debt; premature microservices are.

**Request path (unchanged from spec):** edge JWT check → chat module → semantic cache (v1.1) → orchestrator (intent) → retrieval (hybrid + filters) OR direct → provider gateway (tier select, failover) → normalized SSE → client. Citations ship in the `done` event; message + citations persist on completion.

---

## 4. Locked Stack

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | everywhere |
| Framework | Next.js 14+ App Router | SSR landing, route handlers for REST+SSE |
| API style | REST + SSE per Backend Architecture v1.1 | OpenAPI generated from zod schemas |
| ORM | Drizzle + Drizzle Kit | native pgvector support, SQL-transparent, migrations in CI |
| DB | PostgreSQL 16 + pgvector | Neon (serverless, branching for staging) or Supabase — pick by week 2 pricing check |
| Cache/queue | Redis (Upstash) + BullMQ | rate limits, sessions, job queue, stream buffers |
| Storage | Cloudflare R2 (S3 API) | presigned uploads, zero egress fees |
| AI SDK | Vercel AI SDK underneath our Provider Gateway | unified streaming/tool interface; our `stream_generate` contract wraps it (providers stay swappable — P3 intact) |
| Providers at launch | Groq (fast/cheap tier) + OpenAI (standard) + Anthropic (frontier) | failover chain in this order; add Gemini if Hindi eval demands |
| Embeddings | OpenAI `text-embedding-3-small` (1536d) to start | decision gate at week 6: eval Hindi retrieval; switch to a multilingual model (e.g. Voyage/Jina/Gemini embedding) if precision@5 < 80% on Hindi queries |
| OCR | Tesseract.js (eng+hin) | cloud tier-2 only if eval-gated |
| Auth crypto | `jose` (JWT RS256) + `argon2` passwords + SHA-256 OTP/refresh hashes | per Backend spec |
| Markdown/math/code | react-markdown + remark-math + rehype-katex + Shiki | serif headings per Design System v2.0 |
| Styling | CSS Modules + design tokens | no Tailwind — tokens are the vocabulary |
| State | TanStack Query + Zustand | per Frontend Architecture v1.1 |
| Tests | Vitest + Testing Library + Playwright | + golden-set retrieval eval script |
| Errors/monitoring | Sentry (free tier) + `/health` endpoints + structured logs | Prometheus/Grafana in v1.2 |
| CI/CD | GitHub Actions → deploy to Railway (or Fly.io) | app + worker as two services on the same platform |
| Fonts | Cormorant Garamond, Inter, JetBrains Mono, Noto Sans/Serif Devanagari | via `next/font`, self-hosted |

---

## 5. Infrastructure & Monthly Cost Model

Pilot scale (50–500 active users, ~10k messages/month):

| Item | Vendor | Cost/month |
|---|---|---|
| Postgres + pgvector | Neon free→starter | $0 → $19 |
| Redis | Upstash pay-as-you-go | ~$5 |
| Object storage | Cloudflare R2 | ~$2 |
| App + worker hosting | Railway hobby ×2 | ~$10 |
| Domain | upcai.in / .edu.in via college | ~$2 |
| Sentry | free tier | $0 |
| **Infra total** | | **~$20–40** |
| AI — chat (tiered models, no cache) | ~10k msgs × $0.004 avg | ~$40 |
| AI — embeddings (one-time corpus + incremental) | ~50k chunks | ~$5 one-off, pennies after |
| **Total at pilot** | | **~$60–90/month** |

At full college scale (2–3k active users, 150k msgs/month): infra ~$100, AI ~$300 → **~$400/month before optimization**; the v1.1 semantic cache (30–50% hit rate on knowledge questions) and model tiering bring it to ~$250. This is the pitch to the college: **the entire system costs less than one desktop PC per year.**

Cost guardrails from day 1: per-user daily message cap (60/day), per-request max_tokens, model tiering, cost logged per request, admin cost dashboard, hard monthly budget alert at 2× forecast.

---

## 6. The 12-Week Execution Plan

Solo + AI agents. Every week ends with a **demo checkpoint** (something runnable) and a written note in `docs/notes/week-N.md` (what shipped, what slipped, decisions made).

**Week 1–2 — Foundation + Auth**
- Monorepo scaffold (apps/web, apps/worker, packages/db, packages/ui, packages/core), CI (lint→typecheck→test→build), Drizzle schema v1 (MVP tables), migrations run.
- Design tokens CSS (Design System v2.0 §10) + first 8 components (Button, Input, Textarea, Select, Dialog, Toast, Spinner, Skeleton) with tests.
- **Landing page** in full warm-editorial glory — top-nav, serif hero, dark chat mockup, feature bands, coral CTA, dark footer.
- Auth module complete: register, login, Google OAuth, OTP, refresh rotation + reuse detection, logout, sessions. Playwright: full auth flow.
- ✅ *Demo: deployed staging URL — landing page + sign up + log in + sessions.*

**Week 3–4 — Chat + Streaming + Provider Gateway**
- Chat sessions/messages APIs, SSE endpoint (status/intent/token/citation/done events, heartbeats, sequence numbers, cancel).
- Orchestrator v1: layered intent detection (continuity → heuristics → zero-shot via cheap model), study-mode prompts, EN/HI instruction.
- Provider gateway: Groq + OpenAI + Anthropic adapters on the internal contract, failover, circuit breaker, cost logging. Model tiering by intent.
- Chat UI: sidebar (history grouped), cream canvas, serif greeting + sparkle, mode chips, composer (attach later), streaming render (rAF batching, 80ms fade, blinking caret), markdown + KaTeX + Shiki, user bubbles, editorial AI messages, thinking shimmer, regenerate, feedback.
- ✅ *Demo: real streaming conversations, provider failover kill-switch test, history persists.*

**Week 5–6 — RAG Pipeline + Citations**
- Worker: upload → virus scan → parse (PDF/DOCX/PPTX/XLSX/images) → OCR (Tesseract eng+hin) → type-aware chunking → batch embed → pgvector. Job statuses, retries, dead-letter.
- Retrieval: hybrid (pgvector cosine + tsvector BM25) + RRF + metadata filters (category, dept, audience, dates, access_level) + citation assembly.
- Orchestrator integration: KNOWLEDGE/MIXED intents → grounded prompts (answer-only-from-context + refusal-on-no-evidence).
- Chat UI: citation chips, sources panel, "Searching college documents…" status.
- **Golden set v1:** 100 real queries (50 EN + 50 HI) with expected docs; eval script in CI; **embedding decision gate** (week 6).
- ✅ *Demo: upload a real UPC fee-structure PDF → 60s later it answers "What is the BSc CS fee?" with a correct citation.*

**Week 7 — Admin Portal (minimal) + Knowledge Search**
- Upload UI with metadata form, approval queue (review → approve/reject → publish), indexing monitor with per-stage status + retry, user list + roles, cost dashboard (reads per-request cost logs).
- Knowledge Search UI: category pills, filters, result cards, detail view, "Ask AI about this".
- Super Admin seed CLI.
- ✅ *Demo: full content lifecycle — a professor uploads, an admin approves, a student asks and gets the cited answer.*

**Week 8 — Study Tools**
- Quiz generation (MCQ + true/false) from subject/topic/difficulty, quiz player (timer, keyboard nav), results with explanations + score ring + confetti.
- Flashcards: generation, SM-2 scheduling, 3D flip, rating bar, due queue.
- ✅ *Demo: generate a 10-question DSA quiz, take it, see results; flashcards schedule correctly across days.*

**Week 9 — Polish + Accessibility + Security Pass**
- Onboarding wizard, settings (theme/language/AI prefs), empty/loading/error states everywhere, warm dark mode pass.
- axe scan + keyboard-only walkthrough + focus traps + contrast fixes. Hindi font rendering check (`lang="hi"` spans).
- Security: rate limits live, input validation audit, presigned URL expiry, dependency audit, `npm audit` clean of criticals.
- Playwright smoke suite (15 flows: auth, chat, RAG answer, admin approval, quiz, flashcards).
- ✅ *Demo: zero critical a11y violations; smoke suite green on staging.*

**Week 10 — Pilot with a Real Department**
- Onboard ONE department (target: CS) — real syllabus, fee structures, notices, timetables ingested (25–50 documents).
- 20–30 students + 2 faculty given accounts. Daily feedback collection (in-app 👎 reasons + a WhatsApp group).
- Eval harness rerun on the real corpus; tune chunking/filters/prompts. Fix the top 10 issues.
- ✅ *Demo: real students getting real cited answers about their own department.*

**Week 11 — Content + Fixes**
- Content ingestion drive: another 50–100 official documents (registrar's office, exam cell, hostel, library). Metadata quality pass.
- Fix list from pilot week 2. Load test (50 concurrent streams via k6 — p95 TTFT < 1.5s). Cost check against model.
- ✅ *Demo: 100+ documents live; load test report; cost under budget.*

**Week 12 — Launch**
- DNS + college sign-off (see §7), production deploy (app + worker + managed DB), backups verified by restore test, 72-hour watch, launch to the full college (notice board, WhatsApp, classroom demos).
- ✅ *Launch criteria: all week-12 checklist items green (below).*

**Launch checklist (binary):** CI green on `main` · migrations run clean on prod · smoke suite green on prod · golden-set precision@5 ≥ 80% · p95 TTFT < 1.5s under 50 concurrent streams · backup restore tested · Sentry quiet · college written approval on file · landing page Lighthouse ≥ 90 · a11y: zero critical axe violations · cost dashboard live · daily budget cap armed.

---

## 7. Content & Partnership Plan (the real critical path)

Code is not the bottleneck — **trusted official content and institutional permission are.** Start this in week 1, in parallel:

1. **Sponsor.** Identify one faculty/administration champion (HOD or registrar's office). Offer: "UPC AI answers students' repetitive questions (fees, dates, rules) with your official documents, cited — 24/7."
2. **Permission.** Get written approval for: using the college name/logo, hosting official documents, student email-based access (DPDP consent at signup). Keep a signed one-pager.
3. **Content acquisition checklist** (target 100+ docs by week 11): fee structures (all courses/years) · academic calendar · exam schedules · timetables · hostel rules · scholarship notices · admission bulletins · syllabi (pilot dept first) · library rules · anti-ragging/gravience policies · previous year papers · placement notices.
4. **Metadata discipline.** Every document gets: category, department, audience, effective/expiry dates, access level. This is what makes retrieval correct — treat it as seriously as code. 30 minutes of metadata work saves 30 wrong answers.
5. **Pilot loop.** Week 10's department is the proof case for the rest of the college. Collect 👎 feedback with reasons; every "outdated" complaint is a document version fix, every "wrong" complaint is an eval-set entry.
6. **DPDP posture:** data minimization, no vendor training on UPC data (provider config), DPDP export endpoint, soft-delete + purge policies per Database doc.

---

## 8. AI Quality Program

- **Golden set:** 100 queries (50 EN / 50 HI) with expected source docs, versioned in repo. Every retrieval-affecting change (chunking, embedding model, filters, prompt) reruns the eval in CI. Precision@5 ≥ 80% is the gate.
- **Refusal quality:** "not in the official knowledge base" answers are tested explicitly (25 no-evidence queries must refuse, not hallucinate).
- **Embedding decision gate (week 6):** if Hindi precision@5 < 80% with `text-embedding-3-small`, evaluate a multilingual model; re-embed via shadow-index + atomic swap (never mixed-model serving).
- **Prompt versioning-lite:** prompts live in the DB with version + changelog; every AI response records prompt_id+version; 👎 feedback is queryable by prompt version.
- **Cost observability:** per-request cost logged (provider, model, tokens, intent); admin cost dashboard from week 7; weekly cost review in the week note.
- **Citation spot-checks:** 10 sampled answers/week manually verified during pilot fortnight.

---

## 9. Solo + AI-Agent Operating Model

**The loop that ships:** pick ONE task from the current week → write a tight task brief (file paths, spec references in `docs/`, acceptance criteria) → agent implements → I review the diff like a senior reviewer (correctness, spec fidelity, tests) → run gates → merge → update week note. Never let an agent make an architectural decision that contradicts the docs; if the docs are wrong, fix the doc in the same PR.

**Definition of Done (every PR):** typecheck + lint clean · tests for new logic · no spec contradiction (or doc updated in-PR) · manual smoke of the touched flow · week note updated.

**Cadence:** Monday plan (week goals → tasks) · daily: 2–4 PRs through the loop · Friday: demo checkpoint + week note + next-week plan. If a task chokes the agent twice, split it smaller — that's a planning smell, not a model problem.

**Gates that stay mandatory (never skip):** typecheck, lint, unit tests on business logic, smoke suite before deploy, eval gate on retrieval changes. **Gates relaxed for solo v1:** 2-reviewer rule (self-review + agent cross-review), 80% coverage (core logic only), load testing (one checkpoint at week 11), formal security pentest (self-audit checklist in v1; external before scaling college-wide).

**Bots die, humans ship.** The week notes, this plan, and the docs/ specs are the persistent brain — any new agent session starts from them, not from scratch.

---

## 10. Risk Register (solo-specific)

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| S1 | Motivation/consistency fade over 12 weeks | M | H | Weekly demo checkpoints create visible momentum; pilot users by week 10 create external accountability; scope cut is pre-agreed (§2) |
| S2 | College permission stalls | M | **Critical** | Start week 1 (§7); the product works even in "unofficial pilot" mode with a friendly department |
| S3 | Hindi retrieval quality below bar | M | H | Embedding gate week 6; multilingual model swap path is pre-designed (shadow index) |
| S4 | OCR fails on scanned Hindi docs | M | M | Eval 50 real pages in week 5; cloud OCR tier-2 is a config change, budget reserved |
| S5 | AI cost runaway | L | M | Daily caps, tiering, budget alerts (§5); cache in v1.1 |
| S6 | Solo bus factor / burnout | M | M | Docs-as-brain (any session resumable), week notes, sustainable cadence |
| S7 | Scope creep from faculty requests | **H** | M | §2 rule: not in the IN table → v1.1+ backlog, said politely |
| S8 | Provider outage during exams | L | H | 3-provider failover from week 4; degradation banner; cheap tier absorbs spikes |

---

## 11. Post-Launch Roadmap (the "perfect it" path)

- **v1.1 (weeks 13–18):** semantic answer cache · notifications (in-app + email) · Document Workspace (PDF viewer, doc-chat, highlights) · revision notes + bookmarks UI · cross-encoder re-ranking if eval-gated · Command Palette polish · usage analytics for admins.
- **v1.2 (weeks 19–26):** hash-chained audit store · analytics warehouse + coverage-gap reports · read replica + PgBouncer tuning · Prometheus/Grafana + alerting · external security audit · external pentest · DPDP audit.
- **v2.0 (college-wide scale):** partitioning (messages/audit by month) · pgvector → dedicated vector DB if > 500k chunks (shadow-index migration per ADR-06) · PWA offline shell · share chats · web_search tool for academic mode · passkeys.
- **Only after UPC is perfect:** revisit the multi-college question. The architecture's seams (module boundaries, provider abstraction, retrieval choke point) were kept open for exactly that day.

---

*This plan supersedes the 30-week Implementation Roadmap for execution purposes; the original remains in `docs/` as the team-scale reference. Specs: `docs/UPC_AI_*` v2.0/1.1. When reality disagrees with this file, update this file.*
