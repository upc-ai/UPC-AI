import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, userSessions } from "@upc/db";
import { ApiError, strongPasswordSchema } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { rateLimit } from "@/lib/redis";
import { verifyOtp } from "@/lib/auth/otp";
import { hashPassword } from "@/lib/auth/crypto";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  code: z.string().length(6),
  new_password: strongPasswordSchema,
});

/**
 * POST /v1/auth/reset-password — step 2: consume the emailed code, set the new
 * password, and revoke EVERY session (a stolen session dies with the reset).
 */
export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const rl = await rateLimit(`reset:${ip}`, 10, 3600);
    if (!rl.allowed) throw new ApiError("RATE_LIMIT_EXCEEDED", "Too many attempts. Please wait.");

    await verifyOtp(body.email, "password_reset", body.code);

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (!user) throw new ApiError("AUTH_CREDENTIALS_INVALID", "Invalid or expired code");
    if (!user.isActive) throw new ApiError("FORBIDDEN", "This account is disabled. Contact the administrator.");

    await db
      .update(users)
      .set({
        passwordHash: await hashPassword(body.new_password),
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, user.id));

    await db
      .update(userSessions)
      .set({ isActive: false, revokedAt: new Date(), revokedReason: "password_reset" })
      .where(eq(userSessions.userId, user.id));

    return ok({ message: "Password updated. Sign in with your new password." });
  } catch (err) {
    return fail(err);
  }
}
