"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "primary-accessible" | "secondary" | "secondary-on-dark" | "text" | "icon";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

/**
 * Warm-editorial button. Press states only — no hover styling (Design System v2.0 §5.2).
 * `primary` = coral #cc785c (marketing); `primary-accessible` = #a9583e (AA-strict contexts).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, ...rest },
  ref,
) {
  const classes = [styles.button, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      aria-disabled={disabled || loading || undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className={styles.loader} aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  );
});
