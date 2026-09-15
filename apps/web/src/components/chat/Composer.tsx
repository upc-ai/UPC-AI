"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@upc/ui";
import styles from "@/components/chat/chat.module.css";

export type StudyMode = "learn" | "practice" | "explain_simply" | "challenge_me";

/** Public model catalog — server maps each id to a routing tier (never a vendor name). */
export type ModelId = "upc-1" | "upc-1-plus" | "upc-1-pro";

/** A file staged in the composer, not yet sent. `data` is raw base64. */
export interface PendingAttachment {
  id: string;
  name: string;
  mime_type: string;
  data: string;
  size: number;
}

export const ATTACHMENT_ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"] as const;
const MAX_FILES = 4;
/** Per-file cap. The provider rejects requests over ~20MB and base64 inflates
 *  bytes by ~4/3 — 13MB binary ≈ 17.5MB on the wire, the safe ceiling. */
const MAX_FILE_BYTES = 13 * 1024 * 1024;
/** Combined cap across all files in one message. */
const MAX_TOTAL_BYTES = 13 * 1024 * 1024;

export const CHAT_MODELS: { id: ModelId; label: string; blurb: string }[] = [
  { id: "upc-1", label: "UPC-1", blurb: "Fast answers for quick doubts" },
  { id: "upc-1-plus", label: "UPC-1 Plus", blurb: "Balanced for everyday studying" },
  { id: "upc-1-pro", label: "UPC-1 Pro", blurb: "Deepest reasoning for hard problems" },
];

export function modelLabel(id: string): string {
  return CHAT_MODELS.find((m) => m.id === id)?.label ?? "UPC-1 Plus";
}

const MODE_LABELS: Record<StudyMode, string> = {
  learn: "Learn",
  practice: "Practice",
  explain_simply: "Explain Simply",
  challenge_me: "Challenge Me",
};

export interface ComposerProps {
  onSend: (content: string, attachments: PendingAttachment[]) => void;
  onCancel?: () => void;
  isStreaming: boolean;
  studyMode: StudyMode;
  onStudyModeChange: (mode: StudyMode) => void;
  language: "en" | "hi" | "auto";
  onLanguageChange: (lang: "en" | "hi" | "auto") => void;
  model: ModelId;
  onModelChange: (model: ModelId) => void;
  placeholder?: string;
}

/** Read a File into a PendingAttachment (base64, no data: prefix). */
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1)); // strip data:<mime>;base64,
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** Phone photos are 2–8 MB — past the ~4.5 MB serverless body limit once
    base64 inflates them 4/3 (the request 413s before the AI ever sees it),
    and vision models don't need the extra pixels. Downscale to ≤1600px JPEG
    before staging. GIFs keep their animation (never re-encoded); anything
    that fails to compress falls back to the original file. */
const COMPRESS_OVER_BYTES = 500 * 1024;
const COMPRESS_MAX_SIDE = 1600;

async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif" || file.size <= COMPRESS_OVER_BYTES) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, COMPRESS_MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    const name = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

export function Composer({
  onSend,
  onCancel,
  isStreaming,
  studyMode,
  onStudyModeChange,
  language,
  onLanguageChange,
  model,
  onModelChange,
  placeholder = "Ask UPC AI anything...",
}: ComposerProps) {
  const [content, setContent] = useState("");
  const [focused, setFocused] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [files, setFiles] = useState<PendingAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Auto-grow: 48px → 200px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [content]);

  // "/" focuses the composer from anywhere in the chat view
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the popovers on outside click / Escape
  useEffect(() => {
    if (!modeOpen && !modelOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`.${styles.composerMenuWrap}`)) {
        setModeOpen(false);
        setModelOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModeOpen(false);
        setModelOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [modeOpen, modelOpen, styles.composerMenuWrap]);

  const addFiles = async (list: FileList | File[]) => {
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      if (!(ATTACHMENT_ACCEPT as readonly string[]).includes(f.type)) {
        toast.error(`"${f.name}" isn't supported. Use an image or PDF.`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`"${f.name}" is over 13 MB — compress it or split it first.`);
        continue;
      }
      // PDFs can't be downscaled client-side — a large one base64-inflates
      // past the platform body cap and would 413 on the live site.
      if (f.type === "application/pdf" && f.size > 3.5 * 1024 * 1024) {
        toast.error(`"${f.name}" is a large PDF — it may fail to send. If it does, split or scan the pages as photos.`);
      }
      accepted.push(f);
    }
    if (accepted.length === 0) return;

    const bytesAfter = files.reduce((n, f) => n + f.size, 0) + accepted.reduce((n, f) => n + f.size, 0);
    if (bytesAfter > MAX_TOTAL_BYTES) {
      toast.error("Attachments can total up to 13 MB per message. Remove a file or attach a smaller one.");
      return;
    }

    const room = Math.max(0, MAX_FILES - files.length);
    if (accepted.length > room) toast.error(`Up to ${MAX_FILES} files per message.`);
    const staged = accepted.slice(0, room);
    if (staged.length === 0) return;

    const read: PendingAttachment[] = [];
    for (const f of staged) {
      try {
        const processed = f.type.startsWith("image/") ? await compressImage(f) : f;
        const data = await readFile(processed);
        read.push({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: processed.name,
          mime_type: processed.type,
          data,
          size: processed.size,
        });
      } catch {
        toast.error(`Couldn't read "${f.name}".`);
      }
    }
    if (read.length) setFiles((prev) => [...prev, ...read].slice(0, MAX_FILES));
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const submit = () => {
    if (isStreaming) return;
    const trimmed = content.trim();
    if (!trimmed && files.length === 0) return;
    onSend(trimmed, files);
    setContent("");
    setFiles([]);
  };

  return (
    <div className={styles.composerWrap}>
      <div className={[styles.composer, focused ? styles.composerFocused : ""].join(" ")}>
        {files.length > 0 && (
          <div className={styles.attachRow} aria-label="Attached files">
            {files.map((f) => (
              <div key={f.id} className={f.mime_type === "application/pdf" ? styles.attachChip : styles.attachThumb}>
                {f.mime_type === "application/pdf" ? (
                  <>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" />
                    </svg>
                    <span>{f.name}</span>
                  </>
                ) : (
                  <img src={`data:${f.mime_type};base64,${f.data}`} alt={f.name} draggable={false} />
                )}
                <button
                  className={styles.attachRemove}
                  onClick={() => removeFile(f.id)}
                  aria-label={`Remove ${f.name}`}
                >
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={content}
          placeholder={placeholder}
          aria-label="Message input"
          rows={1}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPaste={(e) => {
            const pasted = Array.from(e.clipboardData.files);
            if (pasted.length) {
              e.preventDefault();
              void addFiles(pasted);
            }
          }}
          onKeyDown={(e) => {
            // IME guard: Enter that confirms a composition must not send —
            // otherwise a word being typed splits into two messages.
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={ATTACHMENT_ACCEPT.join(",")}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />
        <div className={styles.composerBar}>
          {/* Attach — photos of problems, PDF notes */}
          <button
            className={styles.barBtn}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach image or PDF"
            title="Attach image or PDF"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          {/* Model (public catalog — UPC-1 family) */}
          <div className={styles.composerMenuWrap}>
            <button
              className={styles.barBtn}
              onClick={() => {
                setModelOpen((v) => !v);
                setModeOpen(false);
              }}
              aria-haspopup="listbox"
              aria-expanded={modelOpen}
              title="Choose model"
            >
              {modelLabel(model)}
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {modelOpen && (
              <div className={[styles.composerMenu, styles.composerMenuWide].join(" ")} role="listbox" aria-label="Model">
                {CHAT_MODELS.map((m) => (
                  <button
                    key={m.id}
                    role="option"
                    aria-selected={m.id === model}
                    className={[styles.menuOption, m.id === model ? styles.menuOptionActive : ""].join(" ")}
                    onClick={() => {
                      onModelChange(m.id);
                      setModelOpen(false);
                    }}
                  >
                    <span>
                      <strong>{m.label}</strong>
                      <br />
                      <small style={{ opacity: 0.65 }}>{m.blurb}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Study mode */}
          <div className={styles.composerMenuWrap}>
            <button
              className={styles.barBtn}
              onClick={() => {
                setModeOpen((v) => !v);
                setModelOpen(false);
              }}
              aria-haspopup="listbox"
              aria-expanded={modeOpen}
            >
              {MODE_LABELS[studyMode]}
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {modeOpen && (
              <div className={styles.composerMenu} role="listbox" aria-label="Study mode">
                {(Object.keys(MODE_LABELS) as StudyMode[]).map((m) => (
                  <button
                    key={m}
                    role="option"
                    aria-selected={m === studyMode}
                    className={[styles.menuOption, m === studyMode ? styles.menuOptionActive : ""].join(" ")}
                    onClick={() => {
                      onStudyModeChange(m);
                      setModeOpen(false);
                    }}
                  >
                    <span>{MODE_LABELS[m]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language */}
          <span className={styles.langToggle} role="group" aria-label="Response language">
            <button
              className={language === "en" ? styles.langActive : ""}
              onClick={() => onLanguageChange("en")}
              aria-pressed={language === "en"}
            >
              EN
            </button>
            <button
              className={language === "hi" ? styles.langActive : ""}
              onClick={() => onLanguageChange("hi")}
              aria-pressed={language === "hi"}
            >
              HI
            </button>
          </span>

          {/* Send / Stop */}
          {isStreaming ? (
            <button className={styles.sendBtn} onClick={onCancel} aria-label="Stop generation" title="Stop">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
            </button>
          ) : (
            <button className={styles.sendBtn} onClick={submit} disabled={!content.trim() && files.length === 0} aria-label="Send message" title="Send">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <p className={styles.disclaimer}>UPC AI can make mistakes. Please double-check important details.</p>
    </div>
  );
}
