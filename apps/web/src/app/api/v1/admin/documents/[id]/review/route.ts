import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, auditLogs } from "@upc/db";
import { ApiError } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "publish"]),
  notes: z.string().max(2000).optional(),
});

function requireRole(roles: string[], needed: string[]) {
  if (!roles.some((r) => needed.includes(r))) {
    throw new ApiError("FORBIDDEN", "Insufficient permissions");
  }
}

/** POST /v1/admin/documents/[id]/review — approve → publish (atomic active-version swap). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const claims = await requireAuth(req);
    const body = actionSchema.parse(await req.json());
    requireRole(claims.roles, ["approver", "knowledge_admin", "super_admin"]);

    const db = getDb();
    const [doc] = await db.select().from(documents).where(eq(documents.id, params.id)).limit(1);
    if (!doc) throw new ApiError("RESOURCE_NOT_FOUND", "Document not found");

    if (body.action === "reject") {
      if (doc.status !== "in_review" && doc.status !== "indexed") {
        throw new ApiError("VALIDATION_ERROR", `Cannot reject a document in status ${doc.status}`);
      }
      await db.update(documents).set({ status: "draft", processingError: body.notes ?? null }).where(eq(documents.id, doc.id));
    } else {
      if (doc.status !== "indexed") {
        throw new ApiError("VALIDATION_ERROR", `Document must be indexed before approval (current: ${doc.status})`);
      }
      // Supersede previous active version of this canonical doc, then publish.
      await db
        .update(documents)
        .set({ isActiveVersion: false, status: "superseded" })
        .where(and(eq(documents.canonicalId, doc.canonicalId), eq(documents.isActiveVersion, true)));
      await db
        .update(documents)
        .set({ status: "published", isActiveVersion: true, approvedBy: claims.sub, approvedAt: new Date(), publishedAt: new Date() })
        .where(eq(documents.id, doc.id));
    }

    await db.insert(auditLogs).values({
      actorId: claims.sub,
      action: body.action,
      resourceType: "document",
      resourceId: doc.id,
      changeSummary: `${body.action}d "${doc.title}"${body.notes ? ` — ${body.notes}` : ""}`,
    });

    return ok({ document_id: doc.id, status: body.action === "reject" ? "draft" : "published" });
  } catch (err) {
    return fail(err);
  }
}

/** GET /v1/admin/documents/[id]/review — pending review queue. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const claims = await requireAuth(req);
    requireRole(claims.roles, ["approver", "knowledge_admin", "super_admin"]);
    const db = getDb();
    void desc;
    const [doc] = await db.select().from(documents).where(eq(documents.id, params.id)).limit(1);
    if (!doc) throw new ApiError("RESOURCE_NOT_FOUND", "Document not found");
    return ok(doc);
  } catch (err) {
    return fail(err);
  }
}
