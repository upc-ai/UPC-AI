import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveStorageConfig, objectPathFor, localPathFor, STORAGE_BUCKET } from "./storage";

describe("resolveStorageConfig", () => {
  it("returns null unless both SUPABASE_URL and service key are set", () => {
    expect(resolveStorageConfig({})).toBeNull();
    expect(resolveStorageConfig({ SUPABASE_URL: "https://x.supabase.co" })).toBeNull();
    expect(resolveStorageConfig({ SUPABASE_SERVICE_ROLE_KEY: "secret" })).toBeNull();
  });

  it("configures the upc-docs bucket and strips trailing slash", () => {
    const cfg = resolveStorageConfig({ SUPABASE_URL: "https://x.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "secret" })!;
    expect(cfg.supabaseUrl).toBe("https://x.supabase.co");
    expect(cfg.bucket).toBe(STORAGE_BUCKET);
    expect(cfg.bucket).toBe("upc-docs");
  });
});

describe("objectPathFor", () => {
  it("nests raw files by document id and extension", () => {
    expect(objectPathFor("abc-123", "pdf")).toBe("raw/abc-123.pdf");
  });
});

describe("localPathFor", () => {
  it("maps bucket paths into the local storage dir", () => {
    const p = localPathFor("upc-docs/raw/abc.pdf");
    expect(p).toContain(`storage`);
    const parts = p.split(/[\\/]/);
    expect(parts.slice(-3)).toEqual(["upc-docs", "raw", "abc.pdf"]);
  });

  it("passes absolute non-bucket paths through untouched", () => {
    const abs = path.join("C:", "storage", "raw", "abc.pdf");
    expect(localPathFor(abs)).toBe(abs);
  });
});
