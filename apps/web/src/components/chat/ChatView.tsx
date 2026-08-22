"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LogoMark, useToast } from "@upc/ui";
import { api } from "@/lib/api-client";
import { useAIStream, type Citation } from "@/hooks/useAIStream";
import { MessageList, type ChatMessage, type FeedbackType } from "./MessageList";
import { Composer, modelLabel, type PendingAttachment, type StudyMode, type ModelId } from "./Composer";
import { consumeFirstMessageAttachments } from "@/lib/first-message";
import styles from "@/components/chat/chat.module.css";

const MODEL_STORAGE_KEY = "upcai:model";

function initialModel(): ModelId {
  if (typeof window === "undefined") return "upc-1-plus";
  const saved = window.localStorage.getItem(MODEL_STORAGE_KEY);
  return saved === "upc-1" || saved === "upc-1-plus" || saved === "upc-1-pro" ? saved : "upc-1-plus";
}

/** Welcome state (new chat): greeting + composer, centered. */
export function WelcomeChat({ onSessionCreated }: { onSessionCreated: (sessionId: string, firstMessage: string, studyMode: StudyMode, language: "en" | "hi" | "auto", attachments: PendingAttachment[]) => void }) {
  const [studyMode, setStudyMode] = useState<StudyMode>("learn");
  const [language, setLanguage] = useState<"en" | "hi" | "auto">("en");
  const [model, setModel] = useState<ModelId>(initialModel);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  // Saved preferences (Settings page) pre-select the study mode + language
  useEffect(() => {
    void (async () => {
      try {
        const me = await api<{ preferences?: { default_study_mode?: StudyMode; language?: string } | null }>(
          "/api/v1/users/me",
        );
        const p = me.preferences;
        if (p?.default_study_mode) setStudyMode(p.default_study_mode);
        if (p?.language === "en" || p?.language === "hi" || p?.language === "auto") setLanguage(p.language);
      } catch {
        /* defaults are fine */
      }
    })();
  }, []);

  const changeModel = (m: ModelId) => {
    setModel(m);
    try {
      window.localStorage.setItem(MODEL_STORAGE_KEY, m);
    } catch {
      /* private mode */
    }
  };

  const start = async (content: string, attachments: PendingAttachment[]) => {
    if (creating) return;
    if (!content && attachments.length === 0) return;
    setCreating(true);
    try {
      const session = await api<{ id: string }>("/api/v1/chat/sessions", {
        method: "POST",
        body: JSON.stringify({ study_mode: studyMode, language_preference: language }),
      });
      onSessionCreated(session.id, content, studyMode, language, attachments);
    } catch {
      setCreating(false);
      toast.error("Couldn't start the conversation. Please try again.");
    }
  };

  return (
    <div className={styles.welcome}>
      <h1 className={styles.welcomeGreeting}>
        <LogoMark size={40} />
        How can I help you today?
      </h1>

      <Composer
        onSend={(content, attachments) => void start(content, attachments)}
        isStreaming={creating}
        studyMode={studyMode}
        onStudyModeChange={setStudyMode}
        language={language}
        onLanguageChange={setLanguage}
        model={model}
        onModelChange={changeModel}
      />
    </div>
  );
}

/** Active session view: messages + composer + sources panel. */
export function SessionChat({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sources, setSources] = useState<{ open: boolean; list: Citation[]; activeOrder: number | null }>({ open: false, list: [], activeOrder: null });
  const [studyMode, setStudyMode] = useState<StudyMode>("learn");
  const [language, setLanguage] = useState<"en" | "hi" | "auto">("en");
  const [model, setModel] = useState<ModelId>(initialModel);
  const [feedbackState, setFeedbackState] = useState<Record<string, FeedbackType>>({});
  const toast = useToast();

  const changeModel = (m: ModelId) => {
    setModel(m);
    try {
      window.localStorage.setItem(MODEL_STORAGE_KEY, m);
    } catch {
      /* private mode */
    }
  };

  const { send, cancel, streamingContent, streamingCitations, status, isStreaming, error, completedAt, doneMessageId } = useAIStream(sessionId);

  // Load history, then auto-send any pending first question (from the welcome screen)
  const pendingSent = useRef(false);
  useEffect(() => {
    void loadMessages();
    async function loadMessages() {
      try {
        const list = await api<{
          messages?: (ChatMessage & { citations?: Citation[]; attachments?: { name: string; mime_type: string; data?: string }[] })[];
        }>(`/api/v1/chat/sessions/${sessionId}/messages?limit=50`);
        setMessages(
          (list.messages ?? [])
            .filter((m) => m.role === "user" || (m.content ?? "").trim() !== "")
            .map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              citations: m.citations ?? [],
              attachments: m.attachments ?? [],
            })),
        );
        if (list.messages?.[0]?.content) setTitle(list.messages[0].content.slice(0, 60));
        // First question stashed by the welcome screen → fire it once history is known empty
        const pending = sessionStorage.getItem("upcai:pending");
        if (pending !== null && (list.messages ?? []).length === 0 && !pendingSent.current) {
          pendingSent.current = true;
          sessionStorage.removeItem("upcai:pending");
          const pendingAtts = consumeFirstMessageAttachments();
          setMessages([
            {
              id: `local-${Date.now()}`,
              role: "user",
              content: pending,
              attachments: pendingAtts.map((a) => ({ name: a.name, mime_type: a.mime_type, data: a.data })),
            },
          ]);
          void send({
            content: pending,
            attachments: pendingAtts.map((a) => ({ name: a.name, mime_type: a.mime_type, data: a.data })),
            model,
          });
        } else {
          // Not ours to fire — make sure nothing lingers for the next session
          if (pending !== null) sessionStorage.removeItem("upcai:pending");
          consumeFirstMessageAttachments();
        }
      } catch {
        /* session may be empty */
      } finally {
        setLoaded(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // On stream completion: commit the streamed answer immediately (no flash if
  // the refetch is slow or fails), then refetch to reconcile ids + citations.
  useEffect(() => {
    if (!completedAt) return;
    if (doneMessageId && streamingContent) {
      setMessages((prev) =>
        prev.some((m) => m.id === doneMessageId)
          ? prev
          : [...prev, { id: doneMessageId, role: "assistant", content: streamingContent, citations: streamingCitations }],
      );
    }
    void (async () => {
      try {
        const list = await api<{
          messages?: (ChatMessage & { citations?: Citation[]; attachments?: { name: string; mime_type: string; data?: string }[] })[];
        }>(`/api/v1/chat/sessions/${sessionId}/messages?limit=50`);
        setMessages(
          (list.messages ?? [])
            // Skip assistant shells still empty mid-generation (no ghost bubbles)
            .filter((m) => m.role === "user" || (m.content ?? "").trim() !== "")
            .map((m) => ({ id: m.id, role: m.role, content: m.content, citations: m.citations ?? [], attachments: m.attachments ?? [] })),
        );
      } catch {
        /* keep committed local state */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedAt, sessionId]);

  const handleSend = useCallback(
    (content: string, attachments: PendingAttachment[] = []) => {
      const wire = attachments.map((a) => ({ name: a.name, mime_type: a.mime_type, data: a.data }));
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          role: "user",
          content,
          attachments: wire,
        },
      ]);
      void send({ content, attachments: wire, studyMode, language, model });
    },
    [send, studyMode, language, model],
  );

  const handleRegenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || isStreaming) return;
    setMessages((prev) => {
      const lastAssistantIdx = prev.map((m) => m.role).lastIndexOf("assistant");
      return lastAssistantIdx >= 0 ? prev.slice(0, lastAssistantIdx) : prev;
    });
    void send({ content: lastUser.content, studyMode, language, model, regenerate: true });
  }, [messages, isStreaming, send, studyMode, language, model]);

  const handleEdit = useCallback(
    (messageId: string, content: string) => {
      // Only persisted messages (real UUIDs) can be truncated server-side.
      // A still-local message has nothing on the server yet, so just resend it fresh.
      const isPersisted = !messageId.startsWith("local-");
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        if (idx < 0) return prev;
        return [...prev.slice(0, idx), { id: `local-${Date.now()}`, role: "user" as const, content }];
      });
      void send({
        content,
        studyMode,
        language,
        model,
        ...(isPersisted ? { truncateFromMessageId: messageId } : {}),
      });
    },
    [send, studyMode, language, model],
  );

  const handleFeedback = useCallback(
    (messageId: string, type: FeedbackType) => {
      setFeedbackState((prev) => ({ ...prev, [messageId]: type }));
      void (async () => {
        try {
          await api("/api/v1/feedback", {
            method: "POST",
            body: JSON.stringify({ message_id: messageId, feedback_type: type }),
          });
        } catch {
          toast.error("Couldn't save feedback.");
          setFeedbackState((prev) => {
            if (prev[messageId] !== type) return prev;
            const next = { ...prev };
            delete next[messageId];
            return next;
          });
        }
      })();
    },
    [toast],
  );

  const openSources = (list: Citation[], order: number) => setSources({ open: true, list, activeOrder: order });

  if (!loaded) {
    return (
      <div className={styles.main}>
        <div className={styles.loadingShell}>Loading conversation…</div>
      </div>
    );
  }

  return (
    <div className={styles.main}>
      <header className={styles.chatHeader}>
        <span>{title ?? "New conversation"}</span>
        <span className={styles.headerMode}>
          {modelLabel(model)} · {studyMode.replace("_", " ")}
        </span>
      </header>

      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        streamStatus={status}
        streamingCitations={streamingCitations}
        onCitationClick={openSources}
        onRegenerate={handleRegenerate}
        onEdit={handleEdit}
        onFeedback={handleFeedback}
        feedbackState={feedbackState}
      />

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <button className={styles.retryBtn} onClick={() => { /* resend last */ const last = [...messages].reverse().find((m) => m.role === "user"); if (last) void send({ content: last.content, studyMode, language, model }); }}>
            Try again
          </button>
        </div>
      )}

      <Composer
        onSend={handleSend}
        onCancel={cancel}
        isStreaming={isStreaming}
        studyMode={studyMode}
        onStudyModeChange={setStudyMode}
        language={language}
        onLanguageChange={setLanguage}
        model={model}
        onModelChange={changeModel}
        placeholder="Ask a follow-up..."
      />

      {sources.open && (
        <aside className={styles.sourcesPanel} aria-label="Sources">
          <div className={styles.sourcesHeader}>
            Sources
            <button className={styles.barBtn} onClick={() => setSources((s) => ({ ...s, open: false }))} aria-label="Close sources">
              ✕
            </button>
          </div>
          {sources.list.map((c) => (
            <article key={`${c.document_id}-${c.order}`} className={styles.sourceCard} style={{ outline: c.order === sources.activeOrder ? "2px solid var(--accent)" : "none" }}>
              <h4>
                [{c.order}] {c.document_title}
              </h4>
              <cite>{c.page_number ? `Page ${c.page_number} · ` : ""}Official document</cite>
              <p>{c.snippet}</p>
              <div className={styles.relevanceBar} aria-hidden="true">
                <div className={styles.relevanceFill} style={{ width: `${Math.min(100, Math.round((c.relevance_score / 0.03) * 100))}%` }} />
              </div>
            </article>
          ))}
        </aside>
      )}
    </div>
  );
}
