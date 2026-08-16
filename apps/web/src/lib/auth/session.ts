import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userSessions, userRoles, roles, users } from "@upc/db";
import { getEnv } from "@upc/core";
import { generateRefreshToken, sha256 } from "./crypto";
import { signAccessToken, type AccessTokenClaims } from "./tokens";

const REFRESH_COOKIE = "upcai_refresh";

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Create a new session family + issue a token pair. */
export async function createSession(
  userId: string,
  meta: { deviceInfo?: unknown; ipAddress?: string },
): Promise<SessionTokens> {
  const db = getDb();
  const env = getEnv();
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000);

  const [session] = await db
    .insert(userSessions)
    .values({
      userId,
      refreshTokenHash: sha256(refreshToken),
      deviceInfo: meta.deviceInfo ?? null,
      ipAddress: meta.ipAddress ?? null,
      expiresAt,
    })
    .returning({ id: userSessions.id });

  const accessToken = await mintAccess(userId, session!.id);
  return { accessToken, refreshToken, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS };
}

/** Mint an access token for a user + session. Claims: id, email, type, dept, roles. */
export async function mintAccess(userId: string, sessionId: string): Promise<string> {
  const db = getDb();

  const [user] = await db
    .select({ email: users.email, userType: users.userType, departmentId: users.departmentId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const roleRows = await db
    .select({ roleName: roles.roleName })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)));

  if (!user) throw new Error("User not found while minting access token");

  const claims: Omit<AccessTokenClaims, "iat" | "exp" | "iss" | "aud"> = {
    sub: userId,
    email: user.email,
    user_type: user.userType,
    department_id: user.departmentId,
    roles: roleRows.map((r) => r.roleName),
    session_id: sessionId,
  };
  return signAccessToken(claims);
}

/** Set the rotating refresh cookie (httpOnly, Secure, SameSite=Strict). */
export async function setRefreshCookie(token: string) {
  const env = getEnv();
  const jar = await cookies();
  jar.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS,
  });
}

export async function clearRefreshCookie() {
  const jar = await cookies();
  jar.delete(REFRESH_COOKIE);
}

export async function readRefreshCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? null;
}

export { REFRESH_COOKIE };
