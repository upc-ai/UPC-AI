"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoMark } from "@upc/ui";
import { api } from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";
import styles from "../auth.module.css";

const DEV_HINT_KEY = "upcai:devotp";

/**
 * Email verification: enter the 6-digit code we sent. In dev (console mail)
 * the code is surfaced on-screen so the flow is testable without SMTP; with a
 * real mail provider only the email ever contains it.
 */
export function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    try {
      const hint = sessionStorage.getItem(DEV_HINT_KEY);
      if (hint) {
        setDevHint(hint);
        sessionStorage.removeItem(DEV_HINT_KEY);
      }
    } catch {
      /* private mode */
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || code.length !== 6 || loading) return;
    setError(null);
    setLoading(true);
    try {
      await api(
        "/api/v1/auth/otp/request",
        { method: "PUT", body: JSON.stringify({ email, otp: code, purpose: "email_verify" }) },
        { skipAuth: true },
      );
      setVerified(true);
      // Brief confirmation, then into the app
      setTimeout(() => router.replace("/chat"), 800);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    try {
      const r = await api<{ message: string; dev_otp?: string }>(
        "/api/v1/auth/otp/request",
        { method: "POST", body: JSON.stringify({ email, purpose: "email_verify" }) },
        { skipAuth: true },
      );
      setNotice(r.message);
      if (r.dev_otp) setDevHint(r.dev_otp);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't resend the code. Please try again.");
    }
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.brand}>
        <span className={styles.brandMark}><LogoMark size={44} /></span>
        <blockquote className={styles.quote}>One code, and you're part of UPC AI.</blockquote>
      </aside>
      <main className={styles.panel}>
        <form className={styles.form} onSubmit={submit}>
          <span className={styles.logoLockup}><LogoMark size={26} /> UPC&nbsp;AI</span>
          <h1 className={styles.title}>Verify your email</h1>

          {verified ? (
            <p className={styles.terms} style={{ justifyContent: "center", margin: "8px 0" }}>
              ✅ Verified — taking you in…
            </p>
          ) : (
            <>
              <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 4px" }}>
                We sent a 6-digit code to
                <br />
                <strong style={{ color: "var(--ink)" }}>{email || "your email"}</strong>
              </p>

              {devHint && (
                <p className={styles.error} style={{ background: "var(--surface-card)", color: "var(--body)" }} role="note">
                  Dev mode — your code: <strong>{devHint}</strong>
                </p>
              )}

              <label className={styles.label} htmlFor="otp">6-digit code</label>
              <input
                id="otp"
                className={styles.input}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                maxLength={6}
                style={{ textAlign: "center", fontSize: 22, letterSpacing: "0.4em", fontFamily: "var(--font-mono)" }}
                required
                autoFocus
              />

              {error && <p className={styles.error} role="alert">{error}</p>}
              {notice && (
                <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }} role="status">
                  {notice}
                </p>
              )}

              <button className={styles.submit} type="submit" disabled={loading || code.length !== 6 || !email}>
                {loading ? "Verifying…" : "Verify"}
              </button>

              <p className={styles.footer}>
                Didn't get the code?{" "}
                <button type="button" onClick={() => void resend()} style={{ background: "none", border: "none", color: "var(--link)", cursor: "pointer", font: "inherit", padding: 0 }}>
                  Resend
                </button>
              </p>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
