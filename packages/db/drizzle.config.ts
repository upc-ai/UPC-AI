import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

/**
 * DATABASE_URL resolution: real env var first, then apps/web/.env.local
 * (the single source of truth for local dev), then the localhost fallback.
 */
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const line = readFileSync(new URL("../../apps/web/.env.local", import.meta.url), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("DATABASE_URL="));
    if (line) return line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
  } catch {
    /* no .env.local — use fallback */
  }
  return "postgres://postgres:postgres@localhost:5432/upcai";
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl(),
  },
  verbose: true,
  strict: true,
});
