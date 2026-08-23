"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { logout } from "@/lib/auth-store";
import { useToast } from "@upc/ui";
import styles from "./settings.module.css";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type Theme = "light" | "dark" | "system";
type Lang = "en" | "hi" | "en_hi" | "auto";
type Length = "concise" | "detailed" | "exhaustive";
type Difficulty = "beginner" | "intermediate" | "advanced";
type StudyMode = "learn" | "practice" | "explain_simply" | "challenge_me";

interface Preferences {
  theme: Theme;
  language: Lang;
  response_length: Length;
  difficulty: Difficulty;
  default_study_mode: StudyMode;
}

interface MeResponse {
  email?: string;
  display_name?: string;
  user_type?: string;
  preferences?: Omit<Preferences, "theme"> & { theme?: Theme } | null;
}

const DEFAULTS: Preferences = {
  theme: "light",
  language: "en",
  response_length: "detailed",
  difficulty: "intermediate",
  default_study_mode: "learn",
};

const THEME_STORAGE_KEY = "upcai:theme";

function resolveTheme(t: Theme): "light" | "dark" {
  if (t === "system") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return t;
}

function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = resolveTheme(t);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, t);
  } catch {
    /* private mode */
  }
}

/** The composer toggle speaks en|hi|auto — collapse the DB's en_hi into auto. */
function toDisplayLang(l: Lang): "en" | "hi" | "auto" {
  return l === "en" || l === "hi" ? l : "auto";
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                                */
/* ------------------------------------------------------------------ */

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={styles.seg} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          className={[styles.segBtn, o.value === value ? styles.segActive : ""].join(" ")}
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FieldRow({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {hint ? <span className={styles.rowHint}>{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [me, setMe] = useState<{ email?: string; display_name?: string; user_type?: string }>({});

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await api<MeResponse>("/api/v1/users/me");
        if (!alive) return;
        setMe({ email: r.email, display_name: r.display_name, user_type: r.user_type });
        if (r.preferences) {
          const next = { ...DEFAULTS, ...r.preferences, theme: r.preferences.theme ?? DEFAULTS.theme };
          setPrefs(next);
          applyTheme(next.theme);
        }
      } catch {
        /* defaults are fine */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = async (patch: Partial<Preferences>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
    if (patch.theme) applyTheme(patch.theme);
    try {
      await api("/api/v1/users/me/preferences", { method: "PUT", body: JSON.stringify(patch) });
    } catch {
      setPrefs((prev) => {
        const reverted = { ...prev };
        for (const k of Object.keys(patch) as (keyof Preferences)[]) delete (reverted as Record<string, unknown>)[k];
        return { ...DEFAULTS, ...reverted };
      });
      if (patch.theme) applyTheme(prefs.theme);
      toast.error("Couldn't save. Please try again.");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <h1 className={styles.title}>Settings</h1>

        <section className={styles.card} aria-label="Appearance">
          <h2 className={styles.cardTitle}>Appearance</h2>
          <FieldRow title="Theme" hint="Light is the default — pick what suits you">
            <Segmented<Theme>
              label="Theme"
              value={prefs.theme}
              onChange={(v) => void save({ theme: v })}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          </FieldRow>
        </section>

        <section className={styles.card} aria-label="Language">
          <h2 className={styles.cardTitle}>Language</h2>
          <FieldRow title="Default response language" hint="Used for new conversations">
            <Segmented<"en" | "hi" | "auto">
              label="Response language"
              value={toDisplayLang(prefs.language)}
              onChange={(v) => void save({ language: v })}
              options={[
                { value: "en", label: "English" },
                { value: "hi", label: "हिंदी" },
                { value: "auto", label: "Auto" },
              ]}
            />
          </FieldRow>
        </section>

        <section className={styles.card} aria-label="AI preferences">
          <h2 className={styles.cardTitle}>AI preferences</h2>
          <FieldRow title="Answer length">
            <select
              className={styles.select}
              value={prefs.response_length}
              onChange={(e) => void save({ response_length: e.target.value as Length })}
              aria-label="Answer length"
            >
              <option value="concise">Concise</option>
              <option value="detailed">Detailed</option>
              <option value="exhaustive">Exhaustive</option>
            </select>
          </FieldRow>
          <FieldRow title="Explanation level" hint="Assumed familiarity of the answers">
            <select
              className={styles.select}
              value={prefs.difficulty}
              onChange={(e) => void save({ difficulty: e.target.value as Difficulty })}
              aria-label="Explanation level"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </FieldRow>
          <FieldRow title="Default study mode" hint="Pre-selected on new chats">
            <select
              className={styles.select}
              value={prefs.default_study_mode}
              onChange={(e) => void save({ default_study_mode: e.target.value as StudyMode })}
              aria-label="Default study mode"
            >
              <option value="learn">Learn</option>
              <option value="practice">Practice</option>
              <option value="explain_simply">Explain Simply</option>
              <option value="challenge_me">Challenge Me</option>
            </select>
          </FieldRow>
          <p className={styles.note}>Changes apply from your next answer onwards.</p>
        </section>

        <section className={styles.card} aria-label="Account">
          <h2 className={styles.cardTitle}>Account</h2>
          <div className={styles.accountRows}>
            <FieldRow title="Name">
              <span className={styles.accountValue}>{me.display_name ?? "—"}</span>
            </FieldRow>
            <FieldRow title="Email">
              <span className={styles.accountValue}>{me.email ?? "—"}</span>
            </FieldRow>
            <FieldRow title="Role">
              <span className={styles.accountValue}>{me.user_type ?? "student"}</span>
            </FieldRow>
          </div>
          <button className={styles.logout} onClick={() => void logout().then(() => router.push("/login"))}>
            Log out
          </button>
        </section>

        {!loaded && <div className={styles.loading}>Loading settings…</div>}
      </div>
    </div>
  );
}
