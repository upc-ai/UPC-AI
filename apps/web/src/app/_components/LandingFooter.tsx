import Link from "next/link";
import { Wordmark } from "@upc/ui";
import styles from "../landing.module.css";

const COLUMNS: {
  h: string;
  links: { label: string; href: string; external?: boolean }[];
}[] = [
  {
    h: "Product",
    links: [
      { label: "Features", href: "/#about" },
      { label: "Knowledge", href: "/knowledge" },
      { label: "Study Tools", href: "/study-tools" },
    ],
  },
  {
    h: "College",
    links: [
      { label: "For Faculty", href: "/for-faculty" },
      { label: "Our Heritage", href: "/#heritage" },
      { label: "Partnership", href: "mailto:hello@upcai.app", external: true },
    ],
  },
  {
    h: "Resources",
    links: [
      { label: "Help Center", href: "/faq" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "mailto:hello@upcai.app", external: true },
    ],
  },
  {
    h: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
];

/** Marketing footer — shared by every page via MarketingPage. Two-sided:
 *  brand + socials on the left, link columns in a 2×2 on the right, bottom
 *  bar spanning both. Internal links are next/link routes; mailtos stay
 *  plain anchors. */
export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <Wordmark size={18} />
            <span className={styles.footerCollege}>
              The official AI assistant of<br />Udai Pratap College, Varanasi
            </span>
            <div className={styles.footerSocial}>
              <a href="https://instagram.com/upc.ai" target="_blank" rel="noreferrer" aria-label="UPC AI on Instagram (@upc.ai)" title="@upc.ai on Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" />
                </svg>
                @upc.ai
              </a>
              <a href="https://x.com/upc_ai" target="_blank" rel="noreferrer" aria-label="UPC AI on X (@upc_ai)" title="@upc_ai on X">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.81-5.96 6.81H1.68l7.74-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.84L7.02 4.13H5.04l12.04 15.64Z" />
                </svg>
                @upc_ai
              </a>
              <a href="mailto:hello@upcai.app" aria-label="Email UPC AI" title="hello@upcai.app">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /><path d="m3.5 6.5 8.5 6 8.5-6" />
                </svg>
                hello@upcai.app
              </a>
            </div>
          </div>
          <div className={styles.footerLinks}>
            {COLUMNS.map((col) => (
              <div key={col.h} className={styles.footerCol}>
                <h4>{col.h}</h4>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.external ? (
                        <a href={l.href}>{l.label}</a>
                      ) : (
                        <Link href={l.href}>{l.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} UPC AI · Udai Pratap College, Varanasi</span>
          <span>upcai.app · Made with care for students</span>
        </div>
      </div>
    </footer>
  );
}
