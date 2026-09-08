import { describe, expect, it } from "vitest";
import { dedupeRanked, trigramJaccard } from "./dedupe";

function chunk(id: string, content: string) {
  return { id, content };
}

describe("trigramJaccard", () => {
  it("is 1 for identical text, 0 for disjoint text", () => {
    expect(trigramJaccard("hostel curfew timing is 10 pm", "hostel curfew timing is 10 pm")).toBe(1);
    expect(trigramJaccard("hostel curfew timing", "admission fee structure")).toBeLessThan(0.1);
  });
});

describe("dedupeRanked", () => {
  it("drops near-identical chunks, keeping the higher-ranked copy", () => {
    const kept = dedupeRanked([
      chunk("a", "The hostel curfew timing is 10:00 PM for all first year students residing in the hostel."),
      chunk("b", "The hostel curfew timing is 10:00 PM for all first year students residing in the hostel."),
    ]);
    expect(kept.map((c) => c.id)).toEqual(["a"]);
  });

  it("keeps genuinely different chunks", () => {
    const kept = dedupeRanked([
      chunk("a", "The hostel curfew timing is 10:00 PM for all first year students residing in the hostel."),
      chunk("b", "The placement cell conducts training sessions every semester for final year students."),
      chunk("c", "BSc Agriculture syllabus covers agronomy, horticulture and plant pathology subjects."),
    ]);
    expect(kept.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps first-of-cluster across multiple duplicates", () => {
    const base = "Entrance examination eligibility requires 10+2 with minimum aggregate marks per university norms.";
    const kept = dedupeRanked([
      chunk("original", base),
      chunk("dup1", base),
      chunk("dup2", base + " Additional note."),
      chunk("distinct", "Fees are paid online through the college payment gateway each semester."),
    ]);
    expect(kept.map((c) => c.id)).toEqual(["original", "distinct"]);
  });

  it("returns the input unchanged when everything is unique", () => {
    const items = [chunk("a", "alpha beta gamma delta"), chunk("b", "epsilon zeta eta theta")];
    expect(dedupeRanked(items).map((c) => c.id)).toEqual(["a", "b"]);
  });
});
