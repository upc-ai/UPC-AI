import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@upc/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { rateLimit } from "@/lib/redis";
import { issueOtp } from "@/lib/auth/otp";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
});

/**
 * POST /v1/auth/forgot-password — step 1: email a one-time reset code.
 * Non-enumerating by design: the response is identical whether or not the
 * account exists. Rate-limited per-IP and per-email.
 */
export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? "local";

    const [perEmail, perIp] = await Promise.all([
      rateLimit(`forgot:${body.email}`, 3, 3600),
      // Campus-NAT: one public IP for the whole university (per-email cap
      // above still prevents reset-bombing any single inbox).
      rateLimit(`forgotip:${ip}`, 30, 3600),
    ]);
    if (!perEmail.allowed || !perIp.allowed) {
      throw new ApiError("RATE_LIMIT_EXCEEDED", "Too many reset requests. Please wait an hour.");
    }

    const db = getDb();
    const [user] = await db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    if (user?.isActive) {
      // issueOtp emails the code when Resend is configured; console mode logs it.
      // The response NEVER carries a devCode for password_reset (see otp.ts).
      await issueOtp(body.email, "password_reset");
    }

    return ok({
      message: "If an account exists for this email, a reset code has been sent.",
      expires_in: 600,
    });
  } catch (err) {
    return fail(err);
  }
}
