"use client";

import { useEffect, useState } from "react";
import { Sparkle } from "@upc/ui";

/**
 * Hero chat demo — a looping, CSS-light recreation of the real streaming UX:
 * user question → thinking shimmer → streamed answer lines with citations → source line.
 */
export function HeroChatDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStep(1), 600), // user question
      window.setTimeout(() => setStep(2), 1600), // thinking
      window.setTimeout(() => setStep(3), 2600), // answer line 1
      window.setTimeout(() => setStep(4), 3400), // answer line 2
      window.setTimeout(() => setStep(5), 4200), // sources
      window.setTimeout(() => setStep(0), 11000), // reset loop
    ];
    return () => timers.forEach(clearTimeout);
  }, [step === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: "relative" }}>
      <div className="mockup" data-testid="hero-mockup">
        <div className="mockupBar">
          <span className="mockupDot" />
          <span className="mockupDot" />
          <span className="mockupDot" />
          <span className="mockupTitle">upcai.in</span>
        </div>

        {step >= 1 && (
          <div className="mockupUser">
            What is the BSc CS fee structure for 2nd year?
          </div>
        )}

        {step === 2 && (
          <div className="mockupStatus">
            <Sparkle size={14} />
            <span className="shimmer">Thinking…</span>
          </div>
        )}

        {step >= 3 && (
          <div className="mockupAnswer">
            <span className="line">
              Tuition: <strong>₹15,000</strong> per semester <em>[1]</em>
            </span>
            {step >= 4 && (
              <span className="line">
                Library: ₹2,000 · Lab: ₹3,000 <em>[2]</em>
              </span>
            )}
          </div>
        )}

        {step >= 5 && (
          <div className="mockupSources">
            <Sparkle size={12} />
            Sources: Fee Structure 2025-26 (Official) · Page 1
          </div>
        )}
      </div>

      <style jsx>{`
        .shimmer {
          animation: shimmer 1.8s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .mockupUser,
        .mockupAnswer .line,
        .mockupSources {
          animation: fadein 300ms ease;
        }
        @keyframes fadein {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
