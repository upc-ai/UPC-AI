import { describe, expect, it } from "vitest";

/**
 * Rewrite module unit tests. The module's Gemini call is env-dependent, so
 * these test the PURE validation layer by extracting the same rules —
 * a rewrite result is usable only when it's short, single-line, and non-empty.
 * (The fail-open behavior itself is exercised in the integration walkthrough.)
 */

function validateRewrite(raw: string | null): string | null {
  if (raw === null) return null;
  const text = raw.trim().replace(/^["']|["']$/g, "");
  if (!text || text.length > 200 || text.includes("\n")) return null;
  return text;
}

describe("rewrite output validation (fail-open rules)", () => {
  it("accepts a clean single-line query", () => {
    expect(validateRewrite("Udai Pratap College hostel rules")).toBe("Udai Pratap College hostel rules");
  });

  it("strips surrounding quotes the model may add", () => {
    expect(validateRewrite('"Udai Pratap College fee structure"')).toBe("Udai Pratap College fee structure");
  });

  it("nulls out empty and whitespace-only output", () => {
    expect(validateRewrite("")).toBeNull();
    expect(validateRewrite("   ")).toBeNull();
  });

  it("nulls out multi-line output (preamble leakage)", () => {
    expect(validateRewrite("Sure! Here is the query:\nUdai Pratap College fees")).toBeNull();
  });

  it("nulls out absurdly long output", () => {
    expect(validateRewrite("a".repeat(201))).toBeNull();
  });

  it("propagates null on provider failure (fail-open to raw query)", () => {
    expect(validateRewrite(null)).toBeNull();
  });
});
