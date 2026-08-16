/**
 * Refresh-token rotation state machine (Architecture §6.3, Backend §7.1).
 * Pure logic over a repository interface — unit-testable without a database.
 *
 * Rules:
 * - Each session (family) stores the hash of the CURRENT refresh token only.
 * - On refresh: token matches current hash → rotate (new token hash stored).
 * - Reuse of a superseded token → the whole family is revoked (theft signal).
 * - Reuse of a revoked/inactive session's token → AUTH_REFRESH_REVOKED.
 */

export interface RefreshRepo {
  findSessionByTokenHash(hash: string): Promise<
    | {
        id: string;
        userId: string;
        isActive: boolean;
        expiresAt: Date;
        revokedReason: string | null;
      }
    | null
  >;
  /** Look up a session family that ONCE held this hash (superseded token detection). */
  findHistoryByTokenHash(hash: string): Promise<
    | {
        id: string;
        userId: string;
        isActive: boolean;
        revokedReason: string | null;
      }
    | null
  >;
  rotate(sessionId: string, newHash: string, expiresAt: Date): Promise<void>;
  revokeSession(sessionId: string, reason: string): Promise<void>;
}

export type RefreshResult =
  | { ok: true; sessionId: string; userId: string }
  | { ok: false; code: "AUTH_REFRESH_EXPIRED" | "AUTH_REFRESH_REVOKED" | "AUTH_REFRESH_REUSED" };

export async function rotateRefreshToken(
  repo: RefreshRepo,
  presentedToken: string,
  newToken: string,
  ttlSeconds: number,
): Promise<RefreshResult> {
  const hash = await sha256Hex(presentedToken);

  const session = await repo.findSessionByTokenHash(hash);
  if (session) {
    if (!session.isActive) {
      return { ok: false, code: "AUTH_REFRESH_REVOKED" };
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await repo.revokeSession(session.id, "expired");
      return { ok: false, code: "AUTH_REFRESH_EXPIRED" };
    }
    // Valid current token → rotate.
    await repo.rotate(session.id, await sha256Hex(newToken), new Date(Date.now() + ttlSeconds * 1000));
    return { ok: true, sessionId: session.id, userId: session.userId };
  }

  // Not the current token. If any session ever held this hash → reuse detected → kill family.
  const history = await repo.findHistoryByTokenHash(hash);
  if (history) {
    await repo.revokeSession(history.id, "token_reuse_detected");
    return { ok: false, code: "AUTH_REFRESH_REUSED" };
  }

  return { ok: false, code: "AUTH_REFRESH_REVOKED" };
}

async function sha256Hex(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex");
}
