import { LandingNav } from "./LandingNav";
import { LandingFooter } from "./LandingFooter";
import styles from "../landing.module.css";

/** Shared marketing shell: ambient page canvas + nav + footer. Every
    marketing page (landing and subpages) renders inside this. */
export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <LandingNav />
      {children}
      <LandingFooter />
    </div>
  );
}
