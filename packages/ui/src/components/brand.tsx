/** UPC AI brand — the geometric "U" mark (three constructed strokes, floating right arm). */

export interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * The UPC AI mark: a built-letter "U" — a full-height pillar stem, a floating
 * right arm, and a base bar tucked flush under the right edge. Uniform 120px
 * strokes, even 60px air-gaps, optically centered in a 1024 viewBox.
 * Renders in currentColor: ink on light surfaces, white on dark, accent when tinted.
 */
export function LogoMark({ size = 20, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="272" y="212" width="120" height="600" />
      <rect x="632" y="212" width="120" height="420" />
      <rect x="452" y="692" width="300" height="120" />
    </svg>
  );
}

/** Lockup: mark + "UPC AI" wordmark. */
export function Wordmark({ size = 20, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-body)",
        fontSize: size,
        fontWeight: 500,
        color: dark ? "var(--on-dark)" : "var(--ink)",
      }}
    >
      <LogoMark size={size} />
      UPC&nbsp;AI
    </span>
  );
}
