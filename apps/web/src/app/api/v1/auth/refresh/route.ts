import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userSessions } from "@upc/db";
import { ApiError, getEnv } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { generateRefreshToken } from "@/lib/auth/crypto";
import { rotateRefreshToken, type RefreshRepo } from "@/lib/auth/refresh";
import { readRefreshCookie, setRefreshCookie, clearRefreshCookie, mintAccess } from "@/lib/auth/session";

/** POST /v1/auth/refresh — rotating refresh + reuse detection (Backend §2.1). */
export async function POST(_req: NextRequest) {
  try {
    const presented = await readRefreshCookie();
    if (!presented) throw new ApiError("AUTH_REFRESH_EXPIRED", "No refresh token");

    const db = getDb();
    const repo: RefreshRepo = {
      findSessionByTokenHash: async (hash) => {
        const [s] = await db
          .select({
            id: userSessions.id,
            userId: userSessions.userId,
            isActive: userSessions.isActive,
            expiresAt: userSessions.expiresAt,
            revokedReason: userSessions.revokedReason,
          })
          .from(userSessions)
          .where(eq(userSessions.refreshTokenHash, hash))
          .limit(1);
        return s ?? null;
      },
      // v1: current-hash-only lookup covers reuse because rotation overwrites the hash
      // and revocation marks the session inactive. History table arrives with v1.2 audit store.
      findHistoryByTokenHash: async () => null,
      rotate: async (sessionId, newHash, expiresAt) => {
        await db
          .update(userSessions)
          .set({ refreshTokenHash: newHash, expiresAt, lastActiveAt: new Date() })
          .where(eq(userSessions.id, sessionId));
      },
      revokeSession: async (sessionId, reason) => {
        await db
          .update(userSessions)
          .set({ isActive: false, revokedAt: new Date(), revokedReason: reason })
          .where(eq(userSessions.id, sessionId));
      },
    };

    const newRefresh = generateRefreshToken();
    const result = await rotateRefreshToken(repo, presented, newRefresh, getEnv().REFRESH_TOKEN_TTL_SECONDS);

    if (!result.ok) {
      await clearRefreshCookie();
      throw new ApiError(
        result.code,
        result.code === "AUTH_REFRESH_REUSED"
          ? "Session revoked — token reuse detected"
          : "Please sign in again",
      );
    }

    const accessToken = await mintAccess(result.userId, result.sessionId);
    await setRefreshCookie(newRefresh);

    return ok({ access_token: accessToken, token_type: "Bearer", expires_in: getEnv().ACCESS_TOKEN_TTL_SECONDS });
  } catch (err) {
    return fail(err);
  }
}
