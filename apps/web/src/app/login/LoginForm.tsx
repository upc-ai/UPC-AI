"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoMark } from "@upc/ui";
import { bootstrapAuth, loginWithPassword, loginWithGoogle, useAuth } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";
import { GoogleButton, GOOGLE_CLIENT_ID } from "@/components/auth/GoogleButton";
import { PasswordField } from "@/components/auth/PasswordField";
import styles from "../auth.module.css";

bootstrapAuth();

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/chat";
  const { status } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, router, next]);

  const googleLogin = async (idToken: string) => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle(idToken);
      router.replace(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await loginWithPassword(email.trim().toLowerCase(), password);
      // Unverified accounts verify before entering the app
      if (user.is_verified === false) {
        router.replace(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      } else {
        router.replace(next);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connection error. Please try again.");
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
        <form className={styles.form} onSubmit={submit}>
          <span className={styles.logoLockup}><LogoMark size={26} /> UPC&nbsp;AI</span>
          <h1 className={styles.title}>Welcome back</h1>

          {GOOGLE_CLIENT_ID && (
            <>
              <div style={{ marginTop: 18 }}>
                <GoogleButton onCredential={(t) => void googleLogin(t)} onError={setError} />
              </div>
              <div className={styles.divider}><span /> or <span /></div>
            </>
          )}

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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <label className={styles.label} htmlFor="password">Password</label>
            <a href="/forgot-password" className={styles.forgotLink}>Forgot password?</a>
          </div>
          <PasswordField
            id="password"
            value={password}
            onChange={setPassword}
            inputClassName={styles.input}
          />

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button className={styles.submit} type="submit" disabled={loading || !email || !password}>
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <p className={styles.footer}>
            Don&apos;t have an account? <a href="/signup">Sign up</a>
          </p>
        </form>
      </main>
    </div>
  );
}
