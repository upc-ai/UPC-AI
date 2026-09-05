import { NextRequest } from "next/server";
import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { chatSessions, messages, aiResponses, citations as citationsTable, userPreferences, chatAttachments, retrievalLogs } from "@upc/db";
import { ApiError, publicModelById, publicModelForTier, STUDY_MODES, LANGUAGES, type ResponseLength, type Difficulty, type LanguagePreference, type StudyMode } from "@upc/core";
import { ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/redis";
import { detectIntent, tierFor } from "@/modules/orchestrator/intent";
import { buildSystemPrompt, buildHistory } from "@/modules/orchestrator/prompts";
import { retrieve } from "@/modules/retrieval/search";
import { streamGenerate } from "@/modules/providers/gateway";
import { getManagedConfig } from "@/modules/providers/managed-config";

export const dynamic = "force-dynamic";
/** 60s = Vercel Hobby plan ceiling (Pro allows up to 300 — raise there). */
export const maxDuration = 60;

/** GET /v1/chat/sessions/{id}/messages — paginated history with citations + attachments. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const claims = await requireAuth(req);
    const db = getDb();
    const [session] = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, params.id), eq(chatSessions.userId, claims.sub)))
      .limit(1);
    if (!session) throw new ApiError("RESOURCE_NOT_FOUND", "Session not found");

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

    const rows = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(eq(messages.sessionId, params.id), isNull(messages.deletedAt)))
      .orderBy(asc(messages.sequenceNumber))
      .limit(limit);

    // Attachments in one query; image bytes come back for thumbnails, PDFs
    // stay metadata-only (they can be megabytes and rarely need re-display).
    const attachmentRows = rows.length
      ? await db
          .select({
            id: chatAttachments.id,
            messageId: chatAttachments.messageId,
            name: chatAttachments.name,
            mimeType: chatAttachments.mimeType,
            sizeBytes: chatAttachments.sizeBytes,
            data: chatAttachments.data,
          })
          .from(chatAttachments)
          .where(inArray(chatAttachments.messageId, rows.map((r) => r.id)))
      : [];

    const withCitations = await Promise.all(
      rows.map(async (m) => {
        const cites = await db
          .select()
          .from(citationsTable)
          .where(eq(citationsTable.messageId, m.id))
          .orderBy(asc(citationsTable.citationOrder));
        const attachments = attachmentRows
          .filter((a) => a.messageId === m.id)
          .map((a) => ({
            id: a.id,
            name: a.name,
            mime_type: a.mimeType,
            size_bytes: a.sizeBytes,
            ...(a.mimeType.startsWith("image/") ? { data: a.data } : {}),
          }));
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          created_at: m.createdAt,
          ...(attachments.length ? { attachments } : {}),
          citations: cites.map((c) => ({
            order: c.citationOrder,
            document_id: c.documentId,
            document_title: c.documentTitle,
            page_number: c.pageNumber,
            snippet: c.snippet ?? "",
            relevance_score: Number(c.relevanceScore ?? 0),
          })),
        };
      }),
    );

    return ok({ messages: withCitations });
  } catch (err) {
    return fail(err);
  }
}

const ALLOWED_ATTACHMENT_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"] as const;
/** 13MB binary → ~17.5MB base64 on the wire; the provider caps requests at ~20MB. */
const MAX_ATTACHMENT_B64 = 18_300_000;

const bodySchema = z
  .object({
    content: z.string().max(10_000).optional().default(""),
    // Inline files (base64, no data: prefix) — photos of problems, PDF notes.
    // Images and PDFs both travel to the model as data-URL parts (verified
    // against the Gemini OpenAI-compatible endpoint).
    attachments: z
      .array(
        z.object({
          name: z.string().min(1).max(255),
          mime_type: z.enum(ALLOWED_ATTACHMENT_MIMES),
          data: z.string().min(1).max(MAX_ATTACHMENT_B64),
        }),
      )
      .max(4)
      // The model provider caps inline payloads (~20MB per request); base64
      // inflates bytes by ~4/3, so the combined attachments must stay under that.
      .refine((atts) => atts.reduce((n, a) => n + a.data.length, 0) <= 18_300_000, {
        message: "Attachments are too large combined — keep the total under 13 MB",
      })
      .optional(),
    // Public model id (upc-1 | upc-1-plus | upc-1-pro) — maps to a gateway tier
    model: z
      .string()
      .refine((id) => Boolean(publicModelById(id)), { message: "Unknown model" })
      .optional(),
    // Per-message overrides; when present they also update the session's saved values
    study_mode: z.enum(STUDY_MODES).optional(),
    language: z.enum(LANGUAGES).optional(),
    // Regenerate: drop the last assistant reply and re-run (no new user message)
    regenerate: z.boolean().optional(),
    // Edit: soft-delete this user message and everything after it, then insert fresh
    truncate_from_message_id: z.string().uuid().optional(),
  })
  .refine(
    (b) => b.content.trim().length > 0 || (b.attachments?.length ?? 0) > 0 || b.regenerate === true,
    { message: "Message is empty" },
  );

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Daily anti-abuse quota: UPC-1 and UPC-1 Plus are capped per user per IST
 *  calendar day; UPC-1 Pro is unrestricted (user directive). The limit is
 *  admin-managed (Providers & Models page) with a hard-coded fallback. */
const DAILY_MESSAGE_LIMIT_FALLBACK = 20;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function startOfIstDay(): Date {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

/** POST /v1/chat/sessions/{id}/messages — streaming SSE turn (Backend §3). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const claims = await requireAuth(req);
    const body = bodySchema.parse(await req.json());

    const rl = await rateLimit(`msg:${claims.sub}`, 30, 60);
    if (!rl.allowed) throw new ApiError("RATE_LIMIT_EXCEEDED", "Too many messages. Please wait a moment.");

    const db = getDb();

    // Session ownership
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, params.id), eq(chatSessions.userId, claims.sub)))
      .limit(1);
    if (!session) throw new ApiError("RESOURCE_NOT_FOUND", "Session not found");

    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, claims.sub))
      .limit(1);

    let history = await db
      .select({ id: messages.id, role: messages.role, content: messages.content, intent: messages.intent, sequenceNumber: messages.sequenceNumber })
      .from(messages)
      .where(and(eq(messages.sessionId, session.id), isNull(messages.deletedAt)))
      .orderBy(asc(messages.sequenceNumber));

    // Edit: soft-delete the target user message and everything after it
    if (body.truncate_from_message_id) {
      const target = history.find((m) => m.id === body.truncate_from_message_id && m.role === "user");
      if (!target) throw new ApiError("VALIDATION_ERROR", "Message not found in this session");
      await db
        .update(messages)
        .set({ deletedAt: new Date() })
        .where(and(eq(messages.sessionId, session.id), gte(messages.sequenceNumber, target.sequenceNumber)));
      history = history.filter((m) => m.sequenceNumber < target.sequenceNumber);
    }

    // Regenerate: soft-delete the last assistant reply (prompt = the user turn before it)
    if (body.regenerate) {
      const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
      if (lastAssistant) {
        await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, lastAssistant.id));
        history = history.filter((m) => m.id !== lastAssistant.id);
      }
    }

    // Next sequence number: soft-deleted rows still occupy their slots (unique
    // index on session+sequence), so take the max across ALL rows — not just live ones.
    const [maxRow] = await db
      .select({ maxSeq: sql<number>`coalesce(max(${messages.sequenceNumber}), 0)` })
      .from(messages)
      .where(eq(messages.sessionId, session.id));
    const nextSeq = Number(maxRow?.maxSeq ?? 0) + 1;

    const lastIntent = [...history].reverse().find((m) => m.intent)?.intent ?? null;

    // ---- Orchestration (runs BEFORE persisting — the quota gate needs the tier) ----
    const intentResult = detectIntent(
      body.content.trim() || (body.attachments?.length ? "solve this problem from the attached file" : ""),
      { lastIntent },
    );
    const chosenModel = body.model ? publicModelById(body.model) : undefined;
    const tier = chosenModel?.tier ?? tierFor(intentResult.intent);
    const publicLabel = publicModelForTier(tier).label;
    const studyMode = (body.study_mode ?? session.studyMode ?? "learn") as StudyMode;
    const language = (body.language ?? session.languagePreference ?? "en") as LanguagePreference;
    const responseLength = (prefs?.responseLength ?? "detailed") as ResponseLength;
    const difficulty = (prefs?.difficulty ?? "intermediate") as Difficulty;

    // ---- Daily message quota (anti-abuse) ----
    // Counts EVERY user message sent today across all sessions — soft-deleting
    // chats or messages must not hand quota back. Regenerate reuses an existing
    // user turn, so it doesn't consume quota.
    if (tier !== "frontier" && !body.regenerate) {
      const { quota } = await getManagedConfig();
      const DAILY_MESSAGE_LIMIT = quota.daily_message_limit || DAILY_MESSAGE_LIMIT_FALLBACK;
      const [used] = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .innerJoin(chatSessions, eq(messages.sessionId, chatSessions.id))
        .where(
          and(
            eq(chatSessions.userId, claims.sub),
            eq(messages.role, "user"),
            gte(messages.createdAt, startOfIstDay()),
          ),
        );
      if (Number(used?.count ?? 0) >= DAILY_MESSAGE_LIMIT) {
        throw new ApiError(
          "RATE_LIMIT_EXCEEDED",
          `Daily limit reached — UPC-1 and UPC-1 Plus include ${DAILY_MESSAGE_LIMIT} messages per day. Resets at midnight.`,
        );
      }
    }

    // Per-message mode/language overrides persist onto the session
    if (body.study_mode !== undefined || body.language !== undefined) {
      await db
        .update(chatSessions)
        .set({
          ...(body.study_mode !== undefined ? { studyMode: body.study_mode } : {}),
          ...(body.language !== undefined ? { languagePreference: body.language } : {}),
        })
        .where(eq(chatSessions.id, session.id));
    }

    // Persist user message (skipped on regenerate — the existing user turn is the prompt)
    let userMsgId: string | null = null;
    if (!body.regenerate) {
      const [userMsg] = await db
        .insert(messages)
        .values({
          sessionId: session.id,
          role: "user",
          content: body.content,
          contentFormat: "text",
          sequenceNumber: nextSeq,
        })
        .returning({ id: messages.id });
      userMsgId = userMsg!.id;

      if (body.attachments?.length) {
        await db.insert(chatAttachments).values(
          body.attachments.map((a) => ({
            messageId: userMsg!.id,
            name: a.name,
            mimeType: a.mime_type,
            sizeBytes: Math.floor((a.data.length * 3) / 4), // base64 → bytes
            data: a.data,
          })),
        );
      }
    } else {
      userMsgId = [...history].reverse().find((m) => m.role === "user")?.id ?? null;
    }

    // Attachments for THIS turn: freshly uploaded, or the prompt turn's own on regenerate
    const turnAttachments = body.attachments
      ? body.attachments.map((a) => ({ name: a.name, mimeType: a.mime_type, data: a.data }))
      : userMsgId
        ? (
            await db
              .select({ name: chatAttachments.name, mimeType: chatAttachments.mimeType, data: chatAttachments.data })
              .from(chatAttachments)
              .where(eq(chatAttachments.messageId, userMsgId))
          )
        : [];

    // ---- Orchestration (intent/tier/prefs computed above, before the quota gate) ----

    const encoder = new TextEncoder();
    // Shared stream state — `cancel()` (client disconnects: Stop button, tab
    // closed, navigation) closes the controller from the runtime side. The
    // heartbeat must stop then, or it throws an uncaught ERR_INVALID_STATE
    // every 15s against the dead controller — enough to crash the process.
    let closed = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    const stream = new ReadableStream({
      cancel() {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
      },
      async start(controller) {
        const send = (event: string, data: unknown) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(sse(event, data)));
          } catch {
            closed = true;
            if (heartbeat) clearInterval(heartbeat);
          }
        };
        heartbeat = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            closed = true;
            if (heartbeat) clearInterval(heartbeat);
          }
        }, 15_000);

        try {
          send("status", { status: "thinking", message: "Thinking…" });

          // Retrieval for knowledge/mixed (RAG v2: rewrite → hybrid → fusion,
          // every attempt logged for the coverage-gap "unanswered questions" loop)
          let contextChunks: Awaited<ReturnType<typeof retrieve>>["chunks"] = [];
          let noEvidence = false;
          let retrievalLog: { query: string; rewritten: string | null; intent: string; topScore: number | null; chunks: number; refused: boolean; ms: number } | null = null;
          if (intentResult.intent === "knowledge" || intentResult.intent === "mixed") {
            send("status", { status: "searching", message: "Searching college documents…" });
            const retrievalStart = Date.now();
            try {
              const r = await retrieve(body.content, undefined, { history: history.map((m) => ({ role: m.role, content: m.content })) });
              contextChunks = r.chunks;
              retrievalLog = {
                query: body.content,
                rewritten: r.effectiveQuery !== body.content ? r.effectiveQuery : null,
                intent: intentResult.intent,
                topScore: r.chunks[0]?.relevanceScore ?? null,
                chunks: r.chunks.length,
                refused: false,
                ms: Date.now() - retrievalStart,
              };
            } catch (err) {
              console.error("[retrieval] degraded:", err);
              retrievalLog = {
                query: body.content,
                rewritten: null,
                intent: intentResult.intent,
                topScore: null,
                chunks: 0,
                refused: true,
                ms: Date.now() - retrievalStart,
              };
            }
            if (intentResult.intent === "knowledge" && contextChunks.length === 0) {
              noEvidence = true; // grounded refusal path (P7)
              if (retrievalLog) retrievalLog.refused = true;
            }
            if (retrievalLog) {
              db.insert(retrievalLogs)
                .values({
                  userId: claims.sub,
                  query: retrievalLog.query,
                  rewrittenQuery: retrievalLog.rewritten,
                  intent: retrievalLog.intent,
                  topScore: retrievalLog.topScore !== null ? String(retrievalLog.topScore) : null,
                  chunkCount: retrievalLog.chunks,
                  refused: retrievalLog.refused,
                  latencyMs: retrievalLog.ms,
                })
                .catch(() => undefined); // telemetry must never kill the stream
            }
          }

          send("intent", { intent: intentResult.intent, confidence: intentResult.confidence, model: publicLabel });
          if (contextChunks.length) send("retrieval", { status: "found", chunks_found: contextChunks.length });

          // Persist assistant message shell
          const [aiMsg] = await db
            .insert(messages)
            .values({
              sessionId: session.id,
              role: "assistant",
              content: "",
              intent: intentResult.intent,
              intentConfidence: String(intentResult.confidence),
              sequenceNumber: body.regenerate ? nextSeq : nextSeq + 1,
              parentMessageId: userMsgId,
            })
            .returning({ id: messages.id });

          // Grounded refusal — no provider call
          if (noEvidence) {
            const refusal =
              language === "hi"
                ? "मुझे यह जानकारी अभी तक आधिकारिक ज्ञानभंडार में नहीं मिली है। कृपया संबंधित कॉलेज कार्यालय से पुष्टि करें।"
                : "I don't have that in the official knowledge base yet. Please confirm with the concerned college office.";
            let seq = 0;
            for (const token of refusal.match(/.{1,20}/g) ?? []) {
              seq++;
              send("token", { text: token, sequence: seq });
            }
            await db.update(messages).set({ content: refusal }).where(eq(messages.id, aiMsg!.id));
            await db.insert(aiResponses).values({
              messageId: aiMsg!.id,
              modelUsed: "grounded-refusal",
              providerUsed: "internal",
              finishReason: "stop",
            });
            send("done", { message_id: aiMsg!.id, finish_reason: "stop", citations: [], model: publicLabel });
          } else {
            // Generate with provider gateway
            const system = buildSystemPrompt({
              intent: intentResult.intent,
              studyMode,
              language,
              responseLength,
              difficulty,
              modelLabel: publicLabel,
              contextChunks,
            });
            // Final user turn: with attachments the content becomes multimodal
            // parts — images AND PDFs both ride as data-URL image parts (the
            // Gemini OpenAI-compatible endpoint accepts application/pdf there;
            // verified against the live endpoint).
            const userContent:
              | string
              | Array<{ type: "text"; text: string } | { type: "image"; image: string }> = turnAttachments.length
              ? [
                  { type: "text", text: body.content.trim() || "Please help with the attached file(s)." },
                  ...turnAttachments.map((a) => ({
                    type: "image" as const,
                    image: `data:${a.mimeType};base64,${a.data}`,
                  })),
                ]
              : body.content;

            const msgs = [...buildHistory(history)];
            if (body.regenerate) {
              // The prompt turn is already in history — swap in the multimodal
              // version so regenerate re-sends the attachments too.
              for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i]!.role === "user") {
                  msgs[i] = { role: "user", content: userContent } as (typeof msgs)[number];
                  break;
                }
              }
            } else {
              msgs.push({ role: "user", content: userContent } as (typeof msgs)[number]);
            }
            const chatMessages = [
              { role: "system", content: system },
              ...msgs,
            ] as Parameters<typeof streamGenerate>[0]["messages"];

            const started = Date.now();
            let firstTokenMs: number | null = null;
            let full = "";
            let seq = 0;
            let done: { model: string; provider: string; tokensIn: number; tokensOut: number; costUsd: number } | null = null;

            for await (const event of streamGenerate({ messages: chatMessages, tier })) {
              if (event.type === "token") {
                if (firstTokenMs === null) firstTokenMs = Date.now() - started;
                full += event.text;
                seq++;
                send("token", { text: event.text, sequence: seq });
              } else if (event.type === "done") {
                done = event;
              } else if (event.type === "error") {
                send("error", { code: event.code, message: event.message, retrying: event.retrying });
              }
            }

            // Persist final content (metrics/citations are telemetry — a failure
            // there must never error the stream after the answer already streamed)
            await db.update(messages).set({ content: full }).where(eq(messages.id, aiMsg!.id));
            try {
              if (done) {
                await db.insert(aiResponses).values({
                  messageId: aiMsg!.id,
                  modelUsed: done.model,
                  providerUsed: done.provider,
                  tokensInput: Number.isFinite(done.tokensIn) ? done.tokensIn : 0,
                  tokensOutput: Number.isFinite(done.tokensOut) ? done.tokensOut : 0,
                  costEstimate: String(done.costUsd),
                  firstTokenLatencyMs: firstTokenMs,
                  totalLatencyMs: Date.now() - started,
                  finishReason: "stop",
                  retrievalUsed: contextChunks.length > 0,
                });
              }
            } catch (err) {
              console.error("[chat-stream] metrics persist failed:", err);
            }

            // Citations
            const citationPayload = contextChunks.slice(0, 6).map((c, i) => ({
              order: i + 1,
              document_id: c.documentId,
              document_title: c.documentTitle,
              page_number: c.pageNumber,
              section: c.hierarchyPath, // "Doc > Section" path (RAG v2)
              snippet: c.content.slice(0, 220),
              relevance_score: Number(c.relevanceScore.toFixed(3)),
            }));
            for (const c of contextChunks.slice(0, 6)) {
              try {
                await db.insert(citationsTable).values({
                  messageId: aiMsg!.id,
                  chunkId: c.chunkId,
                  documentId: c.documentId,
                  documentTitle: c.documentTitle,
                  documentVersion: c.documentVersion,
                  pageNumber: c.pageNumber,
                  snippet: c.content.slice(0, 220),
                  relevanceScore: String(c.relevanceScore.toFixed(2)),
                  citationOrder: citationPayload.findIndex((p) => p.document_id === c.documentId && p.page_number === c.pageNumber) + 1,
                });
              } catch (err) {
                console.error("[chat-stream] citation persist failed:", err);
              }
            }
            send("citation", { citations: citationPayload });
            send("done", { message_id: aiMsg!.id, finish_reason: "stop", citations: citationPayload, model: publicLabel });
          }

          // Update session denormalized fields (regenerate adds only the assistant row)
          await db
            .update(chatSessions)
            .set({
              lastMessageAt: new Date(),
              messageCount: sql`${chatSessions.messageCount} + ${body.regenerate ? 1 : 2}`,
              ...(session.title
                ? {}
                : {
                    title: (body.content.trim() || turnAttachments[0]?.name || "New conversation").slice(0, 60),
                  }),
              sessionType:
                intentResult.intent === "knowledge"
                  ? "knowledge"
                  : intentResult.intent === "academic"
                    ? "academic"
                    : session.sessionType,
            })
            .where(eq(chatSessions.id, session.id));
        } catch (err) {
          console.error("[chat-stream]", err);
          send("error", { code: "AI_GENERATION_FAILED", message: "Couldn't generate a response.", retrying: false });
        } finally {
          if (heartbeat) clearInterval(heartbeat);
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed by cancel() when the client disconnected */
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return fail(err);
  }
}
