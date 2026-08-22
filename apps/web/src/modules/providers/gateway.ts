/**
 * Provider Gateway (Architecture §5) — the ONLY place vendor SDKs are imported.
 * Internal contract: streamGenerate(...) → normalized async iterator of tokens.
 * Failover: ordered provider chain; circuit skipping on error.
 */
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import type { CoreMessage } from "ai";
import { getEnv, getCustomProviders, type ModelTier } from "@upc/core";

export type { ModelTier };

interface ProviderConfig {
  name: string;
  tier: ModelTier;
  enabled: () => boolean;
  client: () => ReturnType<typeof createOpenAI | typeof createAnthropic | typeof createGroq>;
  model: string;
  costPerMTokIn: number; // USD
  costPerMTokOut: number; // USD
}

/** Pricing (USD / 1M tokens) — approximate, used for cost dashboards only. */
function providers(): ProviderConfig[] {
  const env = getEnv();

  // Bring-your-own OpenAI-compatible providers (Kimi, GLM, Qwen, Gemini-compat,
  // DeepSeek, OpenRouter, Ollama, …) — any endpoint speaking the OpenAI wire format.
  const customs: ProviderConfig[] = getCustomProviders().map((c) => ({
    name: c.name,
    tier: c.tier,
    enabled: () => true,
    client: () => createOpenAI({ baseURL: c.baseUrl, apiKey: c.apiKey }),
    model: c.model,
    costPerMTokIn: c.costPerMTokIn,
    costPerMTokOut: c.costPerMTokOut,
  }));

  const builtIns: ProviderConfig[] = [
    {
      name: "groq",
      tier: "fast",
      enabled: () => Boolean(env.GROQ_API_KEY),
      client: () => createGroq({ apiKey: env.GROQ_API_KEY }),
      model: "llama-3.3-70b-versatile",
      costPerMTokIn: 0.59,
      costPerMTokOut: 0.79,
    },
    {
      name: "openai",
      tier: "standard",
      enabled: () => Boolean(env.OPENAI_API_KEY),
      client: () => createOpenAI({ apiKey: env.OPENAI_API_KEY }),
      model: "gpt-4o-mini",
      costPerMTokIn: 0.15,
      costPerMTokOut: 0.6,
    },
    {
      name: "anthropic",
      tier: "frontier",
      enabled: () => Boolean(env.ANTHROPIC_API_KEY),
      client: () => createAnthropic({ apiKey: env.ANTHROPIC_API_KEY }),
      model: "claude-sonnet-4-20250514",
      costPerMTokIn: 3,
      costPerMTokOut: 15,
    },
  ];

  // Customs first within each tier: an explicitly added provider is the one
  // the operator wants serving traffic; built-ins stay as failover.
  return [...customs, ...builtIns.filter((p) => p.enabled())];
}

export interface GenerateOptions {
  messages: CoreMessage[];
  tier: ModelTier;
  maxTokens?: number;
  temperature?: number;
}

export type StreamEvent =
  | { type: "token"; text: string }
  | { type: "done"; provider: string; model: string; tokensIn: number; tokensOut: number; costUsd: number; finishReason: string }
  | { type: "error"; code: string; message: string; retrying: boolean };

/** Ordered failover chain for a tier: exact tier first, then the rest. */
export function chainFor(tier: ModelTier): ProviderConfig[] {
  const list = providers();
  const preferred = list.filter((p) => p.tier === tier);
  const rest = list.filter((p) => p.tier !== tier);
  return [...preferred, ...rest];
}

/** Stream with failover. Yields normalized events; retries the chain on failure. */
export async function* streamGenerate(opts: GenerateOptions): AsyncGenerator<StreamEvent> {
  const chain = chainFor(opts.tier);
  if (chain.length === 0) {
    yield { type: "error", code: "AI_PROVIDER_UNAVAILABLE", message: "No AI provider configured", retrying: false };
    return;
  }

  for (let i = 0; i < chain.length; i++) {
    const p = chain[i]!;
    try {
      const result = await streamText({
        model: p.client()(p.model),
        messages: opts.messages,
        // 4096 not 2048: thinking models (Gemini -latest) share this budget
        // between reasoning and visible text — 2048 could starve the answer.
        maxTokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.4,
      });

      let tokensOut = 0;
      for await (const delta of result.textStream) {
        tokensOut += Math.ceil(delta.length / 4);
        yield { type: "token", text: delta };
      }

      const usage = await result.usage;
      // Some OpenAI-compatible providers omit/NaN usage — never persist NaN (Postgres rejects it)
      const safeInt = (n: number | undefined | null) => (Number.isFinite(n as number) ? (n as number) : 0);
      const tokensIn = safeInt(usage?.promptTokens);
      const tokensOutFinal = safeInt(usage?.completionTokens) || tokensOut;
      const cost =
        (tokensIn / 1e6) * p.costPerMTokIn + (tokensOutFinal / 1e6) * p.costPerMTokOut;

      yield {
        type: "done",
        provider: p.name,
        model: p.model,
        tokensIn,
        tokensOut: tokensOutFinal,
        costUsd: Number.isFinite(cost) ? Number(cost.toFixed(6)) : 0,
        finishReason: "stop",
      };
      return;
    } catch (err) {
      const isLast = i === chain.length - 1;
      // Provider detail stays in server logs only — the yielded message goes
      // to the student and must never name the provider or model (identity policy).
      console.error(`[gateway] ${p.name} failed:`, err instanceof Error ? err.message : err);
      yield {
        type: "error",
        code: "AI_PROVIDER_ERROR",
        message: "UPC AI is temporarily experiencing high demand. Please try again shortly.",
        retrying: !isLast,
      };
      if (isLast) return;
    }
  }
}
