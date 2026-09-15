import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { getEnv } from "@upc/core";

export const dynamic = "force-dynamic";

/** GET /v1/push/key — the public VAPID key for browser subscriptions. */
export async function GET(_req: NextRequest) {
  const key = getEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY || getEnv().VAPID_PUBLIC_KEY;
  return ok({ publicKey: key || null });
}
