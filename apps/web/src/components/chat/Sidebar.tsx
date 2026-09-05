"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { Button, Dialog, Input, LogoMark, useToast } from "@upc/ui";
import styles from "@/components/chat/chat.module.css";

export interface SessionSummary {
  id: string;
  title: string | null;
  lastMessageAt: string | null;
  isPinned: boolean;
}

interface Group {
  label: string;
  items: SessionSummary[];
}

function groupSessions(sessions: SessionSummary[]): Group[] {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const pinned = sessions.filter((s) => s.isPinned);
  const groups: Record<string, SessionSummary[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };
  for (const s of sessions) {
    if (s.isPinned) continue;
    const t = s.lastMessageAt ? new Date(s.lastMessageAt).getTime() : 0;
    const age = startOfDay - t;
    if (t >= startOfDay) groups.Today!.push(s);
    else if (age < 86_400_000) groups.Yesterday!.push(s);
    else if (age < 7 * 86_400_000) groups["Previous 7 days"]!.push(s);
    else groups.Older!.push(s);
  }
  return [
    ...(pinned.length ? [{ label: "Pinned", items: pinned }] : []),
    ...Object.entries(groups)
      .filter(([, items]) => items.length > 0)
      .map(([label, items]) => ({ label, items })),
  ];
}

export function Sidebar({
  collapsed,
  mobileOpen = false,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  mobileOpen?: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [renaming, setRenaming] = useState<SessionSummary | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleting, setDeleting] = useState<SessionSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (offset = 0) => {
    try {
      const r = await api<{ sessions: SessionSummary[]; has_more?: boolean }>(
        `/api/v1/chat/sessions?offset=${offset}`,
      );
      setSessions((prev) => (offset === 0 ? r.sessions ?? [] : [...prev, ...(r.sessions ?? [])]));
      setHasMore(Boolean(r.has_more));
    } catch {
      if (offset === 0) setSessions([]);
    }
  }, []);

  useEffect(() => {
    void load(0);
  }, [pathname, load]);

  // Close the open item menu on outside click / Escape / sidebar scroll
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuFor(null);
    };
    const onScroll = () => setMenuFor(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // capture: scroll doesn't bubble, but capture catches the history list
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [menuFor]);

  const patchSession = async (id: string, body: Record<string, unknown>) => {
    await api(`/api/v1/chat/sessions/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    await load(0);
  };

  const togglePin = async (s: SessionSummary) => {
    const next = !s.isPinned;
    // Optimistic: move it immediately, then confirm with the server
    setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, isPinned: next } : x)));
    try {
      await patchSession(s.id, { is_pinned: next });
      toast.success(next ? "Pinned to top" : "Unpinned");
    } catch {
      // Roll back on failure
      setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, isPinned: s.isPinned } : x)));
      toast.error("Couldn't update the conversation.");
    }
  };

  const confirmRename = async () => {
    if (!renaming || !renameTitle.trim() || busy) return;
    setBusy(true);
    try {
      await patchSession(renaming.id, { title: renameTitle.trim() });
      setRenaming(null);
    } catch {
      toast.error("Couldn't rename the conversation.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || busy) return;
    const target = deleting;
    setBusy(true);
    try {
      await api(`/api/v1/chat/sessions/${target.id}`, { method: "DELETE" });
      setDeleting(null);
      await load(0);
      if (pathname === `/chat/${target.id}`) router.push("/chat");
    } catch {
      toast.error("Couldn't delete the conversation.");
    } finally {
      setBusy(false);
    }
  };

  const groups = groupSessions(sessions);
  const initials = (user?.display_name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className={[styles.sidebar, collapsed ? styles.sidebarCollapsed : "", mobileOpen ? styles.sidebarOpen : ""].join(" ")} aria-label="Chat history">
      <div className={styles.sidebarHeader}>
        {!collapsed && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--app-ink)", fontSize: 15, fontWeight: 500 }}>
            <LogoMark size={18} />
            UPC&nbsp;AI
          </span>
        )}
        <button
          className={styles.collapseBtn}
          onClick={onToggle}
          aria-label={mobileOpen ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {mobileOpen ? (
              <path d="M18 6 6 18M6 6l12 12" />
            ) : collapsed ? (
              <path d="m9 18 6-6-6-6" />
            ) : (
              <path d="m15 18-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

      <button
        className={styles.newChatBtn}
        onClick={() => {
          router.push("/chat");
          onNavigate?.();
        }}
      >
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        {!collapsed && "New Chat"}
      </button>

      {!collapsed && (
        <nav className={styles.history} aria-label="Sessions">
          {groups.map((g) => (
            <div key={g.label}>
              <div className={styles.historyGroup}>{g.label}</div>
              {g.items.map((s) => {
                const active = pathname === `/chat/${s.id}`;
                return (
                  <div key={s.id} className={styles.historyRow}>
                    <button
                      className={[styles.historyItem, active ? styles.historyItemActive : ""].join(" ")}
                      onClick={() => {
                        router.push(`/chat/${s.id}`);
                        onNavigate?.();
                      }}
                    >
                      <span>{s.title ?? "New conversation"}</span>
                    </button>
                    <div className={styles.rowMenuWrap} ref={menuFor === s.id ? menuRef : null}>
                      <button
                        className={styles.kebabBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (menuFor === s.id) {
                            setMenuFor(null);
                            return;
                          }
                          // Anchor the dropdown to the kebab in viewport space —
                          // fixed positioning keeps it unclipped by the history
                          // scroller and clear of the rows beneath.
                          const MENU_W = 138;
                          const MENU_H = 118;
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const left = Math.max(8, Math.min(rect.right - MENU_W, window.innerWidth - MENU_W - 8));
                          let top = rect.bottom + 6;
                          if (top + MENU_H > window.innerHeight - 8) {
                            top = Math.max(8, rect.top - MENU_H - 6); // near the bottom: flip upward
                          }
                          setMenuPos({ top, left });
                          setMenuFor(s.id);
                        }}
                        aria-label={`Options for ${s.title ?? "conversation"}`}
                        aria-haspopup="menu"
                        aria-expanded={menuFor === s.id}
                      >
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
                        </svg>
                      </button>
                      {menuFor === s.id && menuPos && (
                        <div
                          className={styles.itemMenu}
                          role="menu"
                          style={{ top: menuPos.top, left: menuPos.left }}
                        >
                          <button
                            role="menuitem"
                            className={styles.menuItem}
                            onClick={() => {
                              setRenaming(s);
                              setRenameTitle(s.title ?? "");
                              setMenuFor(null);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            role="menuitem"
                            className={styles.menuItem}
                            onClick={() => {
                              void togglePin(s);
                              setMenuFor(null);
                            }}
                          >
                            {s.isPinned ? "Unpin" : "Pin"}
                          </button>
                          <button
                            role="menuitem"
                            className={[styles.menuItem, styles.menuItemDanger].join(" ")}
                            onClick={() => {
                              setDeleting(s);
                              setMenuFor(null);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {groups.length === 0 && (
            <div className={styles.historyGroup} style={{ textTransform: "none", letterSpacing: 0, fontSize: 12.5 }}>
              Your conversations will appear here.
            </div>
          )}
          {hasMore && (
            <button className={styles.loadMoreBtn} onClick={() => void load(sessions.length)}>
              Load older conversations
            </button>
          )}
        </nav>
      )}

      <div className={styles.sidebarFooter}>
        {!collapsed && (
          <span className={styles.userChip}>
            <span className={styles.avatar}>{initials}</span>
            <span>{user?.display_name ?? "Student"}</span>
          </span>
        )}
        {(user?.user_type === "faculty" || user?.user_type === "admin") && (
          <button
            className={[styles.logoutBtn, pathname.startsWith("/admin") ? styles.historyItemActive : ""].join(" ")}
            onClick={() => {
              router.push("/admin");
              onNavigate?.();
            }}
            aria-label="Admin panel"
            title="Admin panel"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </button>
        )}
        <button
          className={[styles.logoutBtn, pathname === "/chat/settings" ? styles.historyItemActive : ""].join(" ")}
          onClick={() => {
            router.push("/chat/settings");
            onNavigate?.();
          }}
          aria-label="Settings"
          title="Settings"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      <Dialog open={renaming !== null} onClose={() => setRenaming(null)} title="Rename conversation">
        <Input
          value={renameTitle}
          onChange={(e) => setRenameTitle(e.target.value)}
          placeholder="Conversation name"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") void confirmRename();
          }}
        />
        <div className={styles.dialogActions}>
          <Button variant="secondary" size="sm" onClick={() => setRenaming(null)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!renameTitle.trim() || busy} onClick={() => void confirmRename()}>
            Save
          </Button>
        </div>
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Delete conversation?">
        <p className={styles.dialogText}>This can&apos;t be undone. The conversation will be removed from your history.</p>
        <div className={styles.dialogActions}>
          <Button variant="secondary" size="sm" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void confirmDelete()}>
            Delete
          </Button>
        </div>
      </Dialog>
    </aside>
  );
}
