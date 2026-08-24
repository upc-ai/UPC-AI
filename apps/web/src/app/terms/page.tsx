import type { Metadata } from "next";
import { MarketingPage } from "../_components/MarketingPage";
import { Reveal } from "../_components/Reveal";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using UPC AI.",
};

export default function TermsPage() {
  return (
    <MarketingPage>
      <main id="main">
        <section className={`${styles.container} ${styles.pageHeader}`}>
          <Reveal>
            <p className={styles.sectionKicker}>Legal</p>
            <h1 className={styles.sectionTitle}>Terms of Service</h1>
            <p className={styles.sectionSub}>Short, fair, and in plain language. Last updated 2026.</p>
          </Reveal>
        </section>

        <section className={`${styles.container} ${styles.section}`} style={{ paddingTop: 0 }}>
          <Reveal>
            <div className={styles.prose}>
              <h3>What UPC AI is</h3>
              <p>
                UPC AI is a free AI assistant for the students, faculty and staff of Udai Pratap
                College, Varanasi. By using it, you agree to these terms.
              </p>

              <h3>Use it fairly</h3>
              <ul>
                <li>Use your own account — one per person.</li>
                <li>Don&apos;t attempt to break, overload or abuse the service.</li>
                <li>Daily message limits exist to keep UPC AI fast and free for everyone.</li>
                <li>Accounts used for misuse may be suspended.</li>
              </ul>

              <h3>Answers and accuracy</h3>
              <p>
                College-related answers are generated only from documents approved by the
                college, with the source cited. Still, AI can make mistakes — always verify
                critical decisions (fees, deadlines, exam rules) against the cited official
                document or the college office before acting on them. UPC AI is a study and
                information aid, not a legal authority.
              </p>

              <h3>Academic honesty</h3>
              <p>
                UPC AI explains, teaches and helps you practise. Submitting its answers as your
                own work where original work is expected is your responsibility, not ours — use
                it the way you would use a very patient tutor.
              </p>

              <h3>Content</h3>
              <p>
                Official documents in the knowledge base belong to Udai Pratap College. Your
                conversations belong to you. The UPC AI name, logo and app are maintained by the
                UPC AI team.
              </p>

              <h3>Changes</h3>
              <p>
                These terms may be updated as the service grows. Continued use after an update
                means you accept the revised terms. Questions? Email{" "}
                <a href="mailto:hello@helloupcai.app">hello@helloupcai.app</a>.
              </p>
            </div>
          </Reveal>
        </section>
      </main>
    </MarketingPage>
  );
}
