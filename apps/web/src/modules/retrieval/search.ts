/**
 * Retrieval Service (Architecture §3.10) — the single choke point for knowledge reads.
 * Hybrid search: pgvector cosine + tsvector BM25 → Reciprocal Rank Fusion → top-K + citations.
 * Access control: only `published` documents with unexpired dates are ever candidates.
 *
 * RAG v2: query embedding resolves through the SAME managed config as the
 * ingest pipeline (Gemini via env/managed settings) — previously this looked
 * for OpenAI keys only, so vector search never ran (BM25-only retrieval).
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getEnv } from "@upc/core";
import { embedBatch, resolveEmbedConfig, type EmbedConfig } from "@upc/ingest";
import { rewriteQuery } from "./rewrite";

export interface RetrievedChunk {
  chunkId: string;
  content: string;
  documentId: string;
  documentTitle: string;
  documentVersion: number;
  pageNumber: number | null;
  relevanceScore: number;
  hierarchyPath: string | null;
}

const VECTOR_CANDIDATES = 30;
const BM25_CANDIDATES = 30;
export const TOP_K = 6;
/** Fusion scores below this = no real evidence → refusal (P7). */
export const EVIDENCE_THRESHOLD = 0.008;

/** Query-side embedder: managed/env config + Gemini fallback from AI_CUSTOM_PROVIDERS. */
async function queryEmbedConfig(): Promise<EmbedConfig | null> {
  const env = getEnv();
  const direct = resolveEmbedConfig({
    EMBEDDING_PROVIDER: env.EMBEDDING_PROVIDER,
    EMBEDDING_API_KEY: env.EMBEDDING_API_KEY,
    EMBEDDING_BASE_URL: env.EMBEDDING_BASE_URL,
    OPENAI_EMBEDDING_KEY: env.OPENAI_EMBEDDING_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    GEMINI_API_KEY: env.GEMINI_API_KEY,
  });
  if (direct) return direct;
  // Fall back to the chat Gemini key (same provider family powers doc-side embeddings)
  if (env.AI_CUSTOM_PROVIDERS) {
    try {
      const customs = JSON.parse(env.AI_CUSTOM_PROVIDERS) as { name: string; baseUrl: string; apiKey: string }[];
      const gemini = customs.find((c) => /generativelanguage/.test(c.baseUrl));
      if (gemini) return { provider: "gemini", apiKey: gemini.apiKey, baseUrl: gemini.baseUrl };
    } catch {
      /* malformed env — treat as unconfigured */
    }
  }
  return null;
}

export interface RetrieveOptions {
  /** Last few turns for pronoun resolution in query rewriting. */
  history?: { role: string; content: string }[];
  /** Skip the rewrite LLM call (eval runs, tests). */
  skipRewrite?: boolean;
}

export interface RetrieveResult {
  chunks: RetrievedChunk[];
  /** The query actually searched (rewritten when rewriting ran). */
  effectiveQuery: string;
}

/**
 * Hybrid retrieve for a query. Rewrites first (fail-open), then vector +
 * BM25 + RRF fusion. Returns empty chunks when there is no evidence (P7
 * refusal path) — the caller logs the attempt and refusal.
 */
export async function retrieve(
  query: string,
  filter?: { departmentId?: string | null },
  opts: RetrieveOptions = {},
): Promise<RetrieveResult> {
  const db = getDb();

  const effectiveQuery = opts.skipRewrite
    ? query
    : (await rewriteQuery(query, opts.history ?? [])) ?? query;

  const embedCfg = await queryEmbedConfig();
  const queryEmbedding = embedCfg ? (await embedBatch([effectiveQuery], embedCfg))[0]?.vector : null;

  // ---- Stage 1a: vector search (cosine, pre-filtered) ----
  const vectorRows = queryEmbedding
    ? ((await db.execute(sql`
        SELECT c.id, c.content, c.document_id, c.page_number, c.hierarchy_path,
               d.title AS document_title, d.version AS document_version,
               1 - (e.embedding_vector <=> ${queryEmbedding}::vector) AS score
        FROM chunks c
        JOIN embeddings e ON e.chunk_id = c.id
        JOIN documents d ON d.id = c.document_id
        WHERE c.status = 'active'
          AND d.status = 'published'
          AND d.is_active_version = true
          AND (d.expiry_date IS NULL OR d.expiry_date > CURRENT_DATE)
          ${filter?.departmentId ? sql`AND (d.department_id IS NULL OR d.department_id = ${filter.departmentId})` : sql``}
        ORDER BY e.embedding_vector <=> ${queryEmbedding}::vector
        LIMIT ${VECTOR_CANDIDATES}
      `)) as unknown as Record<string, unknown>[])
    : [];

  // ---- Stage 1b: BM25 (tsvector) search ----
  const bm25Rows = ((await db.execute(sql`
        SELECT c.id, c.content, c.document_id, c.page_number, c.hierarchy_path,
               d.title AS document_title, d.version AS document_version,
               ts_rank(to_tsvector('simple', c.content), websearch_to_tsquery('simple', ${effectiveQuery})) AS score
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE c.status = 'active'
          AND d.status = 'published'
          AND d.is_active_version = true
          AND (d.expiry_date IS NULL OR d.expiry_date > CURRENT_DATE)
          ${filter?.departmentId ? sql`AND (d.department_id IS NULL OR d.department_id = ${filter.departmentId})` : sql``}
          AND to_tsvector('simple', c.content) @@ websearch_to_tsquery('simple', ${effectiveQuery})
        ORDER BY score DESC
        LIMIT ${BM25_CANDIDATES}
      `)) as unknown as Record<string, unknown>[]);

  // ---- Stage 2: Reciprocal Rank Fusion ----
  const K = 60;
  const fused = new Map<string, { row: Record<string, unknown>; score: number }>();
  const addRanking = (rows: Record<string, unknown>[], weight = 1) => {
    rows.forEach((row, rank) => {
      const id = row.id as string;
      const contribution = weight / (K + rank + 1);
      const existing = fused.get(id);
      if (existing) existing.score += contribution;
      else fused.set(id, { row, score: contribution });
    });
  };
  addRanking(vectorRows);
  addRanking(bm25Rows);

  const ranked = [...fused.values()].sort((a, b) => b.score - a.score).slice(0, TOP_K);

  const chunks = ranked
    .filter((r) => r.score >= EVIDENCE_THRESHOLD)
    .map((r) => ({
      chunkId: r.row.id as string,
      content: r.row.content as string,
      documentId: r.row.document_id as string,
      documentTitle: r.row.document_title as string,
      documentVersion: (r.row.document_version as number) ?? 1,
      pageNumber: (r.row.page_number as number | null) ?? null,
      relevanceScore: Number(r.score),
      hierarchyPath: (r.row.hierarchy_path as string | null) ?? null,
    }));

  return { chunks, effectiveQuery };
}
