"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import styles from "./footer-prefs.module.css";

/**
 * Footer preference controls (Cursor-style): theme pills (System/Light/Dark)
 * + response-language selector (English/हिन्दी). Both write the exact keys the
 * app already reads — `upcai:theme` in localStorage + data-theme on <html>
 * for theme, `upcai:lang` + the preferences API for language.
 */

type ThemeChoice = "system" | "light" | "dark";
type Lang = "en" | "hi";

function applyTheme(choice: ThemeChoice) {
  const resolved =
    choice === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : choice;
  document.documentElement.dataset.theme = resolved;
  try {
    localStorage.setItem("upcai:theme", choice);
  } catch {
    /* private mode */
  }
}

function currentTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem("upcai:theme");
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    /* private mode */
  }
  return "system";
}

function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>("system");

  useEffect(() => setTheme(currentTheme()), []);

  const pick = (choice: ThemeChoice) => {
    setTheme(choice);
    applyTheme(choice);
  };

  return (
    <div className={styles.themeGroup} role="group" aria-label="Theme">
      <button
        className={theme === "system" ? styles.themeBtnActive : styles.themeBtn}
        onClick={() => pick("system")}
        aria-label="System theme"
        aria-pressed={theme === "system"}
        title="System"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      </button>
      <button
        className={theme === "light" ? styles.themeBtnActive : styles.themeBtn}
        onClick={() => pick("light")}
        aria-label="Light theme"
        aria-pressed={theme === "light"}
        title="Light"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </button>
      <button
        className={theme === "dark" ? styles.themeBtnActive : styles.themeBtn}
        onClick={() => pick("dark")}
        aria-label="Dark theme"
        aria-pressed={theme === "dark"}
        title="Dark"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      </button>
    </div>
  );
}

function LanguageSelect() {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("upcai:lang");
      if (saved === "hi" || saved === "en") setLang(saved);
    } catch {
      /* private mode */
    }
  }, []);

  const change = (next: Lang) => {
    setLang(next);
    try {
      localStorage.setItem("upcai:lang", next);
    } catch {
      /* private mode */
    }
    // Logged in? Persist as the chat response-language preference. Silent on
    // failure — logged-out visitors just keep the localStorage default.
    void api("/api/v1/users/me/preferences", {
      method: "PUT",
      body: JSON.stringify({ language: next }),
    }).catch(() => undefined);
  };

  return (
    <label className={styles.langWrap} aria-label="Response language">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
      </svg>
      <select
        className={styles.langSelect}
        value={lang}
        onChange={(e) => change(e.target.value as Lang)}
      >
        <option value="en">English</option>
        <option value="hi">हिन्दी</option>
      </select>
      <svg className={styles.langChevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}

export function FooterPrefs() {
  return (
    <div className={styles.footerPrefs}>
      <ThemeToggle />
      <LanguageSelect />
    </div>
  );
}
