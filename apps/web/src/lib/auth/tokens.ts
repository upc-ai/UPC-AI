import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getEnv, type UserType } from "@upc/core";

export interface AccessTokenClaims extends JWTPayload {
  sub: string; // user_id
  email: string;
  user_type: UserType;
  department_id: string | null;
  roles: string[];
  session_id: string; // server-side session (revocation handle)
}

/** Sign a 15-minute RS256 access token. Private key never leaves the auth module. */
export async function signAccessToken(claims: Omit<AccessTokenClaims, "iat" | "exp" | "iss" | "aud">) {
  const env = getEnv();
  const key = new TextEncoder().encode(env.JWT_PRIVATE_KEY.replace(/\\n/g, "\n"));
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + env.ACCESS_TOKEN_TTL_SECONDS)
    .setIssuer("upcai-auth")
    .setAudience("upcai-api")
    .sign(key);
}

/** Verify an access token. Throws on invalid/expired. Public key only — edge-safe. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const env = getEnv();
  const key = new TextEncoder().encode(env.JWT_PUBLIC_KEY.replace(/\\n/g, "\n"));
  const { payload } = await jwtVerify(token, key, {
    issuer: "upcai-auth",
    audience: "upcai-api",
  });
  return payload as AccessTokenClaims;
}
