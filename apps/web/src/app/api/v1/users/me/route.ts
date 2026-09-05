import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { users, userPreferences, userSessions } from "@upc/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/redis";
import { verifyPassword } from "@/lib/auth/crypto";
import { auditLogs } from "@upc/db";

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

const deleteSchema = z.object({
  password: z.string().min(1).optional(), // required for password accounts
});

/**
 * DELETE /v1/users/me — self-service account deletion (settings page).
 * Security model: password-confirmed, PII is anonymized in place (GDPR-erase
 * style), every session is revoked, and the row is kept so foreign keys that
 * reference the user (audit trail, uploaded documents) stay intact. The
 * anonymized account can never log in again.
 */
export async function DELETE(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    const rl = await rateLimit(`delacct:${claims.sub}`, 3, 3600);
    if (!rl.allowed) throw new ApiError("RATE_LIMIT_EXCEEDED", "Too many attempts. Please wait.");

    const body = deleteSchema.parse(await req.json().catch(() => ({})));
    const db = getDb();

    const [user] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1);
    if (!user) throw new ApiError("RESOURCE_NOT_FOUND", "User not found");
    if (!user.isActive) throw new ApiError("FORBIDDEN", "Account already deleted");

    if (user.passwordHash) {
      if (!body.password) throw new ApiError("VALIDATION_ERROR", "Enter your password to confirm deletion");
      if (!(await verifyPassword(body.password, user.passwordHash))) {
        throw new ApiError("AUTH_CREDENTIALS_INVALID", "Password is incorrect");
      }
    } else if (body.password) {
      throw new ApiError("VALIDATION_ERROR", "This account signs in with Google — no password to confirm. Just confirm the dialog.");
    }

    // PII erase + tombstone. Email is remapped to a unique throwaway so the
    // address can immediately be re-registered as a fresh account.
    const tombstone = `deleted.${randomBytes(8).toString("hex")}@invalid.upcai`;
    await db
      .update(users)
      .set({
        email: tombstone,
        displayName: "Deleted user",
        passwordHash: null,
        googleSub: null,
        avatarUrl: null,
        phone: null,
        isActive: false,
        deletedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await db
      .update(userSessions)
      .set({ isActive: false, revokedAt: new Date(), revokedReason: "account_deleted" })
      .where(eq(userSessions.userId, user.id));

    await db.insert(auditLogs).values({
      actorId: user.id,
      action: "account_deleted",
      resourceType: "user",
      resourceId: user.id,
      changeSummary: `Account ${tombstone} self-deleted (PII anonymized, sessions revoked)`,
    });

    return ok({ message: "Account deleted. All data has been anonymized and you have been signed out everywhere." });
  } catch (err) {
    return fail(err);
  }
}
