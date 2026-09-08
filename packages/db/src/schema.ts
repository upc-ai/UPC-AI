/**
 * UPC AI — Database schema v1 (MVP cut per MASTER_PLAN §2).
 * Source of truth: docs/UPC_AI_Database_Architecture.md (v1.1).
 * Conventions: UUID PKs, timestamptz everywhere, soft delete via deleted_at,
 * enums at the DB layer, JSONB for flexible metadata.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  smallint,
  bigint,
  timestamp,
  date,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  customType,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Custom types                                                         */
/* ------------------------------------------------------------------ */

/** pgvector column. Dimension fixed at 1536 (text-embedding-3-small). */
export const vector = (name: string, dimensions = 1536) =>
  customType<{ data: string; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
  })(name);

/* ------------------------------------------------------------------ */
/* Enums                                                                */
/* ------------------------------------------------------------------ */

export const userTypeEnum = pgEnum("user_type", ["student", "faculty", "admin"]);
export const studyModeEnum = pgEnum("study_mode", ["learn", "practice", "explain_simply", "challenge_me"]);
export const responseLengthEnum = pgEnum("response_length", ["concise", "detailed", "exhaustive"]);
export const difficultyEnum = pgEnum("difficulty", ["beginner", "intermediate", "advanced"]);
export const languageEnum = pgEnum("language", ["en", "hi", "en_hi", "auto"]);
export const themeEnum = pgEnum("theme", ["light", "dark", "system"]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["login", "email_verify", "phone_verify", "password_reset", "step_up"]);
export const sessionTypeEnum = pgEnum("session_type", ["academic", "knowledge", "general", "mixed"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);
export const finishReasonEnum = pgEnum("finish_reason", ["stop", "length", "tool_call", "content_filter", "error"]);
export const intentEnum = pgEnum("intent", ["academic", "knowledge", "mixed", "conversational", "out_of_scope"]);
export const docStatusEnum = pgEnum("doc_status", [
  "uploaded", "scanning", "scan_failed", "parsing", "parse_failed",
  "chunking", "chunk_failed", "embedding", "embed_failed",
  "needs_ocr",
  "indexed", "draft", "in_review", "approved", "published", "superseded", "archived",
]);
export const accessLevelEnum = pgEnum("access_level", ["public", "internal", "restricted"]);
export const chunkStatusEnum = pgEnum("chunk_status", ["active", "superseded", "deleted"]);
export const chunkTypeEnum = pgEnum("chunk_type", ["prose", "table", "heading_section", "slide", "question", "summary", "list", "mixed"]);
export const feedbackTypeEnum = pgEnum("feedback_type", ["thumbs_up", "thumbs_down", "report", "suggestion"]);
export const quizStatusEnum = pgEnum("quiz_status", ["draft", "active", "completed", "abandoned"]);
export const quizQuestionTypeEnum = pgEnum("quiz_question_type", ["mcq", "true_false"]);
export const jobStatusEnum = pgEnum("job_status", ["queued", "processing", "completed", "failed", "dead"]);
export const jobTypeEnum = pgEnum("job_type", ["ingest_document", "reprocess", "reembed"]);

/* ------------------------------------------------------------------ */
/* Identity & access                                                    */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash"), // null for OAuth-only accounts
    displayName: varchar("display_name", { length: 100 }).notNull(),
    avatarUrl: text("avatar_url"),
    userType: userTypeEnum("user_type").notNull(),
    departmentId: uuid("department_id"),
    phone: varchar("phone", { length: 20 }),
    isActive: boolean("is_active").notNull().default(true),
    isVerified: boolean("is_verified").notNull().default(false),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    googleSub: varchar("google_sub", { length: 255 }),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    loginCount: integer("login_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    index("users_department_idx").on(t.departmentId),
    uniqueIndex("users_google_sub_unique").on(t.googleSub),
  ],
);

export const students = pgTable(
  "students",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    enrollmentNumber: varchar("enrollment_number", { length: 50 }),
    rollNumber: varchar("roll_number", { length: 50 }),
    courseId: uuid("course_id"),
    currentYear: smallint("current_year"),
    currentSemester: smallint("current_semester"),
    section: varchar("section", { length: 10 }),
    admissionYear: smallint("admission_year"),
    isHostelResident: boolean("is_hostel_resident").default(false),
    guardianName: varchar("guardian_name", { length: 100 }),
    guardianContact: varchar("guardian_contact", { length: 20 }),
  },
  (t) => [
    uniqueIndex("students_enrollment_unique").on(t.enrollmentNumber),
    index("students_course_idx").on(t.courseId),
  ],
);

export const faculty = pgTable("faculty", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id", { length: 50 }),
  designation: varchar("designation", { length: 100 }),
  specialization: text("specialization"),
  isHod: boolean("is_hod").notNull().default(false),
  joiningDate: date("joining_date"),
});

export const admins = pgTable("admins", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  adminLevel: varchar("admin_level", { length: 50 }).notNull().default("contributor"),
  managedScope: varchar("managed_scope", { length: 50 }).notNull().default("department"),
  appointedBy: uuid("appointed_by"),
  appointedAt: timestamp("appointed_at", { withTimezone: true }).defaultNow(),
});

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleName: varchar("role_name", { length: 50 }).notNull(),
    roleType: varchar("role_type", { length: 20 }).notNull().default("system"), // system | custom
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("roles_name_unique").on(t.roleName)],
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    permissionKey: varchar("permission_key", { length: 100 }).notNull(), // e.g. document:approve
    resource: varchar("resource", { length: 50 }).notNull(),
    action: varchar("action", { length: 50 }).notNull(),
    description: text("description"),
  },
  (t) => [uniqueIndex("permissions_key_unique").on(t.permissionKey)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => roles.id),
    departmentId: uuid("department_id"), // null = college-wide
    grantedBy: uuid("granted_by"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("user_roles_user_idx").on(t.userId)],
);

/** Server-side sessions = refresh-token families. Rotation + reuse detection live here. */
export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(), // SHA-256 of current token
    deviceInfo: jsonb("device_info"),
    ipAddress: varchar("ip_address", { length: 45 }),
    isActive: boolean("is_active").notNull().default(true),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: varchar("revoked_reason", { length: 50 }), // logout | admin_revoke | token_reuse_detected | expired | password_change
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_sessions_refresh_hash_unique").on(t.refreshTokenHash),
    index("user_sessions_user_idx").on(t.userId, t.isActive),
  ],
);

export const otpRecords = pgTable(
  "otp_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    otpHash: text("otp_hash").notNull(), // SHA-256, never plaintext
    purpose: otpPurposeEnum("purpose").notNull(),
    attempts: smallint("attempts").notNull().default(0),
    isUsed: boolean("is_used").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("otp_email_purpose_idx").on(t.email, t.purpose, t.createdAt)],
);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: themeEnum("theme").notNull().default("light"),
  language: languageEnum("language").notNull().default("en"),
  fontScale: smallint("font_scale").notNull().default(100), // 80–120 (%)
  notificationEmail: boolean("notification_email").notNull().default(true),
  notificationPush: boolean("notification_push").notNull().default(false),
  responseLength: responseLengthEnum("response_length").notNull().default("detailed"),
  difficulty: difficultyEnum("difficulty").notNull().default("intermediate"),
  defaultStudyMode: studyModeEnum("default_study_mode").notNull().default("learn"),
  showCitations: boolean("show_citations").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Opt-in long-term personalization memory (v1.1 addition; user-viewable/editable). */
export const userMemory = pgTable("user_memory", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  memorySummary: text("memory_summary"),
  isOptIn: boolean("is_opt_in").notNull().default(false),
  updatedSource: varchar("updated_source", { length: 20 }).notNull().default("user_edit"), // user_edit | ai_derived
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Academic structure                                                   */
/* ------------------------------------------------------------------ */

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 150 }).notNull(),
    code: varchar("code", { length: 20 }).notNull(),
    description: text("description"),
    headFacultyId: uuid("head_faculty_id"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("departments_code_unique").on(t.code)],
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    code: varchar("code", { length: 30 }).notNull(),
    departmentId: uuid("department_id").references(() => departments.id),
    degreeType: varchar("degree_type", { length: 30 }).notNull().default("bachelor"),
    durationYears: smallint("duration_years").notNull().default(3),
    totalSemesters: smallint("total_semesters").notNull().default(6),
  },
  (t) => [uniqueIndex("courses_code_unique").on(t.code)],
);

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    code: varchar("code", { length: 30 }).notNull(),
    courseId: uuid("course_id").references(() => courses.id),
    departmentId: uuid("department_id").references(() => departments.id),
    semester: smallint("semester"),
    year: smallint("year"),
    subjectType: varchar("subject_type", { length: 30 }).notNull().default("theory"),
    syllabusDocumentId: uuid("syllabus_document_id"),
  },
  (t) => [uniqueIndex("subjects_code_unique").on(t.code)],
);

export const academicSessions = pgTable("academic_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 30 }).notNull(), // "2025-26"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
});

/** v1.1 addition — enrolled subjects collected at onboarding. */
export const studentSubjects = pgTable(
  "student_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    source: varchar("source", { length: 20 }).notNull().default("onboarding"), // onboarding | manual | admin
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("student_subjects_unique").on(t.userId, t.subjectId)],
);

/* ------------------------------------------------------------------ */
/* Chat                                                                 */
/* ------------------------------------------------------------------ */

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }),
    sessionType: sessionTypeEnum("session_type").notNull().default("general"),
    subjectId: uuid("subject_id").references(() => subjects.id),
    studyMode: studyModeEnum("study_mode").notNull().default("learn"),
    languagePreference: languageEnum("language_preference").notNull().default("en"),
    isPinned: boolean("is_pinned").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    messageCount: integer("message_count").notNull().default(0),
    summary: text("summary"), // compressed older turns for bounded context
    summaryUpToSequence: integer("summary_up_to_sequence"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("chat_sessions_user_idx").on(t.userId, t.isArchived, t.lastMessageAt.desc())],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    contentFormat: varchar("content_format", { length: 20 }).notNull().default("markdown"),
    intent: intentEnum("intent"),
    intentConfidence: numeric("intent_confidence", { precision: 3, scale: 2 }),
    parentMessageId: uuid("parent_message_id"), // regenerate threading
    isEdited: boolean("is_edited").notNull().default(false),
    originalContent: text("original_content"),
    sequenceNumber: integer("sequence_number").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("messages_session_sequence_unique").on(t.sessionId, t.sequenceNumber),
    index("messages_session_created_idx").on(t.sessionId, t.createdAt),
  ],
);

/** Files a student attached to a chat message (photo of a problem, PDF notes…).
 *  v1 keeps the bytes inline as base64 text; blob storage is a v1.1 concern. */
export const chatAttachments = pgTable(
  "chat_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: text("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_attachments_message_idx").on(t.messageId)],
);

export const aiResponses = pgTable(
  "ai_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    modelUsed: varchar("model_used", { length: 100 }).notNull(),
    providerUsed: varchar("provider_used", { length: 50 }).notNull(),
    promptId: varchar("prompt_id", { length: 100 }),
    promptVersion: integer("prompt_version"),
    tokensInput: integer("tokens_input").notNull().default(0),
    tokensOutput: integer("tokens_output").notNull().default(0),
    costEstimate: numeric("cost_estimate", { precision: 10, scale: 6 }),
    firstTokenLatencyMs: integer("first_token_latency_ms"),
    totalLatencyMs: integer("total_latency_ms"),
    finishReason: finishReasonEnum("finish_reason"),
    cacheHit: boolean("cache_hit").notNull().default(false),
    retrievalUsed: boolean("retrieval_used").notNull().default(false),
    fallbackUsed: boolean("fallback_used").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ai_responses_message_unique").on(t.messageId)],
);

export const citations = pgTable(
  "citations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    chunkId: uuid("chunk_id"),
    documentId: uuid("document_id").notNull(),
    documentTitle: varchar("document_title", { length: 500 }).notNull(),
    documentVersion: integer("document_version").notNull().default(1),
    pageNumber: integer("page_number"),
    chunkIndex: integer("chunk_index"),
    relevanceScore: numeric("relevance_score", { precision: 3, scale: 2 }),
    snippet: text("snippet"),
    citationOrder: smallint("citation_order").notNull().default(1),
    sourceUrl: text("source_url"),
  },
  (t) => [index("citations_message_idx").on(t.messageId, t.citationOrder)],
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }),
    feedbackType: feedbackTypeEnum("feedback_type").notNull(),
    category: varchar("category", { length: 50 }), // accuracy | relevance | outdated | hallucination | citation_wrong | ...
    comment: text("comment"),
    isReviewed: boolean("is_reviewed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("feedback_message_idx").on(t.messageId)],
);

/* ------------------------------------------------------------------ */
/* Documents & RAG                                                      */
/* ------------------------------------------------------------------ */

export const knowledgeCategories = pgTable(
  "knowledge_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    parentCategoryId: uuid("parent_category_id"),
    depth: smallint("depth").notNull().default(0),
    icon: varchar("icon", { length: 50 }),
    displayOrder: smallint("display_order").notNull().default(0),
    documentCount: integer("document_count").notNull().default(0),
  },
  (t) => [uniqueIndex("knowledge_categories_slug_unique").on(t.slug)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalId: uuid("canonical_id").notNull().defaultRandom(), // groups versions
    version: integer("version").notNull().default(1),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    fileType: varchar("file_type", { length: 20 }).notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    mimeType: varchar("mime_type", { length: 100 }),
    storagePath: text("storage_path").notNull(),
    contentHash: varchar("content_hash", { length: 80 }), // sha256 — idempotent reprocessing
    sourceUrl: text("source_url"), // web-sync lineage (RAG v2); null for direct uploads
    categoryId: uuid("category_id").references(() => knowledgeCategories.id),
    departmentId: uuid("department_id").references(() => departments.id),
    accessLevel: accessLevelEnum("access_level").notNull().default("public"),
    audience: jsonb("audience"),
    status: docStatusEnum("status").notNull().default("uploaded"),
    isActiveVersion: boolean("is_active_version").notNull().default(false),
    language: varchar("language", { length: 10 }).notNull().default("en"), // en | hi | en_hi
    pageCount: integer("page_count"),
    wordCount: integer("word_count"),
    chunkCount: integer("chunk_count"),
    embeddingModel: varchar("embedding_model", { length: 100 }), // informational; embeddings table is authoritative
    effectiveDate: date("effective_date"),
    expiryDate: date("expiry_date"),
    processingError: text("processing_error"),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // Exactly one ACTIVE version per canonicalId. Partial (WHERE active):
    // a full unique index would forbid multiple superseded versions of the
    // same document — every replacement adds one more inactive row.
    uniqueIndex("documents_active_version_unique")
      .on(t.canonicalId, t.isActiveVersion)
      .where(sql`${t.isActiveVersion} = true`),
    index("documents_status_idx").on(t.status),
    index("documents_category_idx").on(t.categoryId),
    index("documents_content_hash_idx").on(t.contentHash),
  ],
);

export const uploads = pgTable("uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  virusScanStatus: varchar("virus_scan_status", { length: 20 }).notNull().default("pending"), // pending | clean | infected | scan_error
  scanResult: jsonb("scan_result"),
  uploadSource: varchar("upload_source", { length: 20 }).notNull().default("portal"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    contentHash: varchar("content_hash", { length: 80 }),
    tokenCount: integer("token_count"),
    chunkType: chunkTypeEnum("chunk_type").notNull().default("prose"),
    hierarchyPath: text("hierarchy_path"), // "Hostel Rules > Section 3 > Curfew"
    pageNumber: integer("page_number"),
    pageNumberEnd: integer("page_number_end"),
    tableJson: jsonb("table_json"),
    metadata: jsonb("metadata").notNull().default({}), // filterable: category, department, audience, dates...
    status: chunkStatusEnum("status").notNull().default("active"),
    embeddingModel: varchar("embedding_model", { length: 100 }), // informational
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("chunks_document_index_unique").on(t.documentId, t.chunkIndex),
    index("chunks_document_status_idx").on(t.documentId, t.status),
  ],
);

/** Vectors live in their own table (DBD-07): lean chunks, shadow-upgrade path for model swaps. */
export const embeddings = pgTable(
  "embeddings",
  {
    chunkId: uuid("chunk_id")
      .primaryKey()
      .references(() => chunks.id, { onDelete: "cascade" }),
    embeddingVector: vector("embedding_vector").notNull(),
    embeddingModel: varchar("embedding_model", { length: 100 }).notNull(),
    embeddingModelVersion: varchar("embedding_model_version", { length: 20 }).notNull().default("v1"),
    dimensions: integer("dimensions").notNull().default(1536),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Approximate nearest-neighbor for retrieval's cosine (<=>) search —
    // without it the vector stage sequential-scans every embedding row.
    index("embeddings_vector_hnsw").using("hnsw", t.embeddingVector.op("vector_cosine_ops")),
  ],
);

export const ingestionJobs = pgTable(
  "ingestion_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    jobType: jobTypeEnum("job_type").notNull().default("ingest_document"),
    status: jobStatusEnum("status").notNull().default("queued"),
    stage: varchar("stage", { length: 30 }), // virus_scan | parsing | ocr | chunking | embedding
    stageProgress: smallint("stage_progress").default(0),
    attempts: smallint("attempts").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ingestion_jobs_status_idx").on(t.status, t.createdAt)],
);

/** v1.1 addition — Document Workspace highlights. */
export const highlights = pgTable(
  "highlights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    textContent: text("text_content").notNull(),
    startOffset: integer("start_offset"),
    endOffset: integer("end_offset"),
    color: varchar("color", { length: 20 }).notNull().default("coral"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("highlights_user_doc_idx").on(t.userId, t.documentId)],
);

/* ------------------------------------------------------------------ */
/* Study tools                                                          */
/* ------------------------------------------------------------------ */

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").references(() => subjects.id),
    chatSessionId: uuid("chat_session_id").references(() => chatSessions.id),
    topic: varchar("topic", { length: 300 }),
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("medium"),
    questionCount: smallint("question_count").notNull().default(10),
    timeLimitMinutes: smallint("time_limit_minutes"),
    status: quizStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quizzes_user_idx").on(t.userId, t.createdAt.desc())],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
    sequenceNumber: smallint("sequence_number").notNull(),
    questionType: quizQuestionTypeEnum("question_type").notNull().default("mcq"),
    questionText: text("question_text").notNull(),
    options: jsonb("options"), // string[] for mcq
    correctAnswer: varchar("correct_answer", { length: 500 }).notNull(),
    explanation: text("explanation"),
    sourceChunkId: uuid("source_chunk_id"), // traceability for AI-generated questions
  },
  (t) => [uniqueIndex("quiz_questions_quiz_seq_unique").on(t.quizId, t.sequenceNumber)],
);

export const quizResults = pgTable("quiz_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizId: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  score: smallint("score").notNull(),
  totalMarks: smallint("total_marks").notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  timeTakenSeconds: integer("time_taken_seconds"),
  answers: jsonb("answers"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const flashcards = pgTable(
  "flashcards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").references(() => subjects.id),
    deckName: varchar("deck_name", { length: 200 }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    sourceChunkId: uuid("source_chunk_id"),
    // SM-2 spaced repetition
    easeFactor: numeric("ease_factor", { precision: 3, scale: 2 }).notNull().default("2.50"),
    intervalDays: integer("interval_days").notNull().default(1),
    repetitions: integer("repetitions").notNull().default(0),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }).notNull().defaultNow(),
    totalReviews: integer("total_reviews").notNull().default(0),
    correctReviews: integer("correct_reviews").notNull().default(0),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("flashcards_due_idx").on(t.userId, t.isArchived, t.nextReviewAt)],
);

/** v1.1 addition — powers streaks/heatmap/weak areas. */
export const dailyStudyActivity = pgTable(
  "daily_study_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    activityDate: date("activity_date").notNull(),
    messagesSent: integer("messages_sent").notNull().default(0),
    quizzesTaken: integer("quizzes_taken").notNull().default(0),
    flashcardsReviewed: integer("flashcards_reviewed").notNull().default(0),
    minutesActive: integer("minutes_active").notNull().default(0),
  },
  (t) => [uniqueIndex("daily_activity_unique").on(t.userId, t.activityDate)],
);

/* ------------------------------------------------------------------ */
/* System                                                               */
/* ------------------------------------------------------------------ */

/** v1 audit: simple append-only. Hash chain arrives in v1.2. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    actorIp: varchar("actor_ip", { length: 45 }),
    action: varchar("action", { length: 50 }).notNull(), // approve | publish | login | role_change | ...
    resourceType: varchar("resource_type", { length: 50 }).notNull(),
    resourceId: uuid("resource_id"),
    changeSummary: text("change_summary"),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    requestId: uuid("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_resource_idx").on(t.resourceType, t.resourceId, t.createdAt)],
);

/**
 * RAG telemetry (RAG v2, Backend §6.6 coverage gaps at pilot scale): one row
 * per knowledge-retrieval attempt. Low-score / refused rows are the "unanswered
 * questions" list that drives what to sync or upload next.
 */
export const retrievalLogs = pgTable(
  "retrieval_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    query: text("query").notNull(), // raw student message
    rewrittenQuery: text("rewritten_query"),
    intent: varchar("intent", { length: 20 }).notNull(), // knowledge | mixed
    topScore: numeric("top_score", { precision: 10, scale: 6 }), // fused RRF score
    chunkCount: integer("chunk_count").notNull().default(0),
    refused: boolean("refused").notNull().default(false), // true = grounded refusal fired
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("retrieval_recent_idx").on(t.createdAt.desc()),
    index("retrieval_refused_idx").on(t.refused, t.createdAt.desc()),
  ],
);

export const systemSettings = pgTable(
  "system_settings",
  {
    settingKey: varchar("setting_key", { length: 100 }).primaryKey(),
    value: jsonb("value").notNull(),
    category: varchar("category", { length: 50 }).notNull().default("general"),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

/** Versioned prompt templates — prompt changes are behavior changes. */
export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promptId: varchar("prompt_id", { length: 100 }).notNull(), // e.g. knowledge_grounded
    version: integer("version").notNull(),
    content: text("content").notNull(),
    modelTier: varchar("model_tier", { length: 30 }),
    changelog: text("changelog"),
    rolloutStatus: varchar("rollout_status", { length: 20 }).notNull().default("active"), // draft | canary | active | retired
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("prompt_templates_id_version_unique").on(t.promptId, t.version)],
);
