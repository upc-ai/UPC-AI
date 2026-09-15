/**
 * Server-side web-push sender. Fire-and-forget by design: notification
 * failures must never break the publish flow. Dead subscriptions (404/410)
 * are self-cleaning. Payloads carry no sensitive content — title + deep link.
 */
import webpush from "web-push";
import { getDb } from "@/lib/db";
import { pushSubscriptions } from "@upc/db";
import { eq } from "drizzle-orm";
import { getEnv } from "@upc/core";

export function pushConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

/** Send { title, body, url } to every subscribed user. Never throws. */
export async function sendPushToAll(payload: { title: string; body: string; url: string }): Promise<void> {
  try {
    if (!pushConfigured()) return;
    const env = getEnv();
    webpush.setVapidDetails("mailto:hello@upcai.app", env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    const db = getDb();
    const subs = await db.select().from(pushSubscriptions);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint)).catch(() => undefined);
          }
        }
      }),
    );
  } catch (err) {
    console.error("[push] dispatch failed:", err instanceof Error ? err.message : err);
  }
}
