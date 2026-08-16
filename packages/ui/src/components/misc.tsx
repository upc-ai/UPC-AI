import styles from "./misc.module.css";

export interface SpinnerProps {
  size?: 16 | 20 | 24 | 32;
  label?: string;
}

/** Spinner: muted ring with accent arc; allowed under reduced motion. */
export function Spinner({ size = 20, label = "Loading" }: SpinnerProps) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 10)) }}
      role="status"
      aria-label={label}
    />
  );
}

export interface SkeletonProps {
  variant?: "text" | "rect" | "circle";
  width?: string | number;
  height?: string | number;
}

/** Skeleton placeholder — static under reduced motion via tokens. */
export function Skeleton({ variant = "text", width, height }: SkeletonProps) {
  return (
    <span
      className={[styles.skeleton, styles[variant]].join(" ")}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
