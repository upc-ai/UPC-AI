"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveal — one-shot scroll-reveal (animate-skill recipe).
 * IntersectionObserver, once; transform + opacity only (GPU); 480ms strong
 * ease-out; `delay` gives 60-80ms staggers. Reduced motion → instant show.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Stagger delay in ms — keep in the 0-240ms range */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -60px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(16px)",
        transitionProperty: "opacity, transform",
        transitionDuration: "480ms",
        transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
