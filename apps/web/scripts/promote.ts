/**
 * Promote / demote a user's role (e.g. designate an approver for document review).
 * Usage: pnpm promote -- --email someone@gmail.com --role approver
 *        pnpm promote -- --email someone@gmail.com --role approver --remove   (revoke)
 *        pnpm promote -- --email someone@gmail.com --deactivate             (block login)
 *        pnpm promote -- --email someone@gmail.com --activate               (unblock login)
 * Roles: super_admin, knowledge_admin, approver, editor, contributor, faculty, student
 * NOTE: the role lands in the access token at next login — the user must
 * log out and back in for it to take effect.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { and, eq } from "drizzle-orm";
import { createDb, users, userRoles, roles, auditLogs } from "@upc/db";

const VALID_ROLES = ["super_admin", "knowledge_admin", "approver", "editor", "contributor", "faculty", "student"];

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const email = get("--email")?.toLowerCase();
  const roleName = get("--role") ?? "approver";
  const remove = args.includes("--remove");
  const deactivate = args.includes("--deactivate");
  const activate = args.includes("--activate");
  if (!email) throw new Error("--email is required (e.g. --email someone@gmail.com)");

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = createDb(process.env.DATABASE_URL);

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`No user with email ${email}`);

  if (deactivate || activate) {
    await db.update(users).set({ isActive: activate }).where(eq(users.id, user.id));
    await db.insert(auditLogs).values({
      actorId: user.id,
      action: activate ? "user_activated" : "user_deactivated",
      resourceType: "user",
      resourceId: user.id,
      changeSummary: `${activate ? "Activated" : "Deactivated"} ${email} via CLI`,
    });
    console.log(`✓ ${activate ? "Activated" : "Deactivated"} ${email}`);
    process.exit(0);
  }

  if (!VALID_ROLES.includes(roleName)) throw new Error(`Unknown role "${roleName}". Valid: ${VALID_ROLES.join(", ")}`);

  const [role] = await db.select().from(roles).where(eq(roles.roleName, roleName)).limit(1);
  if (!role) throw new Error(`Role "${roleName}" missing from the roles table — run pnpm seed:admin first`);

  const [existing] = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.roleId, role.id)))
    .limit(1);
  if (remove) {
    if (existing) {
      await db.delete(userRoles).where(eq(userRoles.id, existing.id));
      console.log(`✓ Revoked role "${roleName}" from ${email}`);
    } else {
      console.log(`• ${email} doesn't hold role "${roleName}"`);
    }
  } else if (existing) {
    if (!existing.isActive) {
      await db.update(userRoles).set({ isActive: true }).where(eq(userRoles.id, existing.id));
      console.log(`✓ Re-activated role "${roleName}" for ${email}`);
    } else {
      console.log(`• ${email} already has role "${roleName}"`);
    }
  } else {
    await db.insert(userRoles).values({ userId: user.id, roleId: role.id });
    console.log(`✓ Granted role "${roleName}" to ${email}`);
  }
  console.log("  (the user must log out and log back in for the role to take effect)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
