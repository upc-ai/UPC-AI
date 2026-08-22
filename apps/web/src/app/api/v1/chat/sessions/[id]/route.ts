import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { chatSessions } from "@upc/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  is_pinned: z.boolean().optional(),
  is_archived: z.boolean().optional(),
});

/** PATCH /v1/chat/sessions/{id} — rename, pin/unpin, archive/unarchive. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const claims = await requireAuth(req);
    const body = patchSchema.parse(await req.json());
    const db = getDb();

    const [session] = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(
        and(eq(chatSessions.id, params.id), eq(chatSessions.userId, claims.sub), isNull(chatSessions.deletedAt)),
      )
      .limit(1);
    if (!session) throw new ApiError("RESOURCE_NOT_FOUND", "Session not found");

    const updates: Partial<typeof chatSessions.$inferInsert> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.is_pinned !== undefined) updates.isPinned = body.is_pinned;
    if (body.is_archived !== undefined) updates.isArchived = body.is_archived;

    const [updated] = await db
      .update(chatSessions)
      .set(updates)
      .where(eq(chatSessions.id, params.id))
      .returning();
    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}

/** DELETE /v1/chat/sessions/{id} — soft delete (messages cascade via deleted_at filter). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const claims = await requireAuth(req);
    const db = getDb();

    const [session] = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(
        and(eq(chatSessions.id, params.id), eq(chatSessions.userId, claims.sub), isNull(chatSessions.deletedAt)),
      )
      .limit(1);
    if (!session) throw new ApiError("RESOURCE_NOT_FOUND", "Session not found");

    await db.update(chatSessions).set({ deletedAt: new Date() }).where(eq(chatSessions.id, params.id));
    return new Response(null, { status: 204 });
  } catch (err) {
    return fail(err);
  }
}
