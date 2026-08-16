import Redis from "ioredis";
import { getEnv } from "@upc/core";

import { Global } from "@/lib/global";

const g = globalThis as unknown as Global;

/** Redis singleton: rate limits, OTP delivery dedupe, stream buffers. */
export function getRedis(): Redis {
  g.__redis ??= new Redis(getEnv().REDIS_URL, {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
  });
  return g.__redis;
}

/**
 * Sliding-window rate limiter (Backend Architecture §7.2).
 * Returns remaining count; 0 means limited.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const redis = getRedis();
  const now = Date.now();
  const windowKey = `rate:${key}:${Math.floor(now / (windowSeconds * 1000))}`;
  const count = await redis.incr(windowKey);
  if (count === 1) await redis.expire(windowKey, windowSeconds);
  const remaining = Math.max(0, limit - count);
  return {
    allowed: count <= limit,
    remaining,
    retryAfterSeconds: count <= limit ? 0 : windowSeconds,
  };
}
