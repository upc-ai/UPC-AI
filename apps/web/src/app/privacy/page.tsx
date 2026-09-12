import type { Metadata } from "next";
import { MarketingPage } from "../_components/MarketingPage";
import { Reveal } from "../_components/Reveal";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What UPC AI collects, why, and how your data is protected.",
};

export default function PrivacyPage() {
  return (
    <MarketingPage>
      <main id="main">
        <section className={`${styles.container} ${styles.pageHeader}`}>
          <Reveal>
            <p className={styles.sectionKicker}>Legal</p>
            <h1 className={styles.sectionTitle}>Privacy Policy</h1>
            <p className={styles.sectionSub}>Plain language, no legalese. Last updated 2026.</p>
          </Reveal>
        </section>

        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <Reveal>
            <div className={styles.prose}>
              <h3>What we collect</h3>
              <ul>
                <li>Your name and email address, when you create an account.</li>
                <li>Your conversations with UPC AI — needed to show your chat history.</li>
                <li>Your preferences — theme, language, answer length and study defaults.</li>
                <li>Documents uploaded by college staff for the knowledge base.</li>
              </ul>

              <h3>Why we collect it</h3>
              <p>
                Only to provide the service: to keep you signed in securely, remember your
                preferences, show your conversations across devices, and ground answers in the
                college&apos;s official documents. We do not sell, rent or share your personal
                data with advertisers or third parties.
              </p>

              <h3>How it&apos;s protected</h3>
              <ul>
                <li>Passwords are stored only as strong one-way hashes — never in plain text.</li>
                <li>Sessions use encrypted, signed tokens that expire and rotate.</li>
                <li>All traffic runs over HTTPS.</li>
                <li>Your conversations are visible only to your own account.</li>
              </ul>

              <h3>What we don&apos;t do</h3>
              <ul>
                <li>No tracking pixels, no advertising, no profiling.</li>
                <li>No selling or sharing of your data, ever.</li>
                <li>No training on your personal conversations for advertising purposes.</li>
              </ul>

              <h3>Your choices</h3>
              <p>
                You can change or delete your preferences any time in Settings. To request
                deletion of your account and conversations, write to us and we will do it.
              </p>

              <h3>Contact</h3>
              <p>
                Questions about privacy? Email{" "}
                <a href="mailto:hello@upcai.app">hello@upcai.app</a>.
              </p>
            </div>
          </Reveal>
        </section>
      </main>
    </MarketingPage>
  );
}
