"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@upc/ui";
import styles from "../landing.module.css";

const NAV_LINKS = [
  { label: "About", href: "/about" },
  { label: "Knowledge", href: "/knowledge" },
  { label: "Study Tools", href: "/study-tools" },
  { label: "For Faculty", href: "/for-faculty" },
  { label: "FAQ", href: "/faq" },
];

/**
 * Landing nav — floating glass bar (apple-design §12: translucent chrome,
 * content scrolls under). The mobile menu is a glass sheet: fade + rise
 * 250ms ease-out (occasional-tier), closes on link tap and Escape.
 */
export function LandingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Link href="/" style={{ textDecoration: "none" }} aria-label="UPC AI home">
          <Wordmark size={18} />
        </Link>
        <nav className={styles.navLinks} aria-label="Main">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={styles.navLink}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.signIn}>
            Sign in
          </Link>
          <Link href="/signup" className={styles.navCta}>
            Try UPC AI
          </Link>
        </div>
        <button
          className={styles.hamburger}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          ) : (
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          )}
        </button>
      </div>

      <div
        className={[styles.mobileMenu, open ? styles.mobileMenuOpen : ""].join(" ")}
        aria-hidden={!open}
      >
        <nav className={styles.mobileLinks} aria-label="Mobile">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={styles.mobileLink} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className={styles.mobileActions}>
          <Link href="/login" className={styles.mobileSignIn} onClick={() => setOpen(false)}>
            Sign in
          </Link>
          <Link href="/signup" className={styles.mobileCta} onClick={() => setOpen(false)}>
            Try UPC AI
          </Link>
        </div>
      </div>
    </header>
  );
}
