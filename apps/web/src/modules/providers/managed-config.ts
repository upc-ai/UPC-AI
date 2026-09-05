/**
 * Managed platform configuration — DB-backed (system_settings) provider and
 * quota config for the admin panel. Lives in app scope, not packages, because
 * it needs the web getDb() singleton.
 *
 * Security model (user decision 2026-09-02): API keys NEVER touch the DB.
 * A managed provider names the env var holding its key (apiKeyEnv); the
 * gateway resolves process.env[apiKeyEnv] at call time. The panel shows only
 * "key set / missing" status. Every change is written to audit_logs.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { systemSettings, auditLogs } from "@upc/db";
import {
  managedProviderSchema,
  type ManagedProviderConfig,
} from "@upc/core";

const PROVIDERS_KEY = "ai.managed_providers";
const QUOTA_KEY = "chat.daily_message_limit";
const CACHE_TTL_MS = 15_000; // short — admin edits take effect within seconds

export interface DailyQuota {
  /** Messages per user per day on UPC-1 / UPC-1 Plus. UPC-1 Pro is unrestricted. */
  daily_message_limit: number;
}

const DEFAULT_QUOTA: DailyQuota = { daily_message_limit: 20 };

export interface ManagedConfig {
  providers: ManagedProviderConfig[];
  quota: DailyQuota;
}

/** In-process cache — every route bundle gets one; TTL keeps chat reads cheap. */
const g = globalThis as unknown as {
  __managedConfigCache?: { data: ManagedConfig; at: number };
};

export async function getManagedConfig(): Promise<ManagedConfig> {
  const cached = g.__managedConfigCache;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const db = getDb();
  const rows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.category, "ai"));

  let providers: ManagedProviderConfig[] = [];
  let quota = DEFAULT_QUOTA;

  for (const row of rows) {
    if (row.settingKey === PROVIDERS_KEY && Array.isArray(row.value)) {
      // Invalid entries are skipped like env customs — one bad row must not break chat
      const parsed: ManagedProviderConfig[] = [];
      for (const entry of row.value) {
        const r = managedProviderSchema.safeParse(entry);
        if (r.success) parsed.push(r.data);
        else console.warn(`[managed-config] skipping provider entry: ${r.error.issues[0]?.message}`);
      }
      providers = parsed;
    } else if (row.settingKey === QUOTA_KEY) {
      const q = row.value as Partial<DailyQuota>;
      const limit = Number(q?.daily_message_limit);
      if (Number.isFinite(limit) && limit >= 0) quota = { daily_message_limit: Math.floor(limit) };
    }
  }

  const data = { providers, quota };
  g.__managedConfigCache = { data, at: Date.now() };
  return data;
}

/** True when the env var a managed provider depends on actually holds a key. */
export function managedKeyIsSet(p: ManagedProviderConfig): boolean {
  return Boolean(process.env[p.apiKeyEnv]?.trim());
}

export async function saveManagedProviders(
  providers: ManagedProviderConfig[],
  actorId: string,
): Promise<void> {
  const db = getDb();
  await db
    .insert(systemSettings)
    .values({
      settingKey: PROVIDERS_KEY,
      value: providers,
      category: "ai",
      isSensitive: false, // specs only — no key values stored (by design)
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.settingKey,
      set: { value: providers, updatedBy: actorId, updatedAt: new Date() },
    });

  await db.insert(auditLogs).values({
    actorId,
    action: "settings_update",
    resourceType: "setting",
    // resourceId is a UUID column — setting KEYS are strings, so they live in
    // the summary only (passing the key here 500s with 22P02 invalid uuid).
    changeSummary: `Providers & Models (${PROVIDERS_KEY}) updated — ${providers.length} provider${providers.length === 1 ? "" : "s"}`,
  });

  g.__managedConfigCache = undefined; // immediate effect
}

export async function saveDailyQuota(quota: DailyQuota, actorId: string): Promise<void> {
  const db = getDb();
  await db
    .insert(systemSettings)
    .values({
      settingKey: QUOTA_KEY,
      value: quota,
      category: "ai",
      isSensitive: false,
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.settingKey,
      set: { value: quota, updatedBy: actorId, updatedAt: new Date() },
    });

  await db.insert(auditLogs).values({
    actorId,
    action: "settings_update",
    resourceType: "setting",
    // resourceId is a UUID column — keep the string key in the summary only.
    changeSummary: `Daily message limit (${QUOTA_KEY}) set to ${quota.daily_message_limit}`,
  });

  g.__managedConfigCache = undefined;
}

export { PROVIDERS_KEY, QUOTA_KEY };
