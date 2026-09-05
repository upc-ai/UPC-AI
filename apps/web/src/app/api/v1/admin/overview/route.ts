import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, documents, messages } from "@upc/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth, canAdminPanel } from "@/lib/auth/guard";
import { getManagedConfig } from "@/modules/providers/managed-config";

export const dynamic = "force-dynamic";

/**
 * GET /v1/admin/overview — dashboard stat cards + 7-day trend + recent activity.
 * All numbers computed live from OLTP tables (pilot scale per MASTER_PLAN).
 */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canAdminPanel(claims)) throw new ApiError("FORBIDDEN", "Admin panel access is restricted");

    const db = getDb();
    const { quota } = await getManagedConfig();

    const [userCounts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        students: sql<number>`count(*) filter (where user_type = 'student')::int`,
        faculty: sql<number>`count(*) filter (where user_type = 'faculty')::int`,
        active: sql<number>`count(*) filter (where is_active)::int`,
      })
      .from(users);

    const [todayStats] = await db
      .select({
        messagesToday: sql<number>`count(*)::int`,
        activeUsersToday: sql<number>`count(distinct s.user_id)::int`,
      })
      .from(sql`messages m join chat_sessions s on s.id = m.session_id`)
      // IST midnight computed IN SQL — binding a JS Date into raw sql`` is not
      // serializable on the postgres-js driver (ERR_INVALID_ARG_TYPE).
      .where(sql`m.role = 'user' and m.created_at >= date_trunc('day', now() + interval '5 hours 30 minutes') - interval '5 hours 30 minutes'`);

    const [docCounts] = await db
      .select({
        published: sql<number>`count(*) filter (where status = 'published')::int`,
        pending: sql<number>`count(*) filter (where status in ('uploaded','parsing','chunking','embedding','indexed'))::int`,
        // status is a doc_status ENUM — LIKE needs the text cast
        failed: sql<number>`count(*) filter (where status::text like '%\\_failed')::int`,
        totalChunks: sql<number>`coalesce(sum(chunk_count), 0)::int`,
      })
      .from(documents);

    // 7-day usage trend (messages/day + distinct active users/day, IST days)
    const trend = await db
      .select({
        day: sql<string>`to_char((m.created_at + interval '5 hours 30 minutes')::date, 'YYYY-MM-DD')`,
        messages: sql<number>`count(*)::int`,
        activeUsers: sql<number>`count(distinct s.user_id)::int`,
      })
      .from(sql`messages m join chat_sessions s on s.id = m.session_id`)
      .where(sql`m.role = 'user' and m.created_at >= now() - interval '7 days'`)
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    // Recent activity: latest audit events
    const recent = await db.execute(sql`
      select a.created_at as at, u.display_name as actor, a.action, a.change_summary as summary
      from audit_logs a left join users u on u.id = a.actor_id
      order by a.created_at desc limit 8
    `);

    return ok({
      users: userCounts ?? { total: 0, students: 0, faculty: 0, active: 0 },
      today: todayStats ?? { messagesToday: 0, activeUsersToday: 0 },
      documents: docCounts ?? { published: 0, pending: 0, failed: 0, totalChunks: 0 },
      trend,
      recent,
      quota,
    });
  } catch (err) {
    return fail(err);
  }
}
