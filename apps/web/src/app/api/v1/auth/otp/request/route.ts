import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@upc/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { rateLimit } from "@/lib/redis";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, setRefreshCookie } from "@/lib/auth/session";

const requestSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  purpose: z.enum(["login", "email_verify", "password_reset"]).default("login"),
});

/** POST /v1/auth/otp/request */
export async function POST(req: NextRequest) {
  try {
    const body = requestSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? "local";

    const [perEmail, perIp] = await Promise.all([
      rateLimit(`otp:${body.email}`, 3, 60),
      // Campus-NAT: the whole university shares one public IP — the per-IP cap
      // must absorb rollout-day verification spikes (per-email cap above still
      // prevents OTP-bombing any single inbox).
      rateLimit(`otpip:${ip}`, 30, 60),
    ]);
    if (!perEmail.allowed || !perIp.allowed) {
      throw new ApiError("RATE_LIMIT_EXCEEDED", "Too many OTP requests. Please wait.");
    }

    if (body.purpose !== "login") {
      // login: non-existent emails just don't send (no enumeration either way)
      const db = getDb();
      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
      if (!user) {
        return ok({ message: "If an account exists, a code has been sent", expires_in: 600 });
      }
    }

    const otp = await issueOtp(body.email, body.purpose);
    return ok({
      message: `Code sent to ${body.email}`,
      expires_in: otp.expiresInSeconds,
      ...(otp.devCode ? { dev_otp: otp.devCode } : {}),
    });
  } catch (err) {
    return fail(err);
  }
}

/** PUT /v1/auth/otp/request (verify) — kept in one file: request + verify share context. */
const verifySchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  otp: z.string().length(6),
  purpose: z.enum(["login", "email_verify", "password_reset"]).default("login"),
});

export async function PUT(req: NextRequest) {
  try {
    const body = verifySchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const rl = await rateLimit(`otpverify:${body.email}`, 5, 60);
    if (!rl.allowed) throw new ApiError("RATE_LIMIT_EXCEEDED", "Too many attempts. Please wait.");

    await verifyOtp(body.email, body.purpose, body.otp);

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (!user) throw new ApiError("AUTH_CREDENTIALS_INVALID", "Invalid code");

    if (body.purpose === "email_verify") {
      await db
        .update(users)
        .set({ isVerified: true, emailVerifiedAt: new Date() })
        .where(eq(users.id, user.id));
      return ok({ message: "Email verified successfully", is_verified: true });
    }

    // login (passwordless) → full session
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
