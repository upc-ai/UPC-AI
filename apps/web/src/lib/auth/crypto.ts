import { createHash, randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** SHA-256 hex — for refresh tokens and OTPs (never store plaintext). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** 256-bit opaque refresh token. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** 6-digit numeric OTP from CSPRNG. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
