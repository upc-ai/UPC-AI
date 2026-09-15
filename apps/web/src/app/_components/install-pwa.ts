"use client";

import { useEffect, useState } from "react";

/**
 * Install App control — native Chrome flow only. Captures beforeinstallprompt,
 * hides once installed, 14-day cooldown on dismissal, honest iOS fallback
 * (Share → Add to Home Screen). Never imitates browser/OS UI.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const COOLDOWN_KEY = "upcai:pwa-dismissed";
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0);
    return Date.now() - at < COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function useInstallPwa() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true); // hidden until proven installable
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setReady(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (recentlyDismissed()) return;
      setDeferred(e as BeforeInstallPromptEvent);
      setInstalled(false);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      try {
        localStorage.removeItem(COOLDOWN_KEY);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "dismissed") {
      try {
        localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    }
    setDeferred(null);
    return outcome === "accepted";
  };

  const dismiss = () => {
    try {
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDeferred(null);
  };

  const iosHint = ready && !installed && isIos();
  return { canInstall: !!deferred, install, dismiss, installed, iosHint, ready };
}
