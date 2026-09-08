import { describe, expect, it } from "vitest";
import { buildChunkMetadata } from "./pipeline";

const doc = {
  categoryId: "cat-1",
  departmentId: null,
  accessLevel: "public",
  audience: "student",
  language: "hi",
  effectiveDate: null,
  expiryDate: null,
  title: "Notice 12",
  sourceUrl: "https://www.upcollege.ac.in/AppImage/notice/12.pdf",
};

describe("buildChunkMetadata", () => {
  it("stores identity + organization fields on every chunk", () => {
    const m = buildChunkMetadata(doc, "notices");
    expect(m.title).toBe("Notice 12");
    expect(m.source_url).toBe("https://www.upcollege.ac.in/AppImage/notice/12.pdf");
    expect(m.category_slug).toBe("notices");
    expect(m.category).toBe("cat-1");
    expect(m.language).toBe("hi");
    expect(m.audience).toBe("student");
    expect(m.access_level).toBe("public");
  });

  it("handles null organization fields", () => {
    const m = buildChunkMetadata({ ...doc, sourceUrl: null, language: null, categoryId: null }, null);
    expect(m.source_url).toBeNull();
    expect(m.language).toBeNull();
    expect(m.category_slug).toBeNull();
    expect(m.category).toBeNull();
  });
});
