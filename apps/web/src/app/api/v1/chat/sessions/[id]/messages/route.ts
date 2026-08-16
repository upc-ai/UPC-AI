import { NextRequest } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { chatSessions, messages, aiResponses, citations as citationsTable, userPreferences } from "@upc/db";
import { ApiError, type ResponseLength, type Difficulty, type LanguagePreference, type StudyMode } from "@upc/core";
import { fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/redis";
import { detectIntent, tierFor } from "@/modules/orchestrator/intent";
import { buildSystemPrompt, buildHistory } from "@/modules/orchestrator/prompts";
import { retrieve } from "@/modules/retrieval/search";
import { streamGenerate } from "@/modules/providers/gateway";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  content: z.string().min(1).max(10_000),
  attachments: z.array(z.object({ attachment_id: z.string().uuid() })).max(5).optional(),
});

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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

    const history = await db
      .select({ role: messages.role, content: messages.content, intent: messages.intent })
      .from(messages)
      .where(eq(messages.sessionId, session.id))
      .orderBy(asc(messages.sequenceNumber));

    const lastIntent = [...history].reverse().find((m) => m.intent)?.intent ?? null;

    // Persist user message
    const [userMsg] = await db
      .insert(messages)
      .values({
        sessionId: session.id,
        role: "user",
        content: body.content,
        contentFormat: "text",
        sequenceNumber: history.length + 1,
      })
      .returning({ id: messages.id });

    // ---- Orchestration ----
    const intentResult = detectIntent(body.content, { lastIntent });
    const language = (session.languagePreference ?? "en") as LanguagePreference;
    const studyMode = session.studyMode as StudyMode;
    const responseLength = (prefs?.responseLength ?? "detailed") as ResponseLength;
    const difficulty = (prefs?.difficulty ?? "intermediate") as Difficulty;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const send = (event: string, data: unknown) => {
          if (!closed) controller.enqueue(encoder.encode(sse(event, data)));
        };
        const heartbeat = setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }, 15_000);

        try {
          send("status", { status: "thinking", message: "Thinking…" });

          // Retrieval for knowledge/mixed
          let contextChunks: Awaited<ReturnType<typeof retrieve>> = [];
          let noEvidence = false;
          if (intentResult.intent === "knowledge" || intentResult.intent === "mixed") {
            send("status", { status: "searching", message: "Searching college documents…" });
            try {
              contextChunks = await retrieve(body.content);
            } catch (err) {
              console.error("[retrieval] degraded:", err);
            }
            if (intentResult.intent === "knowledge" && contextChunks.length === 0) {
              noEvidence = true; // grounded refusal path (P7)
            }
          }

          send("intent", { intent: intentResult.intent, confidence: intentResult.confidence });
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
              sequenceNumber: history.length + 2,
              parentMessageId: userMsg!.id,
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
            send("done", { message_id: aiMsg!.id, finish_reason: "stop", citations: [] });
          } else {
            // Generate with provider gateway
            const system = buildSystemPrompt({
              intent: intentResult.intent,
              studyMode,
              language,
              responseLength,
              difficulty,
              contextChunks,
            });
            const chatMessages = [
              { role: "system", content: system },
              ...buildHistory(history),
              { role: "user", content: body.content },
            ] as Parameters<typeof streamGenerate>[0]["messages"];

            const started = Date.now();
            let firstTokenMs: number | null = null;
            let full = "";
            let seq = 0;
            let done: { model: string; provider: string; tokensIn: number; tokensOut: number; costUsd: number } | null = null;

            for await (const event of streamGenerate({ messages: chatMessages, tier: tierFor(intentResult.intent) })) {
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

            // Persist final content + metrics
            await db.update(messages).set({ content: full }).where(eq(messages.id, aiMsg!.id));
            if (done) {
              await db.insert(aiResponses).values({
                messageId: aiMsg!.id,
                modelUsed: done.model,
                providerUsed: done.provider,
                tokensInput: done.tokensIn,
                tokensOutput: done.tokensOut,
                costEstimate: String(done.costUsd),
                firstTokenLatencyMs: firstTokenMs,
                totalLatencyMs: Date.now() - started,
                finishReason: "stop",
                retrievalUsed: contextChunks.length > 0,
              });
            }

            // Citations
            const citationPayload = contextChunks.slice(0, 6).map((c, i) => ({
              order: i + 1,
              document_id: c.documentId,
              document_title: c.documentTitle,
              page_number: c.pageNumber,
              snippet: c.content.slice(0, 220),
              relevance_score: Number(c.relevanceScore.toFixed(3)),
            }));
            for (const c of contextChunks.slice(0, 6)) {
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
            }
            send("citation", { citations: citationPayload });
            send("done", { message_id: aiMsg!.id, finish_reason: "stop", citations: citationPayload });
          }

          // Update session denormalized fields
          await db
            .update(chatSessions)
            .set({
              lastMessageAt: new Date(),
              messageCount: sql`${chatSessions.messageCount} + 2`,
              ...(session.title ? {} : { title: body.content.slice(0, 60) }),
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
          clearInterval(heartbeat);
          closed = true;
          controller.close();
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
