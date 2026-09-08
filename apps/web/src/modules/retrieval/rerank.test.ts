import { describe, expect, it, vi, afterEach } from "vitest";
import { parseRerankOrder, rerankChunks, rerankEnabled } from "./rerank";

describe("parseRerankOrder", () => {
  it("parses a plain JSON index array", () => {
    expect(parseRerankOrder("[2,0,1]", 3)).toEqual([2, 0, 1]);
  });

  it("tolerates prose around the array", () => {
    expect(parseRerankOrder('Here you go: [1, 0]\nDone.', 2)).toEqual([1, 0]);
  });

  it("appends omitted indices in fusion order and drops out-of-range/duplicates", () => {
    expect(parseRerankOrder("[3, 1, 1, 9, 0]", 4)).toEqual([3, 1, 0, 2]);
  });

  it("returns null on garbage", () => {
    expect(parseRerankOrder("no json here", 3)).toBeNull();
    expect(parseRerankOrder('{"a":1}', 3)).toBeNull();
    expect(parseRerankOrder("[", 3)).toBeNull();
  });
});

describe("rerankChunks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RERANK_ENABLED;
    delete process.env.GEMINI_API_KEY;
  });

  it("is disabled by RERANK_ENABLED=false (no network call, order kept)", async () => {
    process.env.RERANK_ENABLED = "false";
    let called = 0;
    vi.stubGlobal("fetch", async () => {
      called++;
      throw new Error("should not fetch");
    });
    const input = [{ id: "1", content: "a" }, { id: "2", content: "b" }];
    expect(await rerankChunks("q", input)).toEqual(input);
    expect(called).toBe(0);
  });

  it("fail-open: network error keeps fusion order", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", async () => {
      throw new Error("boom");
    });
    const input = [{ id: "1", content: "alpha", documentTitle: "A" }, { id: "2", content: "beta", documentTitle: "B" }];
    expect(await rerankChunks("q", input)).toEqual(input);
  });

  it("reorders by the model's returned indices on success", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '[1, 0]' } }] }),
    }));
    const input = [{ id: "1", content: "alpha", documentTitle: "A" }, { id: "2", content: "beta", documentTitle: "B" }];
    const out = await rerankChunks("q", input);
    expect(out.map((c) => c.id)).toEqual(["2", "1"]);
  });
});

describe("rerankEnabled", () => {
  it("defaults to enabled", () => {
    delete process.env.RERANK_ENABLED;
    expect(rerankEnabled()).toBe(true);
  });
});
