import { describe, expect, it, vi, afterEach } from "vitest";
import { resolveEmbedConfig, placeBatch, backoffDelay, embedBatch, EMBEDDING_DIMENSIONS, type EmbedConfig } from "./embed";

describe("resolveEmbedConfig", () => {
  it("returns null when nothing is configured", () => {
    expect(resolveEmbedConfig({})).toBeNull();
    expect(resolveEmbedConfig({ OPENAI_EMBEDDING_KEY: "", OPENAI_API_KEY: "", GEMINI_API_KEY: "" })).toBeNull();
  });

  it("explicit EMBEDDING_API_KEY wins and defaults provider to gemini", () => {
    const cfg = resolveEmbedConfig({ EMBEDDING_API_KEY: "key-1" })!;
    expect(cfg.provider).toBe("gemini");
    expect(cfg.apiKey).toBe("key-1");
  });

  it("EMBEDDING_PROVIDER=openai is honored", () => {
    const cfg = resolveEmbedConfig({ EMBEDDING_API_KEY: "key-1", EMBEDDING_PROVIDER: "openai" })!;
    expect(cfg.provider).toBe("openai");
  });

  it("EMBEDDING_BASE_URL overrides the endpoint host", () => {
    const cfg = resolveEmbedConfig({ EMBEDDING_API_KEY: "k", EMBEDDING_BASE_URL: "https://example.com/openai/" })!;
    expect(cfg.baseUrl).toBe("https://example.com/openai/");
  });

  it("falls back to OPENAI_EMBEDDING_KEY → OPENAI_API_KEY as openai provider", () => {
    expect(resolveEmbedConfig({ OPENAI_EMBEDDING_KEY: "sk-embed" })!.provider).toBe("openai");
    expect(resolveEmbedConfig({ OPENAI_API_KEY: "sk-plain" })!.provider).toBe("openai");
    expect(resolveEmbedConfig({ OPENAI_EMBEDDING_KEY: "sk-embed", GEMINI_API_KEY: "g" })!.apiKey).toBe("sk-embed");
  });

  it("GEMINI_API_KEY alone selects gemini", () => {
    const cfg = resolveEmbedConfig({ GEMINI_API_KEY: "AQ.xxx" })!;
    expect(cfg.provider).toBe("gemini");
  });
});

describe("EMBEDDING_DIMENSIONS", () => {
  it("is 1536 to match the pgvector column", () => {
    expect(EMBEDDING_DIMENSIONS).toBe(1536);
  });
});

describe("placeBatch", () => {
  it("scatters OpenAI responses by their 0-based index (may arrive shuffled)", () => {
    const all: number[][] = [];
    placeBatch(all, 0, [
      { embedding: [1], index: 2 },
      { embedding: [2], index: 0 },
      { embedding: [3], index: 1 },
    ]);
    expect(all).toEqual([[2], [3], [1]]);
  });

  it("fills the hole when Gemini omits index for item 0 (proto3 default-value omission)", () => {
    // Real shape observed from the compat endpoint: index present only from 1 on.
    const all: number[][] = [];
    placeBatch(all, 0, [{ embedding: [10] }, { embedding: [11], index: 1 }, { embedding: [12], index: 2 }]);
    expect(all).toEqual([[10], [11], [12]]);
  });

  it("keeps the batch offset for multi-batch documents", () => {
    const all: number[][] = [[0], [0]];
    placeBatch(all, 2, [{ embedding: [7] }, { embedding: [8], index: 1 }]);
    expect(all).toEqual([[0], [0], [7], [8]]);
  });

  it("mixes: explicit zero index and omitted index both land at position 0", () => {
    const a: number[][] = [];
    placeBatch(a, 0, [{ embedding: [1], index: 0 }, { embedding: [2], index: 1 }]);
    expect(a).toEqual([[1], [2]]);
  });
});

describe("backoffDelay", () => {
  it("grows exponentially with ±25% jitter", () => {
    process.env.EMBED_BASE_DELAY_MS = "1000";
    for (const attempt of [0, 1, 2, 3]) {
      for (let i = 0; i < 20; i++) {
        const d = backoffDelay(attempt);
        expect(d).toBeGreaterThanOrEqual(1000 * 2 ** attempt * 0.75);
        expect(d).toBeLessThanOrEqual(1000 * 2 ** attempt * 1.25);
      }
    }
  });
});

describe("embedBatch retries", () => {
  const config: EmbedConfig = { provider: "gemini", apiKey: "test-key" };

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.EMBED_BASE_DELAY_MS;
    delete process.env.EMBED_MAX_RETRIES;
  });

  function okResponse() {
    return { ok: true, status: 200, json: async () => ({ data: [{ embedding: [0.5], index: 0 }] }) };
  }

  it("retries on 429 and succeeds", async () => {
    process.env.EMBED_BASE_DELAY_MS = "1";
    process.env.EMBED_MAX_RETRIES = "2";
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return calls === 1 ? { ok: false, status: 429, text: async () => "rate limited" } : okResponse();
    });
    const out = await embedBatch(["hello"], config);
    expect(calls).toBe(2);
    expect(out).toHaveLength(1);
    expect(out[0]!.model).toBe("gemini-embedding-001");
  });

  it("retries on 5xx then throws after exhausting retries", async () => {
    process.env.EMBED_BASE_DELAY_MS = "1";
    process.env.EMBED_MAX_RETRIES = "1";
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return { ok: false, status: 503, text: async () => "down" };
    });
    await expect(embedBatch(["hello"], config)).rejects.toThrow(/503/);
    expect(calls).toBe(2); // initial + 1 retry
  });

  it("does NOT retry permanent 4xx failures", async () => {
    process.env.EMBED_BASE_DELAY_MS = "1";
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return { ok: false, status: 401, text: async () => "bad key" };
    });
    await expect(embedBatch(["hello"], config)).rejects.toThrow(/401/);
    expect(calls).toBe(1);
  });
});
