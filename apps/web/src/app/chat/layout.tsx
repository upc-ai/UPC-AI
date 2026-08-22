"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ToastProvider } from "@upc/ui";
import { bootstrapAuth, useAuth } from "@/lib/auth-store";
import { Sidebar } from "@/components/chat/Sidebar";
import { SplashScreen } from "@/components/chat/SplashScreen";
import styles from "@/components/chat/chat.module.css";

bootstrapAuth();

/** Authenticated app shell for the chat workspace: splash → sidebar + content. */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Below 900px the sidebar is an overlay drawer: the desktop "collapsed"
  // 64px rail must never apply there (it showed up as a thin icon strip
  // that took extra taps to dismiss on phones).
  const [isMobile, setIsMobile] = useState(false);
  // Splash stays mounted through its 240ms fade once auth resolves
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const sync = () => {
      setIsMobile(mq.matches);
      if (mq.matches) setDrawerOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (status === "anonymous") router.replace("/login?next=/chat");
  }, [status, router]);

  useEffect(() => {
    if (status !== "loading" && !splashDone) {
      const t = setTimeout(() => setSplashDone(true), 260);
      return () => clearTimeout(t);
    }
  }, [status, splashDone]);

  // Apply the user's saved theme (settings page persists it; dark is the default)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("upcai:theme");
      if (saved === "light" || saved === "dark") {
        document.documentElement.dataset.theme = saved;
      } else if (saved === "system") {
        document.documentElement.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
    } catch {
      /* private mode — keep the dark default */
    }
  }, []);

  if (status === "loading" || !splashDone) {
    return <SplashScreen leaving={status !== "loading"} />;
  }

  if (status === "anonymous") return null;

  return (
    <ToastProvider>
      <div className={styles.shell}>
        <Sidebar
          collapsed={collapsed && !isMobile}
          mobileOpen={drawerOpen}
          onToggle={() => {
            if (isMobile) setDrawerOpen(false);
            else setCollapsed((v) => !v);
          }}
          onNavigate={() => setDrawerOpen(false)}
        />
        {drawerOpen && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(20,20,19,0.5)", zIndex: 199 }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, position: "relative" }}>
          <button
            className={styles.menuBtn}
            style={{ position: "absolute", top: 10, left: 10, zIndex: 60 }}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          {children}
        </div>
      </div>
    </ToastProvider>
  );
}
