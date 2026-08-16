import { NextRequest } from "next/server";
import { ApiError } from "@upc/core";
import { verifyAccessToken, type AccessTokenClaims } from "./tokens";

/** Extract + verify Bearer token. Public paths use their own endpoints. */
export async function requireAuth(req: NextRequest): Promise<AccessTokenClaims> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError("AUTH_TOKEN_MISSING", "Missing access token");
  }
  try {
    return await verifyAccessToken(header.slice(7));
  } catch (err) {
    const expired = err instanceof Error && "code" in err && (err as { code: string }).code === "ERR_JWT_EXPIRED";
    throw new ApiError(
      expired ? "AUTH_TOKEN_EXPIRED" : "AUTH_TOKEN_INVALID",
      expired ? "Access token expired" : "Invalid access token",
    );
  }
}
