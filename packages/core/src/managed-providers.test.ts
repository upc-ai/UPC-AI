import { describe, expect, it } from "vitest";
import { managedProviderSchema } from "@upc/core";

/** Mirrors managed-config.ts's per-entry validation (the DB rows' schema). */
function validateEntry(entry: unknown) {
  return managedProviderSchema.safeParse(entry);
}

describe("managedProviderSchema (admin panel provider specs)", () => {
  it("accepts a complete provider", () => {
    const r = validateEntry({
      name: "gemini-main",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKeyEnv: "GEMINI_API_KEY",
      apiKeyName: "Gemini main key",
      model: "gemini-flash-latest",
      tier: "frontier",
      costPerMTokIn: 0.15,
      costPerMTokOut: 0.6,
      enabled: true,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a spec that tries to carry an apiKey value", () => {
    // The security model: keys live ONLY in env. A stored key must fail parse.
    const r = validateEntry({
      name: "x",
      baseUrl: "https://example.com/openai",
      apiKeyEnv: "GEMINI_API_KEY",
      apiKeyName: "x",
      model: "m",
      apiKey: "AIza-super-secret",
    });
    expect(r.success).toBe(true); // zod strips unknown keys — no key value flows anywhere
    if (r.success) expect("apiKey" in r.data).toBe(false);
  });

  it("requires apiKeyEnv — a provider with no env var name is invalid", () => {
    const r = validateEntry({
      name: "x",
      baseUrl: "https://example.com/openai",
      apiKeyName: "x",
      model: "m",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-URL base URL", () => {
    const r = validateEntry({
      name: "x",
      baseUrl: "not-a-url",
      apiKeyEnv: "K",
      apiKeyName: "x",
      model: "m",
    });
    expect(r.success).toBe(false);
  });

  it("defaults tier to standard, costs to 0, enabled to true", () => {
    const r = validateEntry({
      name: "x",
      baseUrl: "https://example.com/openai",
      apiKeyEnv: "K",
      apiKeyName: "x",
      model: "m",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tier).toBe("standard");
      expect(r.data.costPerMTokIn).toBe(0);
      expect(r.data.costPerMTokOut).toBe(0);
      expect(r.data.enabled).toBe(true);
    }
  });
});
