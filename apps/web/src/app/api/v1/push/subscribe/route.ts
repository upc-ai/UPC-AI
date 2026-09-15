import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pushSubscriptions, userPreferences } from "@upc/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/redis";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/** POST /v1/push/subscribe — upsert this device's subscription (auth required). */
export async function POST(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    const rl = await rateLimit(`pushsub:${claims.sub}`, 10, 60);
    if (!rl.allowed) throw new ApiError("RATE_LIMIT_EXCEEDED", "Too many requests. Please wait a moment.");
    const body = bodySchema.parse(await req.json());

    const db = getDb();
    const existing = await db
      .select({ id: pushSubscriptions.id, userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, body.endpoint))
      .limit(1);

    if (existing[0]) {
      if (existing[0].userId !== claims.sub) throw new ApiError("VALIDATION_ERROR", "Endpoint already registered.");
      await db
        .update(pushSubscriptions)
        .set({ p256dh: body.keys.p256dh, auth: body.keys.auth })
        .where(eq(pushSubscriptions.id, existing[0].id));
    } else {
      await db.insert(pushSubscriptions).values({
        userId: claims.sub,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: req.headers.get("user-agent") ?? null,
      });
    }
    await db
      .insert(userPreferences)
      .values({ userId: claims.sub, notificationPush: true })
      .onConflictDoUpdate({ target: userPreferences.userId, set: { notificationPush: true, updatedAt: new Date() } });

    return ok({ subscribed: true });
  } catch (err) {
    return fail(err);
  }
}

/** DELETE /v1/push/subscribe — remove this device's subscription (turn off). */
export async function DELETE(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");
    if (!endpoint) throw new ApiError("VALIDATION_ERROR", "endpoint is required");
    const db = getDb();
    await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, claims.sub)));
    return ok({ subscribed: false });
  } catch (err) {
    return fail(err);
  }
}
