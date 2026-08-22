import { describe, it, expect, vi } from "vitest";
import {
  ApiError,
  ERROR_CODES,
  STUDY_MODES,
  getEnv,
  getCustomProviders,
  PUBLIC_MODELS,
  publicModelById,
  publicModelForTier,
} from "./index";

describe("core package", () => {
  it("exposes the four v2.0 study modes", () => {
    expect(STUDY_MODES).toEqual(["learn", "practice", "explain_simply", "challenge_me"]);
  });

  it("maps error codes to HTTP statuses", () => {
    expect(ERROR_CODES.AUTH_REFRESH_REUSED).toBe(403);
    expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe(429);
  });

  it("ApiError carries code and details", () => {
    const err = new ApiError("VALIDATION_ERROR", "Invalid email", [
      { field: "email", message: "must be a college email" },
    ]);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details?.[0]?.field).toBe("email");
  });

  it("env schema defaults sensibly in dev", () => {
    process.env.DATABASE_URL ??= "postgres://localhost:5432/upcai";
    process.env.JWT_PRIVATE_KEY ??= "test-key";
    process.env.JWT_PUBLIC_KEY ??= "test-key";
    const env = getEnv();
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.MAIL_PROVIDER).toBe("console");
  });
});

describe("custom providers (AI_CUSTOM_PROVIDERS)", () => {
  it("parses valid entries and applies defaults", () => {
    const providers = getCustomProviders(
      JSON.stringify([{ name: "kimi", baseUrl: "https://api.moonshot.ai/v1", apiKey: "sk-x", model: "kimi-k2" }]),
    );
    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({ name: "kimi", tier: "standard", costPerMTokIn: 0, costPerMTokOut: 0 });
  });

  it("returns [] for empty or default values", () => {
    expect(getCustomProviders("")).toEqual([]);
    expect(getCustomProviders("[]")).toEqual([]);
  });

  it("skips invalid entries but keeps valid ones", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const providers = getCustomProviders(
      JSON.stringify([
        { name: "bad", baseUrl: "not-a-url", apiKey: "k", model: "m" },
        { name: "good", baseUrl: "https://api.deepseek.com/v1", apiKey: "k", model: "deepseek-chat" },
      ]),
    );
    expect(providers.map((p) => p.name)).toEqual(["good"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("throws a readable error for malformed JSON", () => {
    expect(() => getCustomProviders("{nope")).toThrow(/AI_CUSTOM_PROVIDERS is not valid JSON/);
  });

  it("throws when the value is not an array", () => {
    expect(() => getCustomProviders(JSON.stringify({ name: "x" }))).toThrow(/must be a JSON array/);
  });
});

describe("public model catalog (UPC-1 family)", () => {
  it("maps every tier to a branded model", () => {
    expect(publicModelForTier("fast").label).toBe("UPC-1");
    expect(publicModelForTier("standard").label).toBe("UPC-1 Plus");
    expect(publicModelForTier("frontier").label).toBe("UPC-1 Pro");
  });

  it("resolves models by id and rejects unknown ids", () => {
    expect(publicModelById("upc-1-pro")?.label).toBe("UPC-1 Pro");
    expect(publicModelById("gpt-4o")).toBeUndefined();
    expect(PUBLIC_MODELS).toHaveLength(3);
  });
});
