/** One-time: create push_subscriptions table directly (drizzle push chokes on unrelated ALTERs). */
import { readFileSync } from "node:fs";
import postgres from "postgres";

const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const line = envRaw.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
const sql = postgres(line.slice("DATABASE_URL=".length).trim(), { prepare: false, max: 1 });

await sql`
  CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "endpoint" text NOT NULL,
    "p256dh" text NOT NULL,
    "auth" text NOT NULL,
    "user_agent" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_unique" ON "push_subscriptions" ("endpoint")`;
await sql`CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" ("user_id")`;

const [row] = await sql`SELECT count(*)::int AS n FROM "push_subscriptions"`;
console.log(`✅ push_subscriptions table ready — ${row.n} rows`);
await sql.end();
