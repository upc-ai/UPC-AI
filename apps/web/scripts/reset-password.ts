/**
 * Reset any account's password directly (admin rescue — no email needed).
 * Usage: pnpm reset-password -- --email someone@gmail.com --password "NewPass@123"
 * Enforces the same password policy as signup. Revokes ALL sessions.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { eq } from "drizzle-orm";
import { createDb, users, userSessions } from "@upc/db";
import { hashPassword } from "../src/lib/auth/crypto";
import { strongPasswordSchema } from "@upc/core";

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const email = get("--email")?.toLowerCase();
  const password = get("--password");
  if (!email || !password) throw new Error("Usage: pnpm reset-password -- --email <email> --password <new-password>");

  const check = strongPasswordSchema.safeParse(password);
  if (!check.success) {
    throw new Error(`Password too weak: ${check.error.issues[0]?.message}`);
  }

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = createDb(process.env.DATABASE_URL);

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`No user with email ${email}`);

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(users.id, user.id));
  // Kill every refresh session — old tokens must not survive a reset
  await db
    .update(userSessions)
    .set({ isActive: false, revokedAt: new Date(), revokedReason: "password_reset_cli" })
    .where(eq(userSessions.userId, user.id));

  console.log(`✓ Password reset for ${email} — all sessions revoked. Log in with the new password.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
