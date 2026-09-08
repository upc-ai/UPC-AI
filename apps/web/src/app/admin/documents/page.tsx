"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useToast, Button } from "@upc/ui";
import styles from "./admin.module.css";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type DocStatus =
  | "uploaded" | "parsing" | "chunking" | "embedding" | "indexed"
  | "draft" | "published" | "superseded"
  | "parse_failed" | "chunk_failed" | "embed_failed"
  | "needs_ocr";

interface AdminDoc {
  id: string;
  title: string;
  fileType: string | null;
  fileSizeBytes: number | null;
  status: DocStatus;
  version: number;
  canonicalId: string;
  isActiveVersion: boolean;
  chunkCount: number | null;
  processingError: string | null;
  createdAt: string;
  publishedAt: string | null;
  categoryName: string | null;
  uploaderName: string | null;
  jobStage: string | null;
  jobProgress: number | null;
}

interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  documentCount: number;
}

const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "text/markdown",
  "text/html",
];
const MAX_BYTES = 50 * 1024 * 1024;

const PROCESSING: DocStatus[] = ["parsing", "chunking", "embedding"];
const FAILED: DocStatus[] = ["parse_failed", "chunk_failed", "embed_failed", "needs_ocr"];

function statusLabel(s: DocStatus, d?: AdminDoc): string {
  if (PROCESSING.includes(s)) {
    const stage = d?.jobStage ?? s;
    const pct = d?.jobProgress != null ? ` ${d.jobProgress}%` : "";
    return `${stage}${pct}`;
  }
  const map: Record<string, string> = {
    uploaded: "Uploaded",
    indexed: "Ready to publish",
    draft: "Rejected",
    published: "Published",
    superseded: "Superseded",
    parse_failed: "Parse failed",
    chunk_failed: "Chunk failed",
    embed_failed: "Embed failed",
    needs_ocr: "Needs OCR (scanned)",
  };
  return map[s] ?? s;
}

function statusClass(s: DocStatus): string | undefined {
  if (PROCESSING.includes(s)) return styles.statusProcessing;
  if (FAILED.includes(s)) return styles.statusFailed;
  if (s === "published") return styles.statusPublished;
  if (s === "superseded") return styles.statusSuperseded;
  if (s === "indexed") return styles.statusIndexed;
  return styles.statusUploaded;
}

function fmtSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function AdminDocumentsPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [storageMode, setStorageMode] = useState<"supabase" | "local" | null>(null);
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);

  // form state
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<"en" | "hi" | "en_hi">("en");
  const [accessLevel, setAccessLevel] = useState<"public" | "internal" | "restricted">("public");
  const [supersedesId, setSupersedesId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const r = await api<{ categories: Category[]; storage_mode: "supabase" | "local" }>(
        "/api/v1/documents/categories",
      );
      setCategories(r.categories ?? []);
      setStorageMode(r.storage_mode ?? "local");
      if (r.categories?.[0] && !categorySlug) setCategorySlug(r.categories[0].slug);
    } catch {
      /* surfaced by doc load failure below */
    }
  }, [categorySlug]);

  const loadDocs = useCallback(async () => {
    try {
      const r = await api<{ documents: AdminDoc[] }>("/api/v1/admin/documents");
      setDocs(r.documents ?? []);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
    void loadDocs();
  }, [loadCategories, loadDocs]);

  // Poll while any document is processing (stage machine runs server-side)
  useEffect(() => {
    if (!docs.some((d) => PROCESSING.includes(d.status))) return;
    const t = setInterval(() => void loadDocs(), 2500);
    return () => clearInterval(t);
  }, [docs, loadDocs]);

  const stageFile = (f: File) => {
    if (!ACCEPTED_MIME.includes(f.type)) {
      toast.error(`"${f.name}" isn't a supported type. Use PDF, Word, PowerPoint, Excel, CSV, TXT, MD or HTML.`);
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error(`"${f.name}" is over 50 MB — split it first.`);
      return;
    }
    setFiles((prev) => (prev.length >= 10 ? prev : [...prev, f]));
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const resetForm = () => {
    setFiles([]);
    setTitle("");
    setDescription("");
    setSupersedesId(null);
  };

  /** Upload + process one file through whichever storage mode is active. */
  const uploadOne = async (file: File, docTitle: string): Promise<string | null> => {
    try {
      let documentId: string;

      if (storageMode === "supabase" && file.size > 4 * 1024 * 1024) {
        // Oversized file — two-phase signed-URL flow (browser PUTs directly to
        // Supabase, bypassing the Vercel ~4.5MB server body cap)
        const r = await api<{ document_id: string; upload_url?: string }>(
          "/api/v1/documents/upload",
          {
            method: "POST",
            body: JSON.stringify({
              title: docTitle,
              category_slug: categorySlug,
              description: description.trim() || undefined,
              language,
              access_level: accessLevel,
              supersedes_document_id: supersedesId,
              mime_type: file.type,
              size_bytes: file.size,
              filename: file.name,
            }),
          },
        );

        if (r.upload_url) {
          // Supabase signed-upload URLs respond to PUT (token is in the query string)
          const put = await fetch(r.upload_url, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!put.ok) throw new Error(`File transfer failed (${put.status}).`);
        }
        documentId = r.document_id;

        await api("/api/v1/documents/upload-complete", {
          method: "POST",
          body: JSON.stringify({ document_id: r.document_id }),
        });
      } else {
        // ≤4MB (or local mode) — single multipart request through our own
        // server: no browser→Supabase CORS, hash recorded server-side.
        const form = new FormData();
        form.append("file", file);
        form.append(
          "metadata",
          JSON.stringify({
            title: docTitle,
            category_slug: categorySlug,
            description: description.trim() || undefined,
            language,
            access_level: accessLevel,
            supersedes_document_id: supersedesId,
          }),
        );
        const r = await api<{ document_id: string }>("/api/v1/documents/upload", { method: "POST", body: form });
        documentId = r.document_id;
      }

      // Pipeline (parse → chunk → embed → index) — failure here still leaves
      // the row visible with a Retry button, so it's reported, not thrown.
      try {
        const p = await api<{ status: string; chunks?: number; embedded?: boolean; error?: string }>(
          `/api/v1/admin/documents/${documentId}/process`,
          { method: "POST", body: JSON.stringify({ document_id: documentId }) },
        );
        if (p.status === "indexed") {
          toast.success(`"${docTitle}" — ${p.chunks ?? 0} chunks${p.embedded ? ", embedded" : " (text-search only)"}.`);
        } else {
          toast.error(`"${docTitle}": ${p.error ?? "processing failed — see its row."}`);
        }
      } catch (err) {
        toast.error(`"${docTitle}": ${err instanceof Error ? err.message : "processing failed — see its row."}`);
      }
      return documentId;
    } catch (err) {
      toast.error(`"${file.name}": ${err instanceof Error ? err.message : "upload failed."}`);
      return null;
    }
  };

  /** Hard-delete a document (and every version sharing its canonicalId):
   *  chunks, vectors and the storage file are removed — cannot be undone. */
  const deleteDoc = async (d: AdminDoc) => {
    if (
      !window.confirm(
        `Delete "${d.title}" permanently?${d.version > 1 ? " All versions of this document go too." : ""} Chunks, vectors and the stored file are removed. This cannot be undone.`,
      )
    ) {
      return;
    }
    setActionBusy(d.id);
    try {
      const r = await api<{ deleted?: number; storage_errors?: string[] }>(`/api/v1/admin/documents/${d.id}`, { method: "DELETE" });
      toast.success(`"${d.title}" deleted${r.deleted && r.deleted > 1 ? ` (${r.deleted} rows)` : ""}.`);
      await loadDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setActionBusy(null);
    }
  };

  const submit = async () => {
    if (files.length === 0 || uploading) return;
    if (!title.trim() || !categorySlug) {
      toast.error("Add a title and pick a category first.");
      return;
    }
    setUploading(true);
    try {
      // Sequential: each file gets its own toast; one failure never stops the rest.
      for (let i = 0; i < files.length; i++) {
        const docTitle = files.length === 1 ? title.trim() : `${title.trim()} (${i + 1} of ${files.length})`;
        await uploadOne(files[i]!, docTitle);
      }
      await loadDocs();
      resetForm();
    } finally {
      setUploading(false);
    }
  };

  const process = async (id: string) => {
    setActionBusy(id);
    try {
      const r = await api<{ status: string; chunks?: number; embedded?: boolean; error?: string }>(
        `/api/v1/admin/documents/${id}/process`,
        { method: "POST", body: JSON.stringify({ document_id: id }) },
      );
      await loadDocs();
      if (r.status === "indexed") {
        toast.success(`Processed — ${r.chunks ?? 0} chunks${r.embedded ? ", embedded" : " (text-search only)"}.`);
      } else {
        toast.error(r.error ?? "Processing failed. Check the error on the document.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setActionBusy(null);
    }
  };

  const publish = async (id: string) => {
    setActionBusy(id);
    try {
      await api(`/api/v1/admin/documents/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ action: "publish" }),
      });
      await loadDocs();
      toast.success("Published — it now powers answers.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't publish.");
    } finally {
      setActionBusy(null);
    }
  };

  const reject = async (id: string) => {
    setActionBusy(id);
    try {
      await api(`/api/v1/admin/documents/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ action: "reject" }),
      });
      await loadDocs();
      toast.success("Rejected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reject.");
    } finally {
      setActionBusy(null);
    }
  };

  const newVersion = (d: AdminDoc) => {
    setSupersedesId(d.id);
    setTitle(`${d.title} (v${d.version + 1})`);
    setFiles([]);
    if (categories.length) setCategorySlug(categories.find((c) => c.name === d.categoryName)?.slug ?? categorySlug);
    window.scrollTo({ top: 0 });
  };

  // ---- Website sync ----
  const [syncUrl, setSyncUrl] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await api<{ url?: string }>("/api/v1/admin/sync");
        if (alive && r.url) setSyncUrl(r.url);
      } catch {
        /* empty default */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const saveSyncUrl = async () => {
    if (!syncUrl.trim()) return;
    try {
      await api("/api/v1/admin/sync", { method: "PUT", body: JSON.stringify({ url: syncUrl.trim() }) });
      toast.success("Sync URL saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the URL.");
    }
  };

  const runSync = async () => {
    if (syncing) return;
    if (!syncUrl.trim()) {
      toast.error("Enter the college website URL first.");
      return;
    }
    setSyncing(true);
    try {
      const r = await api<{ message?: string; new?: number; changed?: number; unchanged?: number; failed?: number }>(
        "/api/v1/admin/sync",
        { method: "POST", body: JSON.stringify({ url: syncUrl.trim() }) },
      );
      toast.success(r.message ?? "Sync complete.");
      await loadDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  // ---- Paste a notice ----
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [noticeBusy, setNoticeBusy] = useState(false);

  const submitNotice = async () => {
    if (noticeBusy) return;
    if (!noticeTitle.trim() || !noticeText.trim()) {
      toast.error("Add a title and paste the notice text.");
      return;
    }
    setNoticeBusy(true);
    try {
      // Upload path: construct a txt File through the standard multipart flow
      const file = new File([noticeText], `notice.txt`, { type: "text/plain" });
      const form = new FormData();
      form.append("file", file);
      form.append(
        "metadata",
        JSON.stringify({
          title: noticeTitle.trim(),
          category_slug: categorySlug || categories[0]?.slug,
          language,
          access_level: accessLevel,
        }),
      );
      const up = await api<{ document_id: string }>("/api/v1/documents/upload", { method: "POST", body: form });
      await api(`/api/v1/admin/documents/${up.document_id}/process`, {
        method: "POST",
        body: JSON.stringify({ document_id: up.document_id }),
      }).catch(() => undefined);
      await loadDocs();
      toast.success("Notice added to the queue.");
      setNoticeOpen(false);
      setNoticeTitle("");
      setNoticeText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add the notice.");
    } finally {
      setNoticeBusy(false);
    }
  };

  // Access control is enforced by the /admin layout + every API route
  // (canManageDocuments / canReviewDocuments — role-only). No client-side gate.

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <h1 className={styles.title}>Knowledge base</h1>
        <p className={styles.subtitle}>
          Upload the documents UPC AI cites — circulars, fee schedules, syllabi. Nothing reaches students without review.
        </p>

        <section className={styles.card} aria-label="College website sync">
          <h2 className={styles.cardTitle}>College website sync</h2>
          <p className={styles.note}>
            Crawls the college website (same domain, ≤ 30 pages + linked PDFs) and queues every new or changed page
            for your review — unchanged pages are skipped. Nothing publishes until you approve it.
          </p>
          <div className={styles.syncRow}>
            <input
              className={styles.input}
              value={syncUrl}
              onChange={(e) => setSyncUrl(e.target.value)}
              placeholder="https://www.udaipratapcollege.ac.in"
              type="url"
              aria-label="College website URL"
            />
            <button className={styles.actBtn} onClick={() => void saveSyncUrl()} type="button" disabled={!syncUrl.trim()}>
              Save URL
            </button>
            <button
              className={[styles.actBtn, styles.actBtnPrimary].join(" ")}
              onClick={() => void runSync()}
              disabled={syncing || !syncUrl.trim()}
              type="button"
            >
              {syncing ? "Syncing… (up to a minute)" : "Sync college website"}
            </button>
            <button className={styles.actBtn} onClick={() => setNoticeOpen(true)} type="button">
              + Paste a notice
            </button>
          </div>
        </section>

        <section className={styles.card} aria-label="Upload document">
          <h2 className={styles.cardTitle}>Upload a document</h2>
          <div className={styles.form}>
            {supersedesId && (
              <p className={styles.note}>
                Replacing an older version — publishing the new one will automatically supersede it.
              </p>
            )}
            <div className={styles.fileRow}>
              <button className={styles.attachBtn} onClick={() => fileInputRef.current?.click()} type="button">
                {files.length ? "Add more files" : "Choose files"}
              </button>
              {files.length === 0 ? (
                <span className={styles.status}>PDF, Word, PowerPoint, Excel, CSV, TXT, MD or HTML — up to 50 MB each, up to 10 files</span>
              ) : (
                <span className={styles.fileList}>
                  {files.map((f, i) => (
                    <span key={`${f.name}-${i}`} className={styles.fileChip}>
                      <span className={styles.fileChipName}>
                        {f.name} · {fmtSize(f.size)}
                      </span>
                      <button
                        className={styles.fileRemove}
                        onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Remove ${f.name}`}
                        type="button"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MIME.join(",")}
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) {
                    for (const f of Array.from(e.target.files)) stageFile(f);
                  }
                  e.target.value = "";
                }}
              />
            </div>

            <div className={styles.formRow}>
              <div>
                <label className={styles.label} htmlFor="doc-title">Title</label>
                <input
                  id="doc-title"
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. B.Sc. Computer Science Syllabus 2026"
                  maxLength={500}
                />
              </div>
              <div>
                <label className={styles.label} htmlFor="doc-category">Category</label>
                <select
                  id="doc-category"
                  className={styles.select}
                  value={categorySlug}
                  onChange={(e) => setCategorySlug(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.icon ? `${c.icon} ` : ""}{c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div>
                <label className={styles.label} htmlFor="doc-language">Language</label>
                <select
                  id="doc-language"
                  className={styles.select}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as typeof language)}
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी</option>
                  <option value="en_hi">English + हिंदी</option>
                </select>
              </div>
              <div>
                <label className={styles.label} htmlFor="doc-access">Access</label>
                <select
                  id="doc-access"
                  className={styles.select}
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as typeof accessLevel)}
                >
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>
            </div>

            <div>
              <label className={styles.label} htmlFor="doc-desc">Description (optional)</label>
              <textarea
                id="doc-desc"
                className={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this document cover?"
                maxLength={2000}
              />
            </div>

            <div className={styles.submitRow}>
              {supersedesId ? (
                <button className={styles.actBtn} onClick={() => setSupersedesId(null)} type="button">
                  Cancel replacement
                </button>
              ) : (
                <span className={styles.status} />
              )}
              <Button disabled={files.length === 0 || uploading} onClick={() => void submit()}>
                {uploading ? `Uploading ${files.length > 1 ? "files" : ""}…` : files.length > 1 ? `Upload ${files.length} files` : "Upload"}
              </Button>
            </div>
          </div>
        </section>

        <section className={styles.card} aria-label="Documents">
          <h2 className={styles.cardTitle}>Documents</h2>
          {!docsLoaded ? (
            <div className={styles.loading}>Loading documents…</div>
          ) : docs.length === 0 ? (
            <div className={styles.empty}>No documents yet. The first upload will appear here.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Status</th>
                    <th>Category</th>
                    <th>Chunks</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div className={styles.docTitle}>{d.title}</div>
                        <div className={styles.docMeta}>
                          {d.fileType?.toUpperCase()} · {fmtSize(d.fileSizeBytes)}
                          {d.version > 1 ? ` · v${d.version}` : ""}
                          {d.uploaderName ? ` · ${d.uploaderName}` : ""}
                        </div>
                        {d.processingError && <p className={styles.errorText}>{d.processingError}</p>}
                      </td>
                      <td>
                        <span className={[styles.statusChip, statusClass(d.status)].join(" ")}>
                          {statusLabel(d.status, d)}
                        </span>
                      </td>
                      <td>{d.categoryName ?? "—"}</td>
                      <td>{d.chunkCount ?? "—"}</td>
                      <td>{fmtDate(d.createdAt)}</td>
                      <td>
                        <div className={styles.rowActions}>
                        <a
                          className={styles.actBtn}
                          href={`/api/v1/documents/${d.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                          title="Open the original file in a new tab"
                        >
                          View
                        </a>
                        {(d.status === "uploaded" || FAILED.includes(d.status)) && (
                          <button
                            className={styles.actBtn}
                            onClick={() => void process(d.id)}
                            disabled={actionBusy === d.id || uploading}
                            type="button"
                          >
                            {FAILED.includes(d.status) ? "Retry" : "Process"}
                          </button>
                        )}
                          {d.status === "indexed" && (
                            <button
                              className={[styles.actBtn, styles.actBtnPrimary].join(" ")}
                              onClick={() => void publish(d.id)}
                              disabled={actionBusy === d.id}
                              type="button"
                            >
                              Publish
                            </button>
                          )}
                          {d.status === "indexed" && (
                            <button
                              className={[styles.actBtn, styles.actBtnDanger].join(" ")}
                              onClick={() => void reject(d.id)}
                              disabled={actionBusy === d.id}
                              type="button"
                            >
                              Reject
                            </button>
                          )}
                          {d.status === "published" && (
                            <button className={styles.actBtn} onClick={() => newVersion(d)} type="button">
                              New version
                            </button>
                          )}
                          <button
                            className={[styles.actBtn, styles.actBtnDanger].join(" ")}
                            onClick={() => void deleteDoc(d)}
                            disabled={actionBusy === d.id || uploading}
                            type="button"
                            title="Delete permanently — removes all versions, chunks, vectors and the stored file"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {noticeOpen && (
        <div className={styles.noticeOverlay} role="dialog" aria-modal="true" aria-label="Paste a notice">
          <div className={styles.noticeCard}>
            <h2 className={styles.cardTitle}>Paste a notice</h2>
            <p className={styles.note}>Quick circulars and announcements — no file needed. It enters the same review queue.</p>
            <label className={styles.label} htmlFor="notice-title">Title</label>
            <input
              id="notice-title"
              className={styles.input}
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
              placeholder="e.g. Exam form deadline extended"
              maxLength={500}
            />
            <label className={styles.label} htmlFor="notice-text">Notice text</label>
            <textarea
              id="notice-text"
              className={styles.textarea}
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              placeholder="Paste the full notice text here…"
              rows={6}
            />
            <div className={styles.noticeActions}>
              <button className={styles.actBtn} onClick={() => setNoticeOpen(false)} type="button">Cancel</button>
              <button
                className={[styles.actBtn, styles.actBtnPrimary].join(" ")}
                onClick={() => void submitNotice()}
                disabled={noticeBusy || !noticeTitle.trim() || !noticeText.trim()}
                type="button"
              >
                {noticeBusy ? "Adding…" : "Add to queue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
