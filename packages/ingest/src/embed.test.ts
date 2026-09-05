import { describe, expect, it } from "vitest";
import { resolveEmbedConfig, EMBEDDING_DIMENSIONS } from "./embed";

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
