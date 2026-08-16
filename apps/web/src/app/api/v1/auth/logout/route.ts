import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userSessions } from "@upc/db";
import { getEnv } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { clearRefreshCookie } from "@/lib/auth/session";

/** POST /v1/auth/logout — revoke current session, clear cookie. */
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (auth) {
      try {
        const claims = await verifyAccessToken(auth);
        const db = getDb();
        await db
          .update(userSessions)
          .set({ isActive: false, revokedAt: new Date(), revokedReason: "logout" })
          .where(eq(userSessions.id, claims.session_id));
      } catch {
        // Token already invalid — still clear the cookie.
      }
    }
    await clearRefreshCookie();
    return ok({ message: "Logged out successfully" });
  } catch (err) {
    return fail(err);
  }
}
