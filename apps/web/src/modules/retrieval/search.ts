/**
 * Retrieval Service (Architecture §3.10) — the single choke point for knowledge reads.
 * Hybrid search: pgvector cosine + tsvector BM25 → Reciprocal Rank Fusion → top-K + citations.
 * Access control: only `published` documents with unexpired dates are ever candidates.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getEnv } from "@upc/core";
import { embedBatch } from "./embedClient";

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
const TOP_K = 6;

/** Hybrid retrieve for a query. Returns [] when there is no evidence (P7 refusal path). */
export async function retrieve(query: string, filter?: { departmentId?: string | null }): Promise<RetrievedChunk[]> {
  const env = getEnv();
  const apiKey = env.OPENAI_EMBEDDING_KEY || env.OPENAI_API_KEY;
  const db = getDb();

  const queryEmbedding = apiKey ? (await embedBatch([query], apiKey))[0]?.vector : null;

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
               ts_rank(to_tsvector('simple', c.content), websearch_to_tsquery('simple', ${query})) AS score
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE c.status = 'active'
          AND d.status = 'published'
          AND d.is_active_version = true
          AND (d.expiry_date IS NULL OR d.expiry_date > CURRENT_DATE)
          ${filter?.departmentId ? sql`AND (d.department_id IS NULL OR d.department_id = ${filter.departmentId})` : sql``}
          AND to_tsvector('simple', c.content) @@ websearch_to_tsquery('simple', ${query})
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

  // Relevance gate: fusion scores below threshold = no real evidence → refusal (P7).
  const EVIDENCE_THRESHOLD = 0.008;
  return ranked
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
}
