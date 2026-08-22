"use client";

import { LogoMark } from "@upc/ui";
import styles from "@/components/chat/chat.module.css";

/**
 * Splash screen — the app-open moment (WhatsApp/ChatGPT/Claude pattern).
 * The U-mark and wordmark breathe in sync while the session restores over
 * the network; `leaving` cross-fades it out (240ms) once the app is ready.
 * Motion: transform+opacity only, 1.6s cycle, reduced-motion respected.
 */
export function SplashScreen({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      className={[styles.splash, leaving ? styles.splashLeaving : ""].join(" ")}
      role="status"
      aria-label="UPC AI is starting"
    >
      <span className={styles.splashMark}>
        <LogoMark size={44} />
      </span>
      <span className={styles.splashWord}>UPC AI</span>
    </div>
  );
}
