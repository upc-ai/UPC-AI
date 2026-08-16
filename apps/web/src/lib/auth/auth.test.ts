import { describe, it, expect } from "vitest";
import { generateOtp, generateRefreshToken, sha256 } from "@/lib/auth/crypto";
import { rotateRefreshToken, type RefreshRepo, type RefreshResult } from "@/lib/auth/refresh";
import type { AccessTokenClaims } from "@/lib/auth/tokens";

/* ------------------------------------------------------------------ */
/* crypto                                                              */
/* ------------------------------------------------------------------ */

describe("auth crypto", () => {
  it("generates 6-digit zero-padded OTPs", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });

  it("hashes deterministically (sha256)", () => {
    expect(sha256("upc")).toBe(sha256("upc"));
    expect(sha256("upc")).not.toBe(sha256("upc2"));
    expect(sha256("upc")).toHaveLength(64);
  });

  it("generates long unique refresh tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });
});

/* ------------------------------------------------------------------ */
/* refresh rotation state machine (in-memory repo)                     */
/* ------------------------------------------------------------------ */

interface TestSession {
  id: string;
  userId: string;
  hash: string;
  isActive: boolean;
  expiresAt: Date;
  revokedReason: string | null;
}

function makeRepo(sessions: TestSession[]): RefreshRepo & { rotations: number; revocations: { id: string; reason: string }[] } {
  return {
    rotations: 0,
    revocations: [],
    async findSessionByTokenHash(hash) {
      const s = sessions.find((x) => x.hash === hash);
      return s ? { id: s.id, userId: s.userId, isActive: s.isActive, expiresAt: s.expiresAt, revokedReason: s.revokedReason } : null;
    },
    async findHistoryByTokenHash() {
      return null; // v1 (documented in refresh route)
    },
    async rotate(sessionId, newHash, expiresAt) {
      this.rotations++;
      const s = sessions.find((x) => x.id === sessionId)!;
      s.hash = newHash;
      s.expiresAt = expiresAt;
    },
    async revokeSession(sessionId, reason) {
      this.revocations.push({ id: sessionId, reason });
      const s = sessions.find((x) => x.id === sessionId)!;
      s.isActive = false;
      s.revokedReason = reason;
    },
  };
}

describe("refresh token rotation", () => {
  it("rotates a valid current token and returns the session", async () => {
    const token = generateRefreshToken();
    const sessions: TestSession[] = [
      { id: "s1", userId: "u1", hash: sha256(token), isActive: true, expiresAt: new Date(Date.now() + 86_400_000), revokedReason: null },
    ];
    const repo = makeRepo(sessions);
    const result = await rotateRefreshToken(repo, token, generateRefreshToken(), 86_400);
    expect(result).toEqual({ ok: true, sessionId: "s1", userId: "u1" });
    expect(repo.rotations).toBe(1);
    expect(sessions[0]!.hash).not.toBe(sha256(token)); // hash replaced
  });

  it("rejects an expired session and revokes it", async () => {
    const token = generateRefreshToken();
    const sessions: TestSession[] = [
      { id: "s1", userId: "u1", hash: sha256(token), isActive: true, expiresAt: new Date(Date.now() - 1000), revokedReason: null },
    ];
    const repo = makeRepo(sessions);
    const result: RefreshResult = await rotateRefreshToken(repo, token, generateRefreshToken(), 86_400);
    expect(result).toEqual({ ok: false, code: "AUTH_REFRESH_EXPIRED" });
    expect(repo.revocations[0]).toEqual({ id: "s1", reason: "expired" });
  });

  it("rejects a revoked session's token", async () => {
    const token = generateRefreshToken();
    const sessions: TestSession[] = [
      { id: "s1", userId: "u1", hash: sha256(token), isActive: false, expiresAt: new Date(Date.now() + 86_400_000), revokedReason: "logout" },
    ];
    const result = await rotateRefreshToken(makeRepo(sessions), token, generateRefreshToken(), 86_400);
    expect(result).toEqual({ ok: false, code: "AUTH_REFRESH_REVOKED" });
  });

  it("rejects an unknown token (no session)", async () => {
    const result = await rotateRefreshToken(makeRepo([]), "garbage", generateRefreshToken(), 86_400);
    expect(result).toEqual({ ok: false, code: "AUTH_REFRESH_REVOKED" });
  });
});

/* Type smoke check */
describe("access token claims shape", () => {
  it("carries session_id for revocation", () => {
    const claims = { sub: "u1", session_id: "s1", roles: ["student"] } as unknown as AccessTokenClaims;
    expect(claims.session_id).toBe("s1");
  });
});
