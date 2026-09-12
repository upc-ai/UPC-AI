"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal";
import styles from "../landing.module.css";

/**
 * Heritage band — the college's real, verifiable milestones as keynote-style
 * numerals (founded 1909 · first autonomous college in UP · 30 departments ·
 * 100-acre campus · NAAC 'A' · 5 faculties). Numeric values count up once
 * when scrolled into view; reduced-motion users see the final numbers.
 * Facts sourced from the official college website crawl (to-import/crawl/).
 */

type Stat = {
  /** Final numeral — counts up when numeric. */
  count?: number;
  /** Static display form for non-counting values ("1909", "1st", "A"). */
  fixed?: string;
  suffix?: string;
  label: string;
  /** Quiet qualifier under the label ("since 1991"). */
  sub?: string;
};

const STATS: Stat[] = [
  { fixed: "1909", label: "Established" },
  { fixed: "1st", label: "Autonomous college in Uttar Pradesh", sub: "since 1991" },
  { count: 30, label: "Departments", suffix: "" },
  { count: 5, label: "Faculties" },
  { count: 100, suffix: "-acre", label: "Campus in Varanasi" },
  { fixed: "A", label: "NAAC grade", sub: "CGPA 3.16 / 4" },
];

/** rAF count-up from 0 to `to` over 900ms with a strong ease-out feel. */
function useCountUp(to: number, active: boolean, reduced: boolean): number {
  const [value, setValue] = useState(reduced ? to : 0);
  useEffect(() => {
    if (!active || reduced) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // cubic ease-out — fast start, gentle settle
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced, to]);
  return value;
}

function StatCell({ stat, active, reduced }: { stat: Stat; active: boolean; reduced: boolean }) {
  const counted = useCountUp(stat.count ?? 0, active, reduced);
  return (
    <div className={styles.stat}>
      <span className={styles.statValue} aria-label={stat.count !== undefined ? String(stat.count) : undefined}>
        {stat.count !== undefined ? counted : stat.fixed}
        {stat.suffix ?? ""}
      </span>
      <span className={styles.statLabel}>
        {stat.label}
        {stat.sub ? <em className={styles.statSub}>{stat.sub}</em> : null}
      </span>
    </div>
  );
}

export function HeritageStats() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { rootMargin: "-80px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.heritageGrid} ref={ref}>
      {STATS.map((s) => (
        <Reveal key={s.label}>
          <StatCell stat={s} active={active} reduced={reduced} />
        </Reveal>
      ))}
    </div>
  );
}
