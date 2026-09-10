import { NextRequest } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@upc/db";
import { ApiError, LOGIN_LOCKOUT_SECONDS, MAX_LOGIN_ATTEMPTS } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/crypto";
import { rateLimit } from "@/lib/redis";
import { createSession, setRefreshCookie } from "@/lib/auth/session";

const bodySchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const body = bodySchema.parse(await req.json());

    // Campus-NAT calibrated: the whole university shares one public IP, so this
    // per-IP limit is flood defense only — the per-account lockout (below) is
    // the real brute-force protection and is unaffected by this number.
    const rl = await rateLimit(`login:${ip}`, 100, 60);
    if (!rl.allowed) throw new ApiError("RATE_LIMIT_EXCEEDED", "Too many attempts. Please wait a minute.");

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);

    if (!user || !user.passwordHash) {
      throw new ApiError("AUTH_CREDENTIALS_INVALID", "Invalid email or password");
    }
    if (!user.isActive) throw new ApiError("FORBIDDEN", "Account disabled. Contact the administrator.");
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ApiError("ACCOUNT_LOCKED", "Account locked. Try again in a few minutes.");
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const lock = attempts >= MAX_LOGIN_ATTEMPTS;
      await db
        .update(users)
        .set({
          failedLoginAttempts: attempts,
          ...(lock
            ? { lockedUntil: new Date(Date.now() + LOGIN_LOCKOUT_SECONDS * 1000), failedLoginAttempts: 0 }
            : {}),
        })
        .where(eq(users.id, user.id));
      throw new ApiError(
        "AUTH_CREDENTIALS_INVALID",
        lock ? "Account locked. Try again in 15 minutes." : "Invalid email or password",
      );
    }

    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: sql`now()`, loginCount: sql`${users.loginCount} + 1` })
      .where(eq(users.id, user.id));

    const tokens = await createSession(user.id, { ipAddress: ip });
    await setRefreshCookie(tokens.refreshToken);

    return ok({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      user: {
        user_id: user.id,
        email: user.email,
        display_name: user.displayName,
        user_type: user.userType,
        is_verified: user.isVerified,
      },
    });
  } catch (err) {
    return fail(err);
  }
}
