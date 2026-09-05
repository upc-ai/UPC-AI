import { NextRequest } from "next/server";
import { ApiError } from "@upc/core";
import { verifyAccessToken, type AccessTokenClaims } from "./tokens";

/** Roles allowed to upload/process documents in the knowledge base. */
const STAFF_ROLES = ["approver", "knowledge_admin", "super_admin"] as const;
/** Roles allowed to publish/reject documents (the review gate). */
const APPROVER_ROLES = ["approver", "knowledge_admin", "super_admin"] as const;
/** The full admin panel (/admin) — the operator's control plane. */
const PANEL_ROLES = ["super_admin"] as const;

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

/**
 * True when the claims may upload/process knowledge-base documents.
 * ROLE-ONLY by design (2026-09-02, user directive): user_type faculty/admin is
 * deliberately NOT honored — anyone can pick "faculty" at signup, so type
 * alone must never gate the knowledge pipeline. Grant the role explicitly
 * (pnpm promote) to the people who should manage documents.
 */
export function canManageDocuments(claims: AccessTokenClaims): boolean {
  return claims.roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
}

/** True when the claims may publish/reject documents. */
export function canReviewDocuments(claims: AccessTokenClaims): boolean {
  return claims.roles.some((r) => (APPROVER_ROLES as readonly string[]).includes(r));
}

/** True when the claims may enter the admin panel (/admin). */
export function canAdminPanel(claims: AccessTokenClaims): boolean {
  return claims.roles.some((r) => (PANEL_ROLES as readonly string[]).includes(r));
}
