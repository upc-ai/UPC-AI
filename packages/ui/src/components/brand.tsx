/** UPC AI sparkle mark — four-pointed star, rendered as inline SVG. */
export function Sparkle({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 1.5c.35 3.9 1.6 6.9 3.4 8.7 1.8 1.8 4.8 3.05 8.6 3.4v1.8c-3.8.35-6.8 1.6-8.6 3.4-1.8 1.8-3.05 4.8-3.4 8.7h-1.8c-.35-3.9-1.6-6.9-3.4-8.7C5 18.15 2 16.9-1.8 16.55v-1.8c3.8-.35 6.8-1.6 8.6-3.4 1.8-1.8 3.05-4.8 3.4-8.7H12z" transform="translate(1.4 -0.9) scale(0.92)" />
    </svg>
  );
}

/** Wordmark lockup: sparkle + "UPC AI". */
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
      <Sparkle size={size} />
      UPC&nbsp;AI
    </span>
  );
}
