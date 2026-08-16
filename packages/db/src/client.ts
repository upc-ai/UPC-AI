import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Single Drizzle client factory for app + worker.
 * Pooling is delegated to the driver; in production, point DATABASE_URL at
 * the pooled connector (Neon pooler / Supavisor).
 */
export function createDb(connectionString: string) {
  const sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // compatible with transaction-mode poolers
  });
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;
export { schema };
