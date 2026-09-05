"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ToastProvider } from "@upc/ui";
import { useAuth, logout, bootstrapAuth } from "@/lib/auth-store";
import { api } from "@/lib/api-client";
import styles from "./admin-panel.module.css";

// Module scope (same pattern as the chat layout) — without this, a direct
// load/refresh of /admin never restores the session from the refresh cookie.
bootstrapAuth();

const NAV = [
  { href: "/admin", label: "Overview", icon: "📊" },
  { href: "/admin/documents", label: "Documents", icon: "📄" },
  { href: "/admin/analytics", label: "Analytics", icon: "📈" },
  { href: "/admin/providers", label: "Providers & Models", icon: "🧠" },
  { href: "/admin/users", label: "Users", icon: "👥" },
];

type Gate = "checking" | "ok" | "denied";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();
  // Deterministic gate: children NEVER render until the server re-confirms
  // super_admin in the live token — no mid-flight tree swaps (those raced
  // React's DOM commit and crashed with removeChild-of-null in dev).
  const [gate, setGate] = useState<Gate>("checking");

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login?next=/admin");
      return;
    }
    if (status !== "authenticated") return; // still bootstrapping the session
    let alive = true;
    void (async () => {
      try {
        const me = await api<{ roles?: string[] }>("/api/v1/users/me");
        if (!alive) return;
        setGate((me.roles ?? []).includes("super_admin") ? "ok" : "denied");
      } catch {
        if (alive) setGate("denied");
      }
    })();
    return () => {
      alive = false;
    };
  }, [status, router]);

  if (gate !== "ok") {
    return (
      <div className={styles.splash}>
        {gate === "checking" ? (
          "Verifying admin access…"
        ) : (
          <span className={styles.deniedBox}>
            Admin access required.
            <Link href="/chat" className={styles.deniedLink}>Back to chat</Link>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/chat" className={styles.brand}>
          <span className={styles.brandMark}>U</span>
          <span className={styles.brandText}>UPC AI · Admin</span>
        </Link>
        <nav className={styles.nav}>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[styles.navItem, active ? styles.navItemActive : ""].join(" ")}
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.footer}>
          <Link href="/chat" className={styles.chatLink}>← Back to chat</Link>
          <button className={styles.logout} onClick={() => void logout().then(() => router.push("/login"))}>
            Log out
          </button>
        </div>
      </aside>
      <main className={styles.main}>
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  );
}
