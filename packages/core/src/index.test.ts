import { describe, it, expect } from "vitest";
import { ApiError, ERROR_CODES, STUDY_MODES, getEnv } from "./index";

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
