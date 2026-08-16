# UPC AI

The official AI-powered academic & campus assistant for **Udai Pratap College (UPC), Varanasi**.

- **Ask anything academic** — step-by-step solutions with math + code rendering
- **Official college answers** — grounded in approved documents, always cited, refusal over hallucination
- **Study tools** — AI quizzes and spaced-repetition flashcards
- **Warm-editorial design** — cream canvas, serif display, coral CTAs

## Repository layout

```
apps/
  web/      Next.js 14 — landing, chat (SSE streaming), APIs (auth, chat, documents, admin)
  worker/   BullMQ ingestion worker — parse → chunk → embed → index
packages/
  core/     shared types, env schema, constants, API error codes
  db/       Drizzle schema + client (Postgres + pgvector)
  ui/       design tokens (CSS custom properties) + common components
docs/       the 7 specification documents (design system v2.0, UIUX, architecture...)
MASTER_PLAN.md   the operating manual — scope, 12-week plan, costs, quality gates
```

## Quick start

```bash
# 1. Install
pnpm install

# 2. Environment
cp .env.example apps/web/.env.local
#   - set DATABASE_URL (Neon/Supabase/local Postgres with pgvector)
#   - generate JWT keys (command in .env.example) and paste them
#   - set at least one AI provider key (GROQ_API_KEY is free)

# 3. Database (requires a running Postgres with `CREATE EXTENSION vector;`)
pnpm db:generate && pnpm db:migrate

# 4. Seed roles + first admin
pnpm seed:admin -- --email you@upc.ac.in

# 5. Run
pnpm dev            # web on :3000
pnpm dev:worker     # ingestion worker (separate terminal)
```

## Verification

```bash
pnpm typecheck && pnpm test && pnpm build
```

## Specs & plan

Read `MASTER_PLAN.md` first; the `docs/` folder is the full specification set. When code and docs disagree, docs win — update the doc in the same PR.
