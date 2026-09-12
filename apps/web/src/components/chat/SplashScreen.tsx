"use client";

import { LogoMark } from "@upc/ui";
import { ThinkingOrb } from "thinking-orbs";
import styles from "@/components/chat/chat.module.css";

/**
 * Splash screen — the app-open moment (WhatsApp/ChatGPT/Claude pattern).
 * The U-mark sits at the center of a slowly breathing thought-orb while the
 * session restores over the network; `leaving` cross-fades it out (240ms).
 * Motion: transform+opacity only, reduced-motion respected (orb freezes).
 */
export function SplashScreen({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      className={[styles.splash, leaving ? styles.splashLeaving : ""].join(" ")}
      role="status"
      aria-label="UPC AI is starting"
    >
      <span className={styles.splashMark}>
        <span className={styles.splashLogo}>
          <LogoMark size={24} />
        </span>
        <ThinkingOrb state="breathing" size={64} aria-hidden="true" />
      </span>
      <span className={styles.splashWord}>UPC AI</span>
    </div>
  );
}
