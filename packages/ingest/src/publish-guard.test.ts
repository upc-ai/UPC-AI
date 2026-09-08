import { describe, expect, it } from "vitest";
import { canPublish } from "./publish-guard";

const full = { chunkCount: 10, embeddingCount: 10 };

describe("canPublish", () => {
  it("passes a fully indexed, fully embedded document", () => {
    expect(canPublish({ status: "indexed", processingError: null }, full).ok).toBe(true);
  });

  it("blocks every non-indexed status", () => {
    for (const status of ["uploaded", "parsing", "parse_failed", "chunking", "embed_failed", "needs_ocr", "draft", "published", "superseded"]) {
      const v = canPublish({ status, processingError: null }, full);
      expect(v.ok).toBe(false);
      expect(v.reason).toContain(status);
    }
  });

  it("blocks documents with a recorded processing error (incl. embedding_failed)", () => {
    const v = canPublish({ status: "indexed", processingError: "embedding_failed: 429 rate limited" }, full);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("embedding_failed");
  });

  it("blocks documents with no chunks", () => {
    expect(canPublish({ status: "indexed", processingError: null }, { chunkCount: 0, embeddingCount: 0 }).ok).toBe(false);
  });

  it("blocks documents with missing embeddings (BM25-only)", () => {
    const v = canPublish({ status: "indexed", processingError: null }, { chunkCount: 40, embeddingCount: 39 });
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("1 of 40");
  });
});
