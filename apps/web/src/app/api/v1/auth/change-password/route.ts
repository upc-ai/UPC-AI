import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, userSessions } from "@upc/db";
import { ApiError, strongPasswordSchema } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/redis";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  current_password: z.string().min(1),
  new_password: strongPasswordSchema,
});

/**
 * POST /v1/auth/change-password — settings page. Requires the current
 * password; revokes every OTHER session (this device stays signed in).
 */
export async function POST(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    const body = bodySchema.parse(await req.json());
    const rl = await rateLimit(`chpw:${claims.sub}`, 5, 3600);
    if (!rl.allowed) throw new ApiError("RATE_LIMIT_EXCEEDED", "Too many attempts. Please wait.");

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1);
    if (!user) throw new ApiError("RESOURCE_NOT_FOUND", "Account not found");
    if (!user.passwordHash) {
      // Google-only account — password change doesn't apply (no credential here)
      throw new ApiError("VALIDATION_ERROR", "This account signs in with Google. Set a password via 'Forgot password' on the login page first.");
    }
    if (!(await verifyPassword(body.current_password, user.passwordHash))) {
      throw new ApiError("AUTH_CREDENTIALS_INVALID", "Current password is incorrect");
    }
    if (await verifyPassword(body.new_password, user.passwordHash)) {
      throw new ApiError("VALIDATION_ERROR", "New password must be different from the current one");
    }

    await db.update(users).set({ passwordHash: await hashPassword(body.new_password) }).where(eq(users.id, user.id));

    // Everywhere else gets signed out; this session keeps its refresh token.
    await db
      .update(userSessions)
      .set({ isActive: false, revokedAt: new Date(), revokedReason: "password_changed" })
      .where(and(eq(userSessions.userId, user.id), ne(userSessions.id, claims.session_id)));

    return ok({ message: "Password changed. Other devices have been signed out." });
  } catch (err) {
    return fail(err);
  }
}
