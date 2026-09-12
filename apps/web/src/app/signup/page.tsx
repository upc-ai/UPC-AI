"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@upc/ui";
import { bootstrapAuth, registerAccount, loginWithGoogle, useAuth } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";
import { GoogleButton, GOOGLE_CLIENT_ID } from "@/components/auth/GoogleButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import styles from "../auth.module.css";

bootstrapAuth();

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Too weak", "Weak", "Fair", "Strong", "Very strong"] as const;
  const colors = ["var(--error)", "var(--error)", "var(--warning)", "var(--success)", "var(--success)"];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score]!, color: colors[score]! };
}

export default function SignupPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState<"student" | "faculty">("student");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  // Already signed in? Skip the form — same validated client-side redirect
  // the login page uses (never middleware: a dead cookie must not loop here).
  useEffect(() => {
    if (status === "authenticated") router.replace("/chat");
  }, [status, router]);

  const googleSignup = async (idToken: string) => {
    setError(null);
    try {
      await loginWithGoogle(idToken); // backend creates the account on first Google sign-in
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Google sign-up failed. Please try again.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Locked policy: letter+number mandatory, symbol RECOMMENDED but must NOT
    // block (score 3 = 8+ chars, upper+lower, digit). The checklist shows the
    // symbol rule as "(optional)".
    if (password !== "" && strength.score < 3) {
      setError("Password needs 8+ characters with an uppercase letter, a lowercase letter and a digit. A symbol is recommended but optional.");
      return;
    }
    setLoading(true);
    try {
      const emailNorm = email.trim().toLowerCase();
      const { devOtp } = await registerAccount({ email: emailNorm, password, displayName: displayName.trim(), userType });
      // Email verification step before entering the app (dev-mode code shown
      // on the verify screen; with real mail it only lives in the inbox)
      try {
        sessionStorage.setItem("upcai:devotp", devOtp ?? "");
      } catch {
        /* private mode */
      }
      router.replace(`/verify?email=${encodeURIComponent(emailNorm)}`);
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
        <blockquote className={styles.quote}>Every answer, cited. Every doubt, solved.</blockquote>
      </aside>
      <main className={styles.panel}>
        <form className={styles.form} onSubmit={submit}>
          <span className={styles.logoLockup}><LogoMark size={26} /> UPC&nbsp;AI</span>
          <h1 className={styles.title}>Create your account</h1>

          {GOOGLE_CLIENT_ID && (
            <>
              <div style={{ marginTop: 18 }}>
                <GoogleButton onCredential={(t) => void googleSignup(t)} onError={setError} />
              </div>
              <div className={styles.divider}><span /> or sign up with email <span /></div>
            </>
          )}

          <div className={styles.userTypeCards} role="radiogroup" aria-label="I am a">
            {(["student", "faculty"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={userType === t}
                className={[styles.typeCard, userType === t ? styles.typeCardActive : ""].join(" ")}
                onClick={() => setUserType(t)}
              >
                {t === "student" ? "🎓 Student" : "🏛 Faculty"}
              </button>
            ))}
          </div>

          <label className={styles.label} htmlFor="name">Full name</label>
          <input id="name" className={styles.input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} autoComplete="name" />

          <label className={styles.label} htmlFor="email">Email</label>
          <input id="email" className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" required autoComplete="email" />

          <label className={styles.label} htmlFor="password">Password</label>
          <PasswordField
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
            inputClassName={styles.input}
          />
          {password && (
            <>
              <div className={styles.strengthBar} aria-hidden="true">
                <div className={styles.strengthFill} style={{ width: `${(strength.score / 4) * 100}%`, background: strength.color }} />
              </div>
              <span style={{ fontSize: 12, color: strength.color }}>{strength.label}</span>
              <PasswordChecklist password={password} />
            </>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}

          <label className={styles.terms}>
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
            <span>I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a></span>
          </label>

          <button className={styles.submit} type="submit" disabled={loading || !terms || !displayName || !email || !password}>
            {loading ? "Creating account…" : "Create Account"}
          </button>

          <p className={styles.footer}>
            Already have an account? <a href="/login">Sign in</a>
          </p>
        </form>
      </main>
    </div>
  );
}
