/**
 * Seed: first Super Admin (MASTER_PLAN §6 week 7 / DB doc v1.1 §11).
 * Usage: pnpm seed:admin -- --email admin@upc.ac.in --name "Admin"
 */
import { config } from "dotenv";
config({ path: ".env.local" }); // app env lives in .env.local, not .env
import { eq } from "drizzle-orm";
import { createDb, users, userPreferences, userRoles, roles, admins } from "@upc/db";
import { hashPassword } from "../src/lib/auth/crypto";

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const email = get("--email")?.toLowerCase() ?? "admin@upc.ac.in";
  const name = get("--name") ?? "Super Admin";
  const password = get("--password") ?? "ChangeMe@2026";

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = createDb(process.env.DATABASE_URL);

  // ensure role rows exist
  for (const [roleName] of [["super_admin"], ["knowledge_admin"], ["approver"], ["editor"], ["contributor"], ["faculty"], ["student"]] as const) {
    await db.insert(roles).values({ roleName, roleType: "system" }).onConflictDoNothing();
  }

  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash: await hashPassword(password),
        displayName: name,
        userType: "admin",
        isVerified: true,
        emailVerifiedAt: new Date(),
      })
      .returning();
    await db.insert(userPreferences).values({ userId: user!.id });
  }
  await db.insert(admins).values({ userId: user!.id, adminLevel: "super_admin", managedScope: "college_wide" }).onConflictDoNothing();

  const [superRole] = await db.select().from(roles).where(eq(roles.roleName, "super_admin")).limit(1);
  if (superRole) {
    await db.insert(userRoles).values({ userId: user!.id, roleId: superRole.id }).onConflictDoNothing();
  }

  console.log(`✓ Super admin ready: ${email} (password: ${password} — change it immediately)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
