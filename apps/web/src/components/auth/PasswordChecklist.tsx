"use client";

import { PASSWORD_RULES } from "@upc/core";
import styles from "./PasswordChecklist.module.css";

/**
 * Live password requirements shown while typing (signup, reset, change).
 * Mandatory rules must pass; the special-character rule is recommended only
 * (marked "optional") and never blocks submission.
 */
export function PasswordChecklist({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className={styles.list} aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password);
        return (
          <li key={rule.id} className={[styles.item, passed ? styles.ok : rule.optional ? styles.pendingOptional : styles.pending].join(" ")}>
            <span aria-hidden="true">{passed ? "✓" : rule.optional ? "○" : "•"}</span>
            {rule.label}
            {rule.optional && !passed ? <span className={styles.optionalTag}> (optional)</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
