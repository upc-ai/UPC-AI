import { getEnv, OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS, ApiError, type OtpPurpose } from "@upc/core";
import { generateOtp, sha256 } from "./crypto";
import { getDb } from "@/lib/db";
import { otpRecords } from "@upc/db";
import { and, desc, eq } from "drizzle-orm";
import { sendMail, otpEmail } from "@/lib/mailer";

export interface OtpSendResult {
  expiresInSeconds: number;
  /** Dev convenience only (MAIL_PROVIDER=console): the code is logged server-side. */
  devCode?: string;
}

/** Create + persist a hashed OTP, invalidate previous ones for the same purpose. */
export async function issueOtp(email: string, purpose: OtpPurpose): Promise<OtpSendResult> {
  const db = getDb();
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await db.insert(otpRecords).values({
    email: email.toLowerCase(),
    otpHash: sha256(code),
    purpose,
    expiresAt,
  });

  const env = getEnv();
  if (env.MAIL_PROVIDER === "resend" && env.RESEND_API_KEY) {
    // Real delivery — the code NEVER returns to the API caller in this mode.
    await sendMail({ ...otpEmail(code, purpose), to: email });
    return { expiresInSeconds: OTP_TTL_SECONDS };
  }
  // Dev convenience only (MAIL_PROVIDER=console): the code is logged server-side
  // and pages may surface it locally. Never shown for password_reset.
  console.info(`[otp] ${purpose} code for ${email}: ${code} (valid 10 min)`);
  return { expiresInSeconds: OTP_TTL_SECONDS, devCode: purpose === "password_reset" ? undefined : code };
}

/** Verify an OTP: single-use, attempt-capped, expiring. */
export async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<void> {
  const db = getDb();
  const [record] = await db
    .select()
    .from(otpRecords)
    .where(and(eq(otpRecords.email, email.toLowerCase()), eq(otpRecords.purpose, purpose)))
    .orderBy(desc(otpRecords.createdAt))
    .limit(1);

  if (!record) throw new ApiError("AUTH_OTP_INVALID", "Invalid or expired code");
  if (record.isUsed) throw new ApiError("AUTH_OTP_INVALID", "Code already used. Request a new one.");
  if (record.expiresAt.getTime() < Date.now()) throw new ApiError("AUTH_OTP_INVALID", "Code expired. Request a new one.");
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ApiError("AUTH_OTP_LOCKED", "Too many attempts. Please request a new code.");
  }

  if (record.otpHash !== sha256(code)) {
    const attempts = record.attempts + 1;
    await db.update(otpRecords).set({ attempts }).where(eq(otpRecords.id, record.id));
    if (attempts >= OTP_MAX_ATTEMPTS) {
      throw new ApiError("AUTH_OTP_LOCKED", "Too many attempts. Please request a new code.");
    }
    throw new ApiError("AUTH_OTP_INVALID", "Incorrect code");
  }

  await db.update(otpRecords).set({ isUsed: true }).where(eq(otpRecords.id, record.id));
}
