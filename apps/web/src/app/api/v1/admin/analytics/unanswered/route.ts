import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth, canAdminPanel } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * GET /v1/admin/analytics/unanswered — coverage gaps at pilot scale
 * (Backend §6.6): groups retrieval attempts that hit the grounded-refusal
 * path (or scored below the evidence gate) into the exact questions students
 * asked that the knowledge base couldn't answer. The admin's to-do list for
 * the next sync/upload.
 */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canAdminPanel(claims)) throw new ApiError("FORBIDDEN", "Admin panel access is restricted");

    const db = getDb();
    const days = Math.min(90, Math.max(7, Number(new URL(req.url).searchParams.get("days") ?? "30") || 30));

    // Normalized question groups: refused retrieval attempts, newest first
    const groups = (await db.execute(sql`
      select r.query,
             count(*)::int as times_asked,
             max(r.created_at) as last_asked,
             bool_or(r.refused) as fully_refused,
             min(nullif(r.top_score, 0)) as best_score
      from retrieval_logs r
      where r.created_at >= now() - (${days} || ' days')::interval
        and (r.refused or coalesce(r.top_score, 0) < 0.016)
      group by r.query
      order by times_asked desc, last_asked desc
      limit 25
    `)) as unknown as {
      query: string;
      times_asked: number;
      last_asked: string;
      fully_refused: boolean;
      best_score: string | null;
    }[];

    // Aggregate for the header stat
    const [totals] = (await db.execute(sql`
      select count(*) filter (where refused)::int as refused_count,
             count(*)::int as total_count
      from retrieval_logs
      where created_at >= now() - (${days} || ' days')::interval
    `)) as unknown as { refused_count: number; total_count: number }[];

    return ok({
      questions: groups.map((g) => ({
        question: g.query,
        times_asked: g.times_asked,
        last_asked: g.last_asked,
        fully_refused: g.fully_refused,
        best_score: g.best_score ? Number(g.best_score) : null,
      })),
      refused_count: totals?.refused_count ?? 0,
      total_count: totals?.total_count ?? 0,
      window_days: days,
    });
  } catch (err) {
    return fail(err);
  }
}
