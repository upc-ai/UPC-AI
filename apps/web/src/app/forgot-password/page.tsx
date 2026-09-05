"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@upc/ui";
import { api, ApiError } from "@/lib/api-client";
import { PasswordField } from "@/components/auth/PasswordField";
import styles from "../auth.module.css";

/**
 * Instagram-style forgot password: one page, two steps.
 * 1. Email → a 6-digit code is emailed (never shown on screen — Resend only;
 *    in console mode check the dev-server terminal).
 * 2. Code + new password → consumed, all sessions revoked, then login.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await api<{ message: string }>("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setInfo(r.message);
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), new_password: newPassword }),
      });
      router.replace("/login?reset=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.brand}>
        <span className={styles.brandMark}><LogoMark size={44} /></span>
        <blockquote className={styles.quote}>AI that knows your college as well as you do.</blockquote>
      </aside>
      <main className={styles.panel}>
        <form className={styles.form} onSubmit={step === "email" ? request : reset}>
          <span className={styles.logoLockup}><LogoMark size={26} /> UPC&nbsp;AI</span>
          <h1 className={styles.title}>{step === "email" ? "Forgot password" : "Enter your code"}</h1>

          {step === "email" ? (
            <>
              <p className={styles.hint}>
                Enter your account email — we&apos;ll send a 6-digit code to reset your password.
              </p>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                className={styles.input}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                required
              />
            </>
          ) : (
            <>
              <p className={styles.hint}>{info} Check your inbox (and spam). In local dev the code appears in the server terminal instead.</p>
              <label className={styles.label} htmlFor="code">6-digit code</label>
              <input
                id="code"
                className={styles.input}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                required
              />
              <label className={styles.label} htmlFor="new-password">New password</label>
              <PasswordField
                id="new-password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                inputClassName={styles.input}
              />
              <span className={styles.hint}>8+ characters with an uppercase letter, a lowercase letter, a digit, and a special character.</span>
              <label className={styles.label} htmlFor="confirm">Confirm new password</label>
              <PasswordField
                id="confirm"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                inputClassName={styles.input}
              />
            </>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button
            className={styles.submit}
            type="submit"
            disabled={loading || (step === "email" ? !email : !code || !newPassword || !confirm)}
          >
            {loading ? "Working…" : step === "email" ? "Send code" : "Set new password"}
          </button>

          <p className={styles.footer}>
            Remembered it? <a href="/login">Back to sign in</a>
          </p>
        </form>
      </main>
    </div>
  );
}
