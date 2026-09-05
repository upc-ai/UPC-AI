import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@upc/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth, canAdminPanel } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

/**
 * GET /v1/admin/users — user list for the panel (read-only in this version).
 * `?q=` searches email/display name; includes roles + last login.
 */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canAdminPanel(claims)) throw new ApiError("FORBIDDEN", "Admin panel access is restricted");

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

    const db = getDb();
    const like = `%${q.toLowerCase()}%`;
    const searchCond = q ? sql`lower(u.email) like ${like} or lower(u.display_name) like ${like}` : sql`true`;

    const rows = await db.execute(sql`
      select u.id, u.email, u.display_name, u.user_type, u.is_active, u.is_verified,
             u.last_login_at, u.login_count, u.created_at,
             coalesce(string_agg(distinct r.role_name, ', ' order by r.role_name), '') as roles
      from users u
      left join user_roles ur on ur.user_id = u.id and ur.is_active
      left join roles r on r.id = ur.role_id
      where ${searchCond}
      group by u.id
      order by u.created_at desc
      limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}
    `);

    const [total] = await db.select({ n: sql<number>`count(*)::int` }).from(users);

    return ok({ users: rows, total: total?.n ?? 0, page, page_size: PAGE_SIZE });
  } catch (err) {
    return fail(err);
  }
}
