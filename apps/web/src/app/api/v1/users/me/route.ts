import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, userPreferences } from "@upc/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** GET /v1/users/me */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1);
    if (!user) throw new ApiError("RESOURCE_NOT_FOUND", "User not found");
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1);

    return ok({
      user_id: user.id,
      email: user.email,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      user_type: user.userType,
      department_id: user.departmentId,
      is_verified: user.isVerified,
      roles: claims.roles,
      preferences: prefs
        ? {
            theme: prefs.theme,
            language: prefs.language,
            response_length: prefs.responseLength,
            difficulty: prefs.difficulty,
            default_study_mode: prefs.defaultStudyMode,
          }
        : null,
      created_at: user.createdAt,
    });
  } catch (err) {
    return fail(err);
  }
}
