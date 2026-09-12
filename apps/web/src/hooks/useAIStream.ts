"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken, refreshAccessToken } from "@/lib/api-client";

/**
 * useAIStream — the SSE client for chat turns (Frontend Architecture §9.4).
 * fetch + ReadableStream (EventSource can't POST). Events: status, intent,
 * retrieval, token, citation, done, error. Tokens accumulate in a ref and
 * flush to state via requestAnimationFrame (60fps batches, not per-token).
 */

export interface Citation {
  order: number;
  document_id: string;
  document_title: string;
  /** College-website page this answer came from (synced docs) — null for direct uploads. */
  source_url: string | null;
  page_number: number | null;
  snippet: string;
  relevance_score: number;
}

export type StreamStatus = "idle" | "thinking" | "searching" | "reading" | "streaming" | "done" | "error";

/** A file the student attached to the message (base64, no data: prefix). */
export interface SendAttachment {
  name: string;
  mime_type: string;
  data: string;
}

export interface SendMessageOptions {
  content: string;
  attachments?: SendAttachment[];
  studyMode?: "learn" | "practice" | "explain_simply" | "challenge_me";
  language?: "en" | "hi" | "auto";
  /** Public model id (upc-1 | upc-1-plus | upc-1-pro) */
  model?: string;
  /** Re-run the last assistant reply (no new user message persisted) */
  regenerate?: boolean;
  /** Edit: soft-delete this user message + everything after, then resend */
  truncateFromMessageId?: string;
}

export function useAIStream(sessionId: string | null) {
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState(0); // bump → parent invalidates queries
  const [activeModel, setActiveModel] = useState<string | null>(null); // branded label from server
  const [doneMessageId, setDoneMessageId] = useState<string | null>(null); // id from the done event
  const [retrievalCount, setRetrievalCount] = useState<number | null>(null); // chunks found — powers "Reading N sections…"

  const bufferRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const flush = useCallback(() => {
    rafRef.current = null;
    if (mountedRef.current) setStreamingContent(bufferRef.current);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(flush);
  }, [flush]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setStatus("idle");
    setStreamingContent("");
  }, []);

  const send = useCallback(
    async (opts: SendMessageOptions) => {
      if (!sessionId) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      bufferRef.current = "";
      setStreamingContent("");
      setStreamingCitations([]);
      setError(null);
      setActiveModel(null);
      setDoneMessageId(null);
      setRetrievalCount(null);
      setStatus("thinking");

      try {
        const body = JSON.stringify({
          content: opts.content,
          model: opts.model,
          ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
          ...(opts.studyMode ? { study_mode: opts.studyMode } : {}),
          ...(opts.language ? { language: opts.language } : {}),
          ...(opts.regenerate ? { regenerate: true } : {}),
          ...(opts.truncateFromMessageId ? { truncate_from_message_id: opts.truncateFromMessageId } : {}),
        });
        const doFetch = (token: string | null) =>
          fetch(`/api/v1/chat/sessions/${sessionId}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
              Authorization: `Bearer ${token ?? ""}`,
            },
            body,
            credentials: "include",
            signal: controller.signal,
          });

        let res = await doFetch(getAccessToken());

        // Access token expired (15 min): silent refresh + single retry —
        // this hook bypasses api(), so it must do what api() does on 401.
        if (res.status === 401) {
          const fresh = await refreshAccessToken();
          if (fresh) res = await doFetch(fresh);
        }

        if (!res.ok || !res.body) {
          let message = "Couldn't reach UPC AI";
          try {
            const body = (await res.json()) as { error?: { message?: string } };
            message = body.error?.message ?? message;
          } catch {
            /* non-JSON */
          }
          throw new Error(message);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "message";
        let doneReceived = false; // errors after done (e.g. telemetry persist) must not break the UI

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Parse complete SSE frames (separated by \n\n)
          let separator: number;
          while ((separator = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, separator);
            buffer = buffer.slice(separator + 2);

            for (const line of frame.split("\n")) {
              if (line.startsWith(":")) continue; // heartbeat
              if (line.startsWith("event: ")) currentEvent = line.slice(7).trim();
              if (line.startsWith("data: ")) {
                handleEvent(currentEvent, line.slice(6));
              }
            }
          }
        }

        function handleEvent(event: string, rawData: string) {
          if (!mountedRef.current) return;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(rawData) as Record<string, unknown>;
          } catch {
            return;
          }
          switch (event) {
            case "status": {
              const s = data.status as string;
              setStatus(s === "searching" ? "searching" : s === "thinking" ? "thinking" : "streaming");
              break;
            }
            case "intent": {
              if (typeof data.model === "string") setActiveModel(data.model);
              break;
            }
            case "retrieval": {
              // Evidence landed — the model is now reading the retrieved chunks
              const found = typeof data.chunks_found === "number" ? data.chunks_found : 0;
              if (found > 0) {
                setRetrievalCount(found);
                setStatus((s) => (s === "streaming" ? s : "reading"));
              }
              break;
            }
            case "token": {
              setStatus("streaming");
              bufferRef.current += data.text as string;
              scheduleFlush();
              break;
            }
            case "citation": {
              setStreamingCitations((data.citations as Citation[]) ?? []);
              break;
            }
            case "done": {
              doneReceived = true;
              if (typeof data.message_id === "string") setDoneMessageId(data.message_id);
              setStatus("done");
              setCompletedAt(Date.now());
              break;
            }
            case "error": {
              if (doneReceived) break; // the answer completed — ignore trailing errors
              setStatus("error");
              setError((data.message as string) ?? "Generation failed");
              break;
            }
          }
        }

        // Stream ended: final flush
        flush();
        if (mountedRef.current && !controller.signal.aborted) {
          setStatus((s) => (s === "error" ? s : "done"));
          setCompletedAt(Date.now());
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (mountedRef.current) {
          setStatus("error");
          setError((err as Error).message);
        }
      } finally {
        abortRef.current = null;
      }
    },
    [sessionId, scheduleFlush, flush],
  );

  const isStreaming = status === "thinking" || status === "searching" || status === "reading" || status === "streaming";

  return { send, cancel, streamingContent, streamingCitations, status, isStreaming, error, completedAt, activeModel, doneMessageId, retrievalCount };
}
