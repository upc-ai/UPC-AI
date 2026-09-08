/**
 * The ONLY definition of what a student may see. Both retrieval stages
 * (vector + BM25) embed this fragment — a regression test asserts these
 * clauses survive refactors, so retrieval can never silently widen.
 *
 * SAFETY INVARIANT: only published, active, unexpired document versions with
 * active chunks are candidates for student-facing answers.
 */
import { sql } from "drizzle-orm";

export const VISIBLE_DOC_FILTER = sql`
  c.status = 'active'
  AND d.status = 'published'
  AND d.is_active_version = true
  AND (d.expiry_date IS NULL OR d.expiry_date > CURRENT_DATE)
`;
