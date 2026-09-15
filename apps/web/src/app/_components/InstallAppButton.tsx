"use client";

import { useEffect, useState } from "react";
import { useInstallPwa } from "./install-pwa";
import styles from "./install-pwa.module.css";

/** Landing hero "Install App" button — appears only when Chrome offers the
 *  native install flow (or iOS shows its own hint). Disappears once installed,
 *  and stays away for 14 days after a dismissal. */
export function InstallAppButton() {
  const { canInstall, install, installed, iosHint, ready } = useInstallPwa();
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (iosHint) setHint(true);
  }, [iosHint]);

  if (!ready || installed) return null;

  if (canInstall) {
    return (
      <button
        className={styles.installBtn}
        onClick={() => void install()}
        aria-label="Install UPC AI as an app"
      >
        Install App
      </button>
    );
  }

  if (hint) {
    return (
      <button className={styles.installBtn} onClick={() => setHint(false)} title="Tap once to dismiss">
        iPhone: Share → Add to Home Screen
      </button>
    );
  }

  return null;
}
