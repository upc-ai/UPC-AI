import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { chatSessions, feedback, messages } from "@upc/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message_id: z.string().uuid(),
  feedback_type: z.enum(["thumbs_up", "thumbs_down"]),
  category: z.string().max(50).optional(),
  comment: z.string().max(2000).optional(),
});

/** POST /v1/feedback — 👍/👎 on an assistant message (MASTER_PLAN §2: feedback). */
export async function POST(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    const body = bodySchema.parse(await req.json());
    const db = getDb();

    // Message must exist, be live, and belong to one of the caller's sessions
    const [msg] = await db
      .select({ id: messages.id })
      .from(messages)
      .innerJoin(
        chatSessions,
        and(eq(chatSessions.id, messages.sessionId), eq(chatSessions.userId, claims.sub)),
      )
      .where(and(eq(messages.id, body.message_id), isNull(messages.deletedAt)))
      .limit(1);
    if (!msg) throw new ApiError("RESOURCE_NOT_FOUND", "Message not found");

    const [row] = await db
      .insert(feedback)
      .values({
        userId: claims.sub,
        messageId: body.message_id,
        feedbackType: body.feedback_type,
        category: body.category ?? null,
        comment: body.comment ?? null,
      })
      .returning({ id: feedback.id });
    return ok(row, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
