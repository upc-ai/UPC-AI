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
 * If Redis is unreachable (local dev without a Redis server), falls back to an
 * in-process limiter so auth/chat routes still work. The flag lives on
 * globalThis because Next.js dev bundles this module separately per route —
 * a module-level flag would not be shared between them. Production always
 * runs with REDIS_URL set, so the fallback never engages there.
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

function isUnreachable(err: unknown): boolean {
  const e = err as { code?: string; name?: string; message?: string };
  return (
    e?.code === "ECONNREFUSED" ||
    e?.code === "ENOTFOUND" ||
    e?.name === "MaxRetriesPerRequestError" ||
    e?.name === "ConnectionError" ||
    // ioredis throws a plain Error with this message once the client has ended
    (typeof e?.message === "string" && e.message.includes("Connection is closed"))
  );
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const now = Date.now();
  const windowKey = `rate:${key}:${Math.floor(now / (windowSeconds * 1000))}`;

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
      if (!isUnreachable(err)) throw err;
      g.__redisMemoryFallback = true;
      console.warn("[redis] unreachable — using in-memory rate limiter (set REDIS_URL in production)");
    }
  }
  return memoryRateLimit(windowKey, limit, windowSeconds);
}
