import { createDb } from "@upc/db";
import { getEnv } from "@upc/core";

import { Global } from "@/lib/global";

const g = globalThis as unknown as Global;

/** Postgres/Drizzle singleton (survives HMR in dev). */
export function getDb() {
  g.__db ??= createDb(getEnv().DATABASE_URL);
  return g.__db;
}
