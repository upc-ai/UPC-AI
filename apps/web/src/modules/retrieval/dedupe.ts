/**
 * Near-duplicate suppression for retrieval results. Hybrid fusion can return
 * the same passage twice (intentional chunk overlap, repeated page headers,
 * boilerplate nav). Greedy trigram-Jaccard filter keeps the higher-ranked copy
 * and drops anything too similar to an already-kept chunk. Pure logic —
 * unit-tested; applied before rerank / TOP-K slicing in search.ts.
 */

export interface RankableChunk {
  id: string;
  content: string;
}

export const DUPLICATE_JACCARD = 0.85;

function trigrams(s: string): Set<string> {
  const t = s.toLowerCase().replace(/\s+/g, " ").trim();
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

export function trigramJaccard(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Keep the first (highest-ranked) member of every near-duplicate cluster. */
export function dedupeRanked<T extends RankableChunk>(ranked: T[], threshold: number = DUPLICATE_JACCARD): T[] {
  const kept: T[] = [];
  const keptGrams: Set<string>[] = [];
  for (const chunk of ranked) {
    const grams = trigrams(chunk.content);
    let duplicate = false;
    for (const k of keptGrams) {
      let inter = 0;
      for (const g of grams) if (k.has(g)) inter++;
      if (inter / (grams.size + k.size - inter) >= threshold) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) {
      kept.push(chunk);
      keptGrams.push(grams);
    }
  }
  return kept;
}
