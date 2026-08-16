"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  durationMs?: number; // default 4000; errors 8000
}

interface ToastItem extends Required<Omit<ToastOptions, "variant">> {
  id: number;
  variant: ToastVariant;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Imperative toasts, owned solely by this provider (Frontend Architecture v1.1). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useMemo(() => ({ current: 0 }), []);

  const push = useCallback((variant: ToastVariant, message: string) => {
    const id = ++counter.current;
    const durationMs = variant === "error" ? 8000 : 4000;
    setToasts((prev) => [...prev.slice(-2), { id, message, variant, durationMs }]); // max 3
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, [counter]);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      warning: (m) => push("warning", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.stack} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={[styles.toast, styles[t.variant]].join(" ")} role="status">
            <p className={styles.message}>{t.message}</p>
            <div className={styles.progress} style={{ animationDuration: `${t.durationMs}ms` }} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
