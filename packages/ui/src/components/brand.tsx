/** UPC AI brand — the geometric "U" mark (three constructed strokes, floating right arm). */

export interface LogoMarkProps {
  /** Height in px. Width auto-computes from the mark's 4:5 aspect (tight viewBox, no padding). */
  size?: number;
  className?: string;
}

const MARK_ASPECT = 480 / 600; // width / height of the letterform bounds

/**
 * The UPC AI mark: a built-letter "U" — a full-height pillar stem, a floating
 * right arm, and a base bar tucked flush under the right edge. Uniform 120px
 * strokes, even 60px air-gaps.
 *
 * The viewBox is TIGHT to the artwork ("272 212 480 600") — premium lockups
 * size marks edge-to-edge like OpenAI/Perplexity, not padded. For the square
 * favicon variant (padded + enlarged), use icon.svg.
 * Renders in currentColor: ink on light, white on dark, accent when tinted.
 */
export function LogoMark({ size = 24, className }: LogoMarkProps) {
  const height = size;
  const width = Math.round(size * MARK_ASPECT);
  return (
    <svg
      width={width}
      height={height}
      viewBox="272 212 480 600"
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

/**
 * Lockup: mark + "UPC AI". Premium ratio — the mark sits at 1.25× the text
 * size (the OpenAI/Gemini convention), 10px gap, optically centered.
 * Wordmark set tight-tracked semibold — the engineered lockup style of
 * Linear/Stripe (Apple typography: display text tightens as it grows).
 */
export function Wordmark({ size = 18, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-body)",
        fontSize: size,
        fontWeight: 650,
        letterSpacing: "-0.02em",
        lineHeight: 1,
        color: dark ? "var(--on-dark)" : "var(--ink)",
      }}
    >
      <LogoMark size={Math.round(size * 1.25)} />
      UPC&nbsp;AI
    </span>
  );
}
