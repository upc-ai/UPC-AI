"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogoMark } from "@upc/ui";
import { Markdown } from "./Markdown";
import type { Citation, StreamStatus } from "@/hooks/useAIStream";
import styles from "@/components/chat/chat.module.css";

export interface MessageAttachment {
  name: string;
  mime_type: string;
  /** Base64 bytes — present for images (thumbnail), omitted for PDFs after reload. */
  data?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  attachments?: MessageAttachment[];
}

export type FeedbackType = "thumbs_up" | "thumbs_down";

const STATUS_LABEL: Record<string, string> = {
  thinking: "Thinking…",
  searching: "Searching college documents…",
};

/* ---------------- Icons (stroke style matches the existing set) ---------------- */

function Icon({ children, size = 14 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const CopyIcon = () => (
  <Icon>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icon>
);

const CheckIcon = () => (
  <Icon>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

const EditIcon = () => (
  <Icon>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </Icon>
);

const RefreshIcon = () => (
  <Icon>
    <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
    <path d="M21 3v5h-5" />
  </Icon>
);

const ThumbUpIcon = ({ filled }: { filled?: boolean }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 10v12" />
    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
  </svg>
);

const ThumbDownIcon = ({ filled }: { filled?: boolean }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 14V2" />
    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
  </svg>
);

export function MessageList({
  messages,
  streamingContent,
  streamStatus,
  streamingCitations,
  onCitationClick,
  onRegenerate,
  onEdit,
  onFeedback,
  feedbackState,
}: {
  messages: ChatMessage[];
  streamingContent: string;
  streamStatus: StreamStatus;
  streamingCitations: Citation[];
  onCitationClick: (citations: Citation[], order: number) => void;
  onRegenerate?: () => void;
  onEdit?: (messageId: string, content: string) => void;
  onFeedback?: (messageId: string, type: FeedbackType) => void;
  feedbackState?: Record<string, FeedbackType>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  // Auto-scroll only when the user is already at the bottom (UIUX §5.5)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Scroll ONLY the messages container (not the browser page) and instantly —
    // scrollIntoView would walk up and scroll ancestors, breaking the layout.
    if (atBottomRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length, streamingContent, streamStatus]);

  const showThinking = streamStatus === "thinking" || streamStatus === "searching";
  const busy = showThinking || streamStatus === "streaming";
  const lastId = messages.length > 0 ? messages[messages.length - 1]!.id : null;

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard unavailable (insecure context) */
    }
  };

  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id);
    setEditDraft(m.content);
  };

  const saveEdit = (messageId: string) => {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setEditingId(null);
    onEdit?.(messageId, trimmed);
  };

  return (
    <div className={styles.messages} ref={containerRef} role="log" aria-live="polite">
      <div className={styles.column}>
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className={styles.messageGroupUser}>
              {editingId === m.id ? (
                <div className={styles.editBox}>
                  <textarea
                    className={styles.editArea}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === "Escape") setEditingId(null);
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(m.id);
                    }}
                    rows={3}
                    aria-label="Edit your message"
                    autoFocus
                  />
                  <div className={styles.editActions}>
                    <button className={styles.editCancel} onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                    <button className={styles.editSave} disabled={!editDraft.trim()} onClick={() => saveEdit(m.id)}>
                      Save & resend
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.messageGroupUserContent}>
                    {m.attachments && m.attachments.length > 0 && (
                      <div className={styles.msgAttachments}>
                        {m.attachments.map((a, i) =>
                          a.mime_type.startsWith("image/") && a.data ? (
                            <img
                              key={`${m.id}-att-${i}`}
                              className={styles.msgAttachmentImage}
                              src={`data:${a.mime_type};base64,${a.data}`}
                              alt={a.name}
                              draggable={false}
                            />
                          ) : (
                            <span key={`${m.id}-att-${i}`} className={styles.msgAttachmentFile}>
                              <Icon size={12}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                                <path d="M14 2v6h6" />
                              </Icon>
                              <span>{a.name}</span>
                            </span>
                          ),
                        )}
                      </div>
                    )}
                    {m.content && <div className={styles.userMessage}>{m.content}</div>}
                  </div>
                  <div className={styles.msgActionsUser}>
                    <button className={styles.actionBtn} onClick={() => void copy(m.id, m.content)} aria-label="Copy message" title="Copy">
                      {copiedId === m.id ? <CheckIcon /> : <CopyIcon />}
                    </button>
                    {!busy && onEdit && (
                      <button className={styles.actionBtn} onClick={() => startEdit(m)} aria-label="Edit message" title="Edit">
                        <EditIcon />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div key={m.id} className={styles.messageGroupAi}>
              <div className={styles.aiMessage}>
                <Markdown content={m.content} />
                {m.citations && m.citations.length > 0 && (
                  <CitationChips citations={m.citations} onCitationClick={onCitationClick} />
                )}
              </div>
              {!busy && (
                <div className={styles.msgActions}>
                  <button className={styles.actionBtn} onClick={() => void copy(m.id, m.content)} aria-label="Copy response" title="Copy">
                    {copiedId === m.id ? <CheckIcon /> : <CopyIcon />}
                  </button>
                  {onRegenerate && m.id === lastId && (
                    <button className={styles.actionBtn} onClick={onRegenerate} aria-label="Regenerate response" title="Regenerate">
                      <RefreshIcon />
                    </button>
                  )}
                  {onFeedback && (
                    <>
                      <button
                        className={[styles.actionBtn, feedbackState?.[m.id] === "thumbs_up" ? styles.actionBtnActive : ""].join(" ")}
                        onClick={() => onFeedback(m.id, "thumbs_up")}
                        aria-label="Good response"
                        aria-pressed={feedbackState?.[m.id] === "thumbs_up"}
                        title="Good response"
                      >
                        <ThumbUpIcon filled={feedbackState?.[m.id] === "thumbs_up"} />
                      </button>
                      <button
                        className={[styles.actionBtn, feedbackState?.[m.id] === "thumbs_down" ? styles.actionBtnActive : ""].join(" ")}
                        onClick={() => onFeedback(m.id, "thumbs_down")}
                        aria-label="Bad response"
                        aria-pressed={feedbackState?.[m.id] === "thumbs_down"}
                        title="Bad response"
                      >
                        <ThumbDownIcon filled={feedbackState?.[m.id] === "thumbs_down"} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ),
        )}

        {/* Streaming AI message */}
        {(showThinking || streamStatus === "streaming") && (
          <div className={styles.aiMessage}>
            {showThinking ? (
              <div className={styles.thinking} role="status">
                <LogoMark size={16} />
                <span className={styles.thinkingText}>{STATUS_LABEL[streamStatus] ?? "Thinking…"}</span>
              </div>
            ) : (
              <>
                <div className={styles.tokenFadeIn}>
                  <Markdown content={streamingContent} />
                </div>
                <span className={styles.caret} aria-hidden="true" />
                {streamingCitations.length > 0 && (
                  <CitationChips citations={streamingCitations} onCitationClick={onCitationClick} />
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function CitationChips({
  citations,
  onCitationClick,
}: {
  citations: Citation[];
  onCitationClick: (citations: Citation[], order: number) => void;
}) {
  return (
    <div className={styles.citationChips}>
      {citations.map((c) =>
        c.source_url ? (
          // Synced from the college website — the chip IS the link students expect
          <a
            key={`${c.document_id}-${c.order}`}
            className={styles.citationChip}
            href={c.source_url}
            target="_blank"
            rel="noreferrer"
            title={`Source: ${c.document_title}${c.page_number ? ` · p.${c.page_number}` : ""}`}
          >
            <strong>[{c.order}]</strong>
            <span>
              {c.document_title}
              {c.page_number ? ` · p.${c.page_number}` : ""}
            </span>
          </a>
        ) : (
          <button
            key={`${c.document_id}-${c.order}`}
            className={styles.citationChip}
            onClick={() => onCitationClick(citations, c.order)}
            aria-label={`Source ${c.order}: ${c.document_title}`}
          >
            <strong>[{c.order}]</strong>
            <span>
              {c.document_title}
              {c.page_number ? ` · p.${c.page_number}` : ""}
            </span>
          </button>
        ),
      )}
    </div>
  );
}
