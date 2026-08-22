import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getDb } from "@/lib/db";
import { users, userPreferences, students, userRoles, roles } from "@upc/db";
import { ApiError, getEnv } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { rateLimit } from "@/lib/redis";
import { createSession, setRefreshCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Google's public signing keys — jose caches the JWKS across calls. */
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const bodySchema = z.object({
  credential: z.string().min(20), // Google ID token (JWT) from Google Identity Services
});

/**
 * POST /v1/auth/login/google — Google Identity Services sign-in.
 * The client sends Google's signed ID token; we verify it against Google's
 * JWKS, then find-or-create the account. Email is trusted because Google
 * verified it (email_verified claim) — no college-domain check on this path.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const rl = await rateLimit(`google:${ip}`, 10, 60);
    if (!rl.allowed) throw new ApiError("RATE_LIMIT_EXCEEDED", "Too many attempts. Please wait.");

    const env = getEnv();
    if (!env.GOOGLE_CLIENT_ID) {
      throw new ApiError("INTERNAL_ERROR", "Google sign-in is not configured");
    }

    const body = bodySchema.parse(await req.json());

    const { payload } = await jwtVerify(body.credential, googleJwks, {
      issuer: ["accounts.google.com", "https://accounts.google.com"],
      audience: env.GOOGLE_CLIENT_ID,
    });

    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    const googleName = typeof payload.name === "string" ? payload.name : "";
    if (!email) throw new ApiError("AUTH_TOKEN_INVALID", "Google account has no email");
    if (payload.email_verified !== true) {
      throw new ApiError("EMAIL_NOT_VERIFIED", "Google account email is not verified");
    }
    // Gmail only — blocks disposable/Workspace-domain emails; every student has gmail
    if (email.split("@")[1] !== "gmail.com") {
      throw new ApiError("VALIDATION_ERROR", "Please sign in with your @gmail.com Google account");
    }

    const db = getDb();
    let [user] = await db
      .select({ id: users.id, email: users.email, displayName: users.displayName, userType: users.userType })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          email,
          passwordHash: null, // OAuth-only account
          displayName: googleName || email.split("@")[0]!,
          userType: "student",
          isVerified: true, // Google already verified the email
        })
        .returning({ id: users.id, email: users.email, displayName: users.displayName, userType: users.userType });

      await db.insert(userPreferences).values({ userId: user!.id });
      await db.insert(students).values({ userId: user!.id });
      const [studentRole] = await db.select().from(roles).where(eq(roles.roleName, "student")).limit(1);
      if (studentRole) {
        await db.insert(userRoles).values({ userId: user!.id, roleId: studentRole.id });
      }
    } else if (user.displayName.startsWith("local-") || !user.displayName) {
      await db.update(users).set({ displayName: googleName || user.displayName }).where(eq(users.id, user.id));
    }

    const tokens = await createSession(user!.id, { ipAddress: ip });
    await setRefreshCookie(tokens.refreshToken);

    return ok({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      user: {
        user_id: user!.id,
        email: user!.email,
        display_name: user!.displayName,
        user_type: user!.userType,
        is_verified: true,
      },
    });
  } catch (err) {
    return fail(err);
  }
}
