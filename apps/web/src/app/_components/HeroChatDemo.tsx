"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@upc/ui";
import { ThinkingOrb } from "thinking-orbs";
import BorderBeam from "border-beam";
import styles from "../landing.module.css";

/**
 * Hero chat demo — a looping, CSS-light recreation of the real streaming UX:
 * user question → thought-orb "Thinking…" → streamed answer lines → the one
 * official-source chip (matching the product's real citation policy).
 * The UPC AI "U" mark is the greeting/thinking marker. Styling + entrance
 * animations live in landing.module.css (this file consumes them via styles.*).
 */
export function HeroChatDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStep(1), 600), // user question
      window.setTimeout(() => setStep(2), 1500), // thinking orb
      window.setTimeout(() => setStep(3), 2800), // answer line 1
      window.setTimeout(() => setStep(4), 3600), // answer line 2
      window.setTimeout(() => setStep(5), 4400), // official source chip
      window.setTimeout(() => setStep(0), 11500), // reset loop
    ];
    return () => timers.forEach(clearTimeout);
  }, [step === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: "relative" }}>
      <BorderBeam size="line" colorVariant="mono">
        <div className={styles.mockup} data-testid="hero-mockup">
          <div className={styles.mockupBar}>
            <span className={styles.mockupDot} />
            <span className={styles.mockupDot} />
            <span className={styles.mockupDot} />
            <span className={styles.mockupTitle}>upcai.app</span>
          </div>

          {step >= 1 && (
            <div className={styles.mockupUser}>
              What is the BSc CS fee structure for 2nd year?
            </div>
          )}

          {step === 2 && (
            <div className={styles.mockupStatus} role="img" aria-label="UPC AI is thinking">
              <ThinkingOrb state="working" size={20} theme="dark" aria-hidden="true" />
              <span className={styles.shimmer}>Thinking…</span>
            </div>
          )}

          {step >= 3 && (
            <div className={styles.mockupAnswer}>
              <span className={styles.line}>
                Tuition: <strong>₹15,000</strong> per semester <em>[1]</em>
              </span>
              {step >= 4 && (
                <span className={styles.line}>
                  Library: ₹2,000 · Lab: ₹3,000 <em>[2]</em>
                </span>
              )}
            </div>
          )}

          {step >= 5 && (
            <div className={styles.mockupSources}>
              <LogoMark size={13} />
              Udai Pratap College — Official Website
            </div>
          )}
        </div>
      </BorderBeam>
    </div>
  );
}
