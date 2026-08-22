import Redis from "ioredis";
import { getEnv } from "@upc/core";

import { Global } from "@/lib/global";

const g = globalThis as unknown as Global;

/** Redis singleton: rate limits, OTP delivery dedupe, stream buffers. */
export function getRedis(): Redis {
  g.__redis ??= (() => {
    const client = new Redis(getEnv().REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      // Stop reconnecting after a few attempts — the in-memory limiter takes
      // over in dev; prod restarts the process if Redis is truly gone.
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
    });
    client.on("error", (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      // ECONNREFUSED AggregateErrors carry an empty message — skip the blank noise
      if (!g.__redisMemoryFallback && msg) console.warn("[redis]", msg);
    });
    return client;
  })();
  return g.__redis;
}

/**
 * Sliding-window rate limiter (Backend Architecture §7.2).
 * Returns remaining count; 0 means limited.
 *
 * Without REDIS_URL (local dev, or a deployment before Upstash is wired up),
 * this NEVER attempts a connection — the in-process limiter serves directly.
 * If Redis errors at runtime, the same fallback engages (rate limiting is
 * protective, not functional: fail-open beats taking the app down). The flag
 * lives on globalThis because Next bundles this module per route/lambda.
 */
const memoryCounters = new Map<string, number>();

function memoryRateLimit(windowKey: string, limit: number, windowSeconds: number) {
  if (memoryCounters.size > 10_000) memoryCounters.clear(); // dev-only hygiene
  const count = (memoryCounters.get(windowKey) ?? 0) + 1;
  memoryCounters.set(windowKey, count);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: count <= limit ? 0 : windowSeconds,
  };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const now = Date.now();
  const windowKey = `rate:${key}:${Math.floor(now / (windowSeconds * 1000))}`;

  // Not configured → straight to the in-process limiter (no localhost attempt)
  if (!process.env.REDIS_URL) g.__redisMemoryFallback = true;

  if (!g.__redisMemoryFallback) {
    try {
      const redis = getRedis();
      const count = await redis.incr(windowKey);
      if (count === 1) await redis.expire(windowKey, windowSeconds);
      const remaining = Math.max(0, limit - count);
      return {
        allowed: count <= limit,
        remaining,
        retryAfterSeconds: count <= limit ? 0 : windowSeconds,
      };
    } catch (err) {
      // Any Redis failure (serverless cold-connect races included) degrades to
      // the in-memory limiter rather than failing the request.
      g.__redisMemoryFallback = true;
      console.warn("[redis] unavailable — using in-memory rate limiter:", err instanceof Error ? err.message : err);
    }
  }
  return memoryRateLimit(windowKey, limit, windowSeconds);
}
