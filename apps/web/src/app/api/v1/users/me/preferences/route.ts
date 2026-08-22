import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { userPreferences } from "@upc/db";
import { STUDY_MODES, LANGUAGES } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  language: z.enum(LANGUAGES).optional(),
  response_length: z.enum(["concise", "detailed", "exhaustive"]).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  default_study_mode: z.enum(STUDY_MODES).optional(),
});

function shape(p: typeof userPreferences.$inferSelect) {
  return {
    theme: p.theme,
    language: p.language,
    response_length: p.responseLength,
    difficulty: p.difficulty,
    default_study_mode: p.defaultStudyMode,
  };
}

/** GET /v1/users/me/preferences */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    const db = getDb();
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, claims.sub))
      .limit(1);
    return ok({ preferences: prefs ? shape(prefs) : null });
  } catch (err) {
    return fail(err);
  }
}

/** PUT /v1/users/me/preferences — partial upsert (missing fields keep their values). */
export async function PUT(req: NextRequest) {
  try {
    const claims = await requireAuth(req);
    const body = bodySchema.parse(await req.json());
    const db = getDb();

    const updates: Partial<typeof userPreferences.$inferInsert> = { updatedAt: new Date() };
    if (body.theme !== undefined) updates.theme = body.theme;
    if (body.language !== undefined) updates.language = body.language;
    if (body.response_length !== undefined) updates.responseLength = body.response_length;
    if (body.difficulty !== undefined) updates.difficulty = body.difficulty;
    if (body.default_study_mode !== undefined) updates.defaultStudyMode = body.default_study_mode;

    const [existing] = await db
      .select({ userId: userPreferences.userId })
      .from(userPreferences)
      .where(eq(userPreferences.userId, claims.sub))
      .limit(1);

    const [saved] = existing
      ? await db.update(userPreferences).set(updates).where(eq(userPreferences.userId, claims.sub)).returning()
      : await db.insert(userPreferences).values({ userId: claims.sub, ...updates }).returning();

    return ok({ preferences: shape(saved!) });
  } catch (err) {
    return fail(err);
  }
}
