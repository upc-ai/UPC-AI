"use client";

import { useEffect, useRef } from "react";

/**
 * Official Google Identity Services button. Renders Google's branded button,
 * returns a signed ID token to `onCredential`, which posts it to the backend.
 * Rendered only when NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured.
 */

interface GoogleAccounts {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
      }) => void;
      renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function GoogleButton({ onCredential, onError }: { onCredential: (idToken: string) => void; onError: (message: string) => void }) {
  const divRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const render = () => {
      if (!window.google || !divRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response.credential) callbackRef.current(response.credential);
          else onError("Google sign-in was cancelled");
        },
      });
      window.google.accounts.id.renderButton(divRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 300,
        logo_alignment: "left",
      });
    };

    const existing = document.getElementById("google-gsi-script");
    if (existing) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.id = "google-gsi-script";
    script.onload = render;
    script.onerror = () => onError("Couldn't load Google sign-in. Check your connection.");
    document.head.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Not configured → render nothing (login form stays clean; the real
  // Google-branded button appears the moment NEXT_PUBLIC_GOOGLE_CLIENT_ID is set).
  if (!GOOGLE_CLIENT_ID) return null;

  return <div ref={divRef} style={{ display: "flex", justifyContent: "center", minHeight: 44 }} />;
}
