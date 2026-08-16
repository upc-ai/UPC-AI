/**
 * @upc/core — shared types, environment config, constants.
 * Single source of truth for cross-module contracts.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Environment                                                          */
/* ------------------------------------------------------------------ */

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  // Auth
  JWT_PRIVATE_KEY: z.string().min(1), // RS256 private key (PEM)
  JWT_PUBLIC_KEY: z.string().min(1), // RS256 public key (PEM)
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900), // 15 min
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30), // 30 days

  // Google OAuth (college Workspace)
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  COLLEGE_EMAIL_DOMAINS: z.string().default("upc.ac.in"),

  // Mail (OTP delivery) — dev mode logs codes instead of sending
  MAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().default(""),
  MAIL_FROM: z.string().default("UPC AI <no-reply@upcai.in>"),

  // AI providers (optional at boot; gateway degrades gracefully)
  GROQ_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().default(""),
  OPENAI_EMBEDDING_KEY: z.string().default(""),

  // Object storage
  S3_ENDPOINT: z.string().default(""),
  S3_BUCKET: z.string().default("upc-ai"),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
  S3_REGION: z.string().default("auto"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Parse and cache environment. Throws a readable error listing every missing var. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/* ------------------------------------------------------------------ */
/* Domain constants                                                     */
/* ------------------------------------------------------------------ */

export const STUDY_MODES = ["learn", "practice", "explain_simply", "challenge_me"] as const;
export type StudyMode = (typeof STUDY_MODES)[number];

export const RESPONSE_LENGTHS = ["concise", "detailed", "exhaustive"] as const;
export type ResponseLength = (typeof RESPONSE_LENGTHS)[number];

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const LANGUAGES = ["en", "hi", "auto"] as const;
export type LanguagePreference = (typeof LANGUAGES)[number];

export const INTENTS = ["academic", "knowledge", "mixed", "conversational", "out_of_scope"] as const;
export type Intent = (typeof INTENTS)[number];

export const USER_TYPES = ["student", "faculty", "admin"] as const;
export type UserType = (typeof USER_TYPES)[number];

export const OTP_PURPOSES = ["login", "email_verify", "phone_verify", "password_reset", "step_up"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_SECONDS = 15 * 60;

/* ------------------------------------------------------------------ */
/* API envelope                                                         */
/* ------------------------------------------------------------------ */

export interface ApiWarning {
  code: string;
  message: string;
  detail?: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string; code?: string }[];
    request_id: string;
    timestamp: string;
  };
}

/** Error codes are stable and versionless (Backend Architecture §8). */
export const ERROR_CODES = {
  AUTH_TOKEN_MISSING: 401,
  AUTH_TOKEN_EXPIRED: 401,
  AUTH_TOKEN_INVALID: 401,
  AUTH_CREDENTIALS_INVALID: 401,
  AUTH_OTP_INVALID: 401,
  AUTH_OTP_LOCKED: 403,
  AUTH_REFRESH_EXPIRED: 401,
  AUTH_REFRESH_REVOKED: 401,
  AUTH_REFRESH_REUSED: 403,
  FORBIDDEN: 403,
  ACCOUNT_LOCKED: 403,
  EMAIL_NOT_VERIFIED: 403,
  VALIDATION_ERROR: 400,
  EMAIL_ALREADY_EXISTS: 409,
  RESOURCE_NOT_FOUND: 404,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: { field: string; message: string; code?: string }[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}
