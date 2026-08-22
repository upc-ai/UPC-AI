import { NextRequest } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { chatSessions } from "@upc/db";
import { STUDY_MODES, LANGUAGES } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().max(200).optional(),
  session_type: z.enum(["academic", "knowledge", "general", "mixed"]).optional(),
  study_mode: z.enum(STUDY_MODES).optional(),
  language_preference: z.enum(LANGUAGES).optional(),
});

/** POST /v1/chat/sessions — create. */
export async function POST(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const db = getDb();
    const [session] = await db
      .insert(chatSessions)
      .values({
        userId: claims.sub,
        title: body.title ?? null,
        sessionType: body.session_type ?? "general",
        studyMode: body.study_mode ?? "learn",
        languagePreference: body.language_preference ?? "en",
      })
      .returning();
    return ok(session, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}

/** GET /v1/chat/sessions — list (offset pagination, 20/page). */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    const db = getDb();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    const rows = await db
      .select({
        id: chatSessions.id,
        title: chatSessions.title,
        sessionType: chatSessions.sessionType,
        studyMode: chatSessions.studyMode,
        lastMessageAt: chatSessions.lastMessageAt,
        messageCount: chatSessions.messageCount,
        isPinned: chatSessions.isPinned,
        isArchived: chatSessions.isArchived,
        createdAt: chatSessions.createdAt,
      })
      .from(chatSessions)
      .where(
        and(eq(chatSessions.userId, claims.sub), eq(chatSessions.isArchived, false), isNull(chatSessions.deletedAt)),
      )
      .orderBy(desc(chatSessions.isPinned), desc(chatSessions.lastMessageAt), desc(chatSessions.createdAt))
      .limit(limit)
      .offset(offset);

    return ok({
      sessions: rows,
      has_more: rows.length === limit,
    });
  } catch (err) {
    return fail(err);
  }
}
