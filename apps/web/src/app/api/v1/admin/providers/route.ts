import { NextRequest } from "next/server";
import { z } from "zod";
import { getCustomProviders, managedProviderSchema } from "@upc/core";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth, canAdminPanel } from "@/lib/auth/guard";
import {
  getManagedConfig,
  saveManagedProviders,
  saveDailyQuota,
  managedKeyIsSet,
  type DailyQuota,
} from "@/modules/providers/managed-config";

export const dynamic = "force-dynamic";

/** PUT body: full provider list (replace semantics) + optional quota update. */
const bodySchema = z.object({
  providers: z.array(managedProviderSchema).max(20),
  daily_message_limit: z.number().int().min(0).max(1000).optional(),
});

/**
 * GET /v1/admin/providers — the merged model routing view:
 * managed (panel) providers first, then env AI_CUSTOM_PROVIDERS, then built-ins.
 * Key VALUES are never included — only keyEnv name + set/missing status.
 */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canAdminPanel(claims)) throw new ApiError("FORBIDDEN", "Admin panel access is restricted");

    const managed = await getManagedConfig();

    const managedView = managed.providers.map((p) => ({
      ...p,
      source: "panel" as const,
      keyStatus: managedKeyIsSet(p) ? ("set" as const) : ("missing" as const),
    }));

    const envCustoms = getCustomProviders().map((c) => ({
      name: c.name,
      baseUrl: c.baseUrl,
      model: c.model,
      tier: c.tier,
      source: "env" as const,
      keyStatus: "set" as const, // env customs carry their key inline — they wouldn't load otherwise
      enabled: true,
    }));

    const builtIns = [
      { name: "groq", model: "llama-3.3-70b-versatile", tier: "fast", source: "builtin" as const, keyStatus: (process.env.GROQ_API_KEY ? "set" : "missing") as "set" | "missing", enabled: Boolean(process.env.GROQ_API_KEY) },
      { name: "openai", model: "gpt-4o-mini", tier: "standard", source: "builtin" as const, keyStatus: (process.env.OPENAI_API_KEY ? "set" : "missing") as "set" | "missing", enabled: Boolean(process.env.OPENAI_API_KEY) },
      { name: "anthropic", model: "claude-sonnet-4-20250514", tier: "frontier", source: "builtin" as const, keyStatus: (process.env.ANTHROPIC_API_KEY ? "set" : "missing") as "set" | "missing", enabled: Boolean(process.env.ANTHROPIC_API_KEY) },
    ];

    return ok({
      providers: [...managedView, ...envCustoms, ...builtIns],
      quota: managed.quota,
      keyEnvHints: [
        "GROQ_API_KEY",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "OPENAI_EMBEDDING_KEY",
        "EMBEDDING_API_KEY",
        "GEMINI_API_KEY",
      ],
    });
  } catch (err) {
    return fail(err);
  }
}

/** PUT /v1/admin/providers — replace the managed provider list / update quota. */
export async function PUT(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    if (!canAdminPanel(claims)) throw new ApiError("FORBIDDEN", "Admin panel access is restricted");

    const body = bodySchema.parse(await req.json());
    // Every provider's key must reference an env var that actually holds a key
    // — otherwise chat would silently fall through to the next provider.
    const missingKeys = body.providers.filter((p) => !managedKeyIsSet(p));
    if (missingKeys.length) {
      throw new ApiError("VALIDATION_ERROR", `These providers reference env vars with no key set: ${missingKeys.map((p) => `${p.name} (${p.apiKeyEnv})`).join(", ")}. Add the key in Vercel first.`, missingKeys.map((p) => ({ field: "apiKeyEnv", message: `${p.apiKeyEnv} is not set in the environment` })));
    }

    await saveManagedProviders(body.providers, claims.sub);
    if (body.daily_message_limit !== undefined) {
      const quota: DailyQuota = { daily_message_limit: body.daily_message_limit };
      await saveDailyQuota(quota, claims.sub);
    }

    return ok({ saved: body.providers.length, quota: body.daily_message_limit ?? (await getManagedConfig()).quota });
  } catch (err) {
    return fail(err);
  }
}
