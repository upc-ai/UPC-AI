import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, userPreferences, students, userRoles, roles } from "@upc/db";
import { ApiError, USER_TYPES } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { rateLimit } from "@/lib/redis";
import { createSession, setRefreshCookie } from "@/lib/auth/session";
import { issueOtp } from "@/lib/auth/otp";

const bodySchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a digit")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
  displayName: z.string().min(2).max(100),
  userType: z.enum(USER_TYPES).default("student"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const rl = await rateLimit(`register:${ip}`, 5, 60);
    if (!rl.allowed) throw new ApiError("RATE_LIMIT_EXCEEDED", "Too many attempts. Please wait.");

    const body = bodySchema.parse(await req.json());

    // Allowed signup domains (university has no student email system — gmail only)
    const env = (await import("@upc/core")).getEnv();
    const domains = env.COLLEGE_EMAIL_DOMAINS.split(",").map((d) => d.trim().toLowerCase());
    const emailDomain = body.email.split("@")[1] ?? "";
    if (!domains.includes(emailDomain)) {
      throw new ApiError("VALIDATION_ERROR", `Sign up with your @${domains.join(" or @")} email`, [
        { field: "email", message: `Email must end with @${domains.join(" or @")}` },
      ]);
    }

    const db = getDb();
    const [existing] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (existing) {
      // A previous signup attempt may have created the account even though the
      // client saw an error (slow network, lost response) — if the password
      // matches, this is the owner: continue straight into the account instead
      // of dead-ending them on "already exists".
      if (existing.passwordHash && (await verifyPassword(body.password, existing.passwordHash))) {
        if (!existing.isActive) throw new ApiError("FORBIDDEN", "Account disabled. Contact the administrator.");
        const tokens = await createSession(existing.id, { ipAddress: ip });
        await setRefreshCookie(tokens.refreshToken);
        return ok({
          user_id: existing.id,
          email: existing.email,
          display_name: existing.displayName,
          user_type: existing.userType,
          is_verified: existing.isVerified,
          access_token: tokens.accessToken,
          token_type: "Bearer",
          expires_in: tokens.expiresIn,
          already_registered: true,
          message: "Welcome back — this account already exists, so we signed you in.",
        });
      }
      throw new ApiError(
        "EMAIL_ALREADY_EXISTS",
        "An account with this email already exists. Try signing in instead — or use a different email.",
      );
    }

    const [user] = await db
      .insert(users)
      .values({
        email: body.email,
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName,
        userType: body.userType,
      })
      .returning({ id: users.id, email: users.email, displayName: users.displayName, userType: users.userType });

    // Side tables + default student role
    await db.insert(userPreferences).values({ userId: user!.id });
    if (body.userType === "student") {
      await db.insert(students).values({ userId: user!.id });
    }
    const [studentRole] = await db.select().from(roles).where(eq(roles.roleName, "student")).limit(1);
    if (studentRole) {
      await db.insert(userRoles).values({ userId: user!.id, roleId: studentRole.id });
    }

    // Send verification OTP
    const otp = await issueOtp(user!.email, "email_verify");

    // Session starts immediately (verification encouraged, not blocking)
    const tokens = await createSession(user!.id, { ipAddress: ip });
    await setRefreshCookie(tokens.refreshToken);

    return ok(
      {
        user_id: user!.id,
        email: user!.email,
        display_name: user!.displayName,
        user_type: user!.userType,
        is_verified: false,
        access_token: tokens.accessToken,
        token_type: "Bearer",
        expires_in: tokens.expiresIn,
        message: "Verification email sent",
        ...(otp.devCode ? { dev_otp: otp.devCode } : {}),
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
