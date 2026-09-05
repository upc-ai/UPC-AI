import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth, canAdminPanel } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * GET /v1/admin/analytics — usage + cost + quality numbers computed from
 * ai_responses / messages / feedback (OLTP, pilot scale). `?days=30` window.
 */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canAdminPanel(claims)) throw new ApiError("FORBIDDEN", "Admin panel access is restricted");

    const days = Math.min(90, Math.max(7, Number(new URL(req.url).searchParams.get("days") ?? "30") || 30));
    const db = getDb();

    // Messages per day + distinct active users (user-role rows only)
    const usage = await db.execute(sql`
      select to_char((m.created_at + interval '5 hours 30 minutes')::date, 'YYYY-MM-DD') as day,
             count(*)::int as messages,
             count(distinct s.user_id)::int as active_users
      from messages m join chat_sessions s on s.id = m.session_id
      where m.role = 'user' and m.created_at >= now() - (${days} || ' days')::interval
      group by 1 order by 1
    `);

    // Per model+provider usage, tokens, cost (ai_responses has every AI turn)
    const models = await db.execute(sql`
      select r.model_used as model, r.provider_used as provider,
             count(*)::int as responses,
             coalesce(sum(r.tokens_input), 0)::bigint as tokens_in,
             coalesce(sum(r.tokens_output), 0)::bigint as tokens_out,
             coalesce(sum(r.cost_estimate), 0)::float8 as cost_usd,
             coalesce(avg(r.first_token_latency_ms), 0)::int as avg_first_token_ms
      from ai_responses r
      where r.created_at >= now() - (${days} || ' days')::interval
      group by 1, 2 order by responses desc
    `);

    const [cost] = await db.execute(sql`
      select coalesce(sum(cost_estimate), 0)::float8 as month_cost_usd,
             coalesce(sum(tokens_input), 0)::bigint as tokens_in,
             coalesce(sum(tokens_output), 0)::bigint as tokens_out
      from ai_responses
      where created_at >= date_trunc('month', now())
    `);

    // Feedback ratio + top cited documents
    const [feedback] = await db.execute(sql`
      select
        count(*) filter (where feedback_type = 'thumbs_up')::int as thumbs_up,
        count(*) filter (where feedback_type = 'thumbs_down')::int as thumbs_down
      from feedback
      where created_at >= now() - (${days} || ' days')::interval
    `);

    const topDocs = await db.execute(sql`
      select d.title, count(*)::int as citations
      from citations c join documents d on d.id = c.document_id
      group by d.title order by citations desc limit 10
    `);

    return ok({
      window_days: days,
      usage,
      models,
      month: cost ?? { month_cost_usd: 0, tokens_in: 0, tokens_out: 0 },
      feedback: feedback ?? { thumbs_up: 0, thumbs_down: 0 },
      top_documents: topDocs,
    });
  } catch (err) {
    return fail(err);
  }
}
