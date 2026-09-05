import { describe, expect, it } from "vitest";
import { chunkDocument, approxTokens } from "./chunk";

describe("chunkDocument", () => {
  it("returns a single chunk for short text", () => {
    const out = chunkDocument("Hello world", { docTitle: "Doc" });
    expect(out).toHaveLength(1);
    expect(out[0]!.content).toBe("[Doc]\nHello world");
    expect(out[0]!.chunkType).toBe("prose");
  });

  it("packs long text into overlapping chunks within the max size", () => {
    const targetChars = 500 * 4;
    const maxChars = 650 * 4;
    const text = "Sentence ".repeat(targetChars); // ~2 target-sized sections
    const out = chunkDocument(text, { docTitle: "Doc" });
    expect(out.length).toBeGreaterThan(1);
    for (const c of out) {
      expect(c.content.length).toBeLessThanOrEqual(maxChars + 200); // +hierarchy prefix
    }
    // Overlap: second chunk starts before first ends (75 tokens = 300 chars back)
    const first = out[0]!.content;
    const second = out[1]!.content;
    const overlapWindow = first.slice(first.length - 350);
    // Some tail of the first chunk should reappear near the head of the second
    expect(second.slice(0, 350)).toContain(overlapWindow.slice(Math.max(0, overlapWindow.length - 40)));
  });

  it("emits tables as atomic chunks with sheet name in the path", () => {
    const out = chunkDocument("Prose only", {
      docTitle: "Doc",
      tables: [{ sheet: "Fees", rows: [["Item", "Cost"], ["Tuition", "50000"]] }],
    });
    expect(out[0]!.chunkType).toBe("table");
    expect(out[0]!.hierarchyPath).toBe("Doc > Fees");
    expect(out[0]!.content).toContain("Tuition | 50000");
    expect(out[0]!.tableJson).toEqual({ rows: [["Item", "Cost"], ["Tuition", "50000"]] });
  });

  it("marks heading sections with their path", () => {
    const out = chunkDocument("## Section A\nBody text", { docTitle: "Doc" });
    expect(out[0]!.chunkType).toBe("heading_section");
    expect(out[0]!.hierarchyPath).toBe("Doc > Section A");
  });

  it("caps table rows at 100 in tableJson but keeps full text", () => {
    const rows = Array.from({ length: 150 }, (_, i) => [`r${i}`, `v${i}`]);
    const out = chunkDocument("x", { docTitle: "Doc", tables: [{ sheet: "Big", rows }] });
    expect((out[0]!.tableJson as { rows: string[][] }).rows).toHaveLength(100);
    expect(out[0]!.content).toContain("r149 | v149");
  });
});

describe("approxTokens", () => {
  it("uses 4 chars per token, rounding up", () => {
    expect(approxTokens("")).toBe(0);
    expect(approxTokens("abcd")).toBe(1);
    expect(approxTokens("abcde")).toBe(2);
    expect(approxTokens("12345678")).toBe(2);
  });
});
