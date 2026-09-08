import { describe, expect, it } from "vitest";
import { structurePdfText, isScannedPdf, SCANNED_MIN_CHARS_PER_PAGE } from "./parse";

describe("structurePdfText", () => {
  it("converts ALL-CAPS Latin lines to ## headings", () => {
    const out = structurePdfText("COURSE OBJECTIVES\nThe course covers X.");
    expect(out).toContain("## COURSE OBJECTIVES");
    expect(out).toContain("The course covers X.");
  });

  it("does not treat lowercase or Devanagari lines as ALL-CAPS headings", () => {
    const out = structurePdfText("The course covers X.\nप्रयोगशाला सुविधाएं उपलब्ध हैं");
    expect(out).not.toContain("## The course");
    expect(out).not.toContain("## प्रयोगशाला");
  });

  it("converts numbered short lines without sentence-final period to headings", () => {
    const out = structurePdfText("1. Introduction\n2.1 Course Objectives\n1. This sentence explains the unit in detail.");
    expect(out).toContain("## 1. Introduction");
    expect(out).toContain("## 2.1 Course Objectives");
    // a numbered sentence (ends with period) stays body text
    expect(out).toContain("1. This sentence explains the unit in detail.");
    expect(out).not.toContain("## 1. This sentence");
  });

  it("converts bullet glyphs to list markers", () => {
    const out = structurePdfText("• First item\n● Second item\n‣ Third item");
    expect(out).toContain("- First item");
    expect(out).toContain("- Second item");
    expect(out).toContain("- Third item");
  });

  it("preserves blank lines as paragraph breaks and collapses 3+ to 2", () => {
    const out = structurePdfText("Para one.\n\n\n\n\nPara two.");
    expect(out).toBe("Para one.\n\nPara two.");
  });

  it("leaves existing markdown headings untouched", () => {
    expect(structurePdfText("## Already a heading")).toContain("## Already a heading");
  });

  it("keeps numeric-only lines as body text (table values)", () => {
    const out = structurePdfText("500\n25.75\n1. 25");
    expect(out).not.toContain("## ");
  });
});

describe("isScannedPdf", () => {
  it("flags empty text", () => {
    expect(isScannedPdf("", 5)).toBe(true);
    expect(isScannedPdf("   \n  ", 5)).toBe(true);
  });

  it("flags a thin text layer relative to page count", () => {
    expect(isScannedPdf("x".repeat(100), 1)).toBe(true); // 100 < 120/page
    expect(isScannedPdf("x".repeat(500), 10)).toBe(true); // 50/page
  });

  it("passes normal text-layer PDFs", () => {
    expect(isScannedPdf("x".repeat(1000), 1)).toBe(false);
    expect(isScannedPdf("x".repeat(SCANNED_MIN_CHARS_PER_PAGE * 12), 10)).toBe(false);
  });
});
