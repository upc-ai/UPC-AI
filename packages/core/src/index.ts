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
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().default(""),
  COLLEGE_EMAIL_DOMAINS: z.string().default("upc.ac.in"),

  // Mail (OTP delivery) — dev mode logs codes instead of sending
  MAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().default(""),
  MAIL_FROM: z.string().default("UPC AI <no-reply@upcai.app>"),

  // AI providers (optional at boot; gateway degrades gracefully)
  GROQ_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().default(""),
  OPENAI_EMBEDDING_KEY: z.string().default(""),

  // Bring-your-own OpenAI-compatible providers — JSON array, see customProviderSchema
  AI_CUSTOM_PROVIDERS: z.string().default("[]"),

  // Embeddings (RAG) — provider-switchable; Gemini via the OpenAI-compat
  // endpoint with dimensions=1536 pairs with the pgvector column. When no
  // key is resolvable, ingestion indexes without vectors (BM25-only retrieval).
  EMBEDDING_PROVIDER: z.enum(["openai", "gemini"]).default("gemini"),
  EMBEDDING_API_KEY: z.string().default(""),
  EMBEDDING_BASE_URL: z.string().default(""),

  // Supabase Storage (durable raw-file storage for production ingestion)
  SUPABASE_URL: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),

  // College website sync (RAG v2) — default target for the admin sync button
  COLLEGE_WEBSITE_URL: z.string().default(""),

  // Direct Gemini key (optional — the AI_CUSTOM_PROVIDERS fallback covers
  // the common setup; this lets ops set a dedicated embeddings key)
  GEMINI_API_KEY: z.string().default(""),

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
/* Model tiers & public model catalog                                  */
/* ------------------------------------------------------------------ */

export const MODEL_TIERS = ["fast", "standard", "frontier"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

/**
 * User-facing model catalog. Students never see vendor names — the gateway
 * routes each tier to whatever real provider is configured server-side.
 */
export interface PublicModel {
  id: string; // what the client sends
  label: string; // what users see
  tier: ModelTier; // gateway routing tier
  description: string; // one-line blurb for the picker
}

export const PUBLIC_MODELS: PublicModel[] = [
  { id: "upc-1", label: "UPC-1", tier: "fast", description: "Fast answers for quick doubts" },
  { id: "upc-1-plus", label: "UPC-1 Plus", tier: "standard", description: "Balanced for everyday studying" },
  { id: "upc-1-pro", label: "UPC-1 Pro", tier: "frontier", description: "Deepest reasoning for hard problems" },
];

export function publicModelById(id: string): PublicModel | undefined {
  return PUBLIC_MODELS.find((m) => m.id === id);
}

export function publicModelForTier(tier: ModelTier): PublicModel {
  return PUBLIC_MODELS.find((m) => m.tier === tier) ?? PUBLIC_MODELS[1]!;
}

/* ------------------------------------------------------------------ */
/* Custom (bring-your-own) OpenAI-compatible providers                 */
/* ------------------------------------------------------------------ */

export const customProviderSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  tier: z.enum(MODEL_TIERS).default("standard"),
  costPerMTokIn: z.coerce.number().min(0).default(0), // USD / 1M tokens, optional
  costPerMTokOut: z.coerce.number().min(0).default(0),
});

export type CustomProviderConfig = z.infer<typeof customProviderSchema>;

/**
 * DB-stored provider spec (admin panel "Providers & Models" page). The API
 * key is deliberately ABSENT — secrets live in env/secrets-manager only.
 * `apiKeyEnv` names the env var to read the key from at call time, and
 * `apiKeyName` is what the panel displays (masked status, never the value).
 */
export const managedProviderSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKeyEnv: z.string().min(1), // e.g. "GEMINI_API_KEY" — resolved at runtime
  apiKeyName: z.string().min(1), // human label, e.g. "Gemini main key"
  model: z.string().min(1),
  tier: z.enum(MODEL_TIERS).default("standard"),
  costPerMTokIn: z.coerce.number().min(0).default(0),
  costPerMTokOut: z.coerce.number().min(0).default(0),
  enabled: z.boolean().default(true),
});

export type ManagedProviderConfig = z.infer<typeof managedProviderSchema>;

/**
 * Parse AI_CUSTOM_PROVIDERS (JSON array). Throws a readable error when the
 * whole value is malformed; individual invalid entries are skipped with a
 * warning so one bad entry can't take down chat.
 */
export function getCustomProviders(raw?: string): CustomProviderConfig[] {
  const value = (raw ?? getEnv().AI_CUSTOM_PROVIDERS).trim();
  if (!value || value === "[]") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Invalid environment: AI_CUSTOM_PROVIDERS is not valid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid environment: AI_CUSTOM_PROVIDERS must be a JSON array of provider objects");
  }

  const valid: CustomProviderConfig[] = [];
  for (const entry of parsed) {
    const result = customProviderSchema.safeParse(entry);
    if (result.success) {
      valid.push(result.data);
    } else {
      const name = typeof entry === "object" && entry !== null && "name" in entry ? String(entry.name) : "unnamed";
      console.warn(`[custom-providers] skipping "${name}": ${result.error.issues[0]?.message ?? "invalid entry"}`);
    }
  }
  return valid;
}

/* ------------------------------------------------------------------ */
/* Domain constants                                                    */
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

/** Shared password policy (signup, reset, change). One place to tighten.
 *  Letters (upper+lower) and a digit are mandatory; a special character is
 *  RECOMMENDED but not required (user decision 2026-09-10 — students must not
 *  be blocked at signup for missing a symbol). */
export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[0-9]/, "Must contain a digit");

/** Client-side rule list for the signup/reset live checklists. */
export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (pw: string) => pw.length >= 8, optional: false },
  { id: "upper", label: "An uppercase letter (A–Z)", test: (pw: string) => /[A-Z]/.test(pw), optional: false },
  { id: "lower", label: "A lowercase letter (a–z)", test: (pw: string) => /[a-z]/.test(pw), optional: false },
  { id: "digit", label: "A number (0–9)", test: (pw: string) => /[0-9]/.test(pw), optional: false },
  { id: "symbol", label: "A special character (!@#$…) — recommended", test: (pw: string) => /[^A-Za-z0-9]/.test(pw), optional: true },
] as const;

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
