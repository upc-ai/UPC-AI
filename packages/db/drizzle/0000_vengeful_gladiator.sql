CREATE TYPE "public"."access_level" AS ENUM('public', 'internal', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."chunk_status" AS ENUM('active', 'superseded', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."chunk_type" AS ENUM('prose', 'table', 'heading_section', 'slide', 'question', 'summary', 'list', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."doc_status" AS ENUM('uploaded', 'scanning', 'scan_failed', 'parsing', 'parse_failed', 'chunking', 'chunk_failed', 'embedding', 'embed_failed', 'indexed', 'draft', 'in_review', 'approved', 'published', 'superseded', 'archived');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('thumbs_up', 'thumbs_down', 'report', 'suggestion');--> statement-breakpoint
CREATE TYPE "public"."finish_reason" AS ENUM('stop', 'length', 'tool_call', 'content_filter', 'error');--> statement-breakpoint
CREATE TYPE "public"."intent" AS ENUM('academic', 'knowledge', 'mixed', 'conversational', 'out_of_scope');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'processing', 'completed', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('ingest_document', 'reprocess', 'reembed');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'hi', 'en_hi', 'auto');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('login', 'email_verify', 'phone_verify', 'password_reset', 'step_up');--> statement-breakpoint
CREATE TYPE "public"."quiz_question_type" AS ENUM('mcq', 'true_false');--> statement-breakpoint
CREATE TYPE "public"."quiz_status" AS ENUM('draft', 'active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."response_length" AS ENUM('concise', 'detailed', 'exhaustive');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('academic', 'knowledge', 'general', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."study_mode" AS ENUM('learn', 'practice', 'explain_simply', 'challenge_me');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('student', 'faculty', 'admin');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "academic_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(30) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admins" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"admin_level" varchar(50) DEFAULT 'contributor' NOT NULL,
	"managed_scope" varchar(50) DEFAULT 'department' NOT NULL,
	"appointed_by" uuid,
	"appointed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"model_used" varchar(100) NOT NULL,
	"provider_used" varchar(50) NOT NULL,
	"prompt_id" varchar(100),
	"prompt_version" integer,
	"tokens_input" integer DEFAULT 0 NOT NULL,
	"tokens_output" integer DEFAULT 0 NOT NULL,
	"cost_estimate" numeric(10, 6),
	"first_token_latency_ms" integer,
	"total_latency_ms" integer,
	"finish_reason" "finish_reason",
	"cache_hit" boolean DEFAULT false NOT NULL,
	"retrieval_used" boolean DEFAULT false NOT NULL,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_ip" varchar(45),
	"action" varchar(50) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid,
	"change_summary" text,
	"before_state" jsonb,
	"after_state" jsonb,
	"request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200),
	"session_type" "session_type" DEFAULT 'general' NOT NULL,
	"subject_id" uuid,
	"study_mode" "study_mode" DEFAULT 'learn' NOT NULL,
	"language_preference" "language" DEFAULT 'en' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"last_message_at" timestamp with time zone,
	"message_count" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"summary_up_to_sequence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" varchar(80),
	"token_count" integer,
	"chunk_type" "chunk_type" DEFAULT 'prose' NOT NULL,
	"hierarchy_path" text,
	"page_number" integer,
	"page_number_end" integer,
	"table_json" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "chunk_status" DEFAULT 'active' NOT NULL,
	"embedding_model" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"chunk_id" uuid,
	"document_id" uuid NOT NULL,
	"document_title" varchar(500) NOT NULL,
	"document_version" integer DEFAULT 1 NOT NULL,
	"page_number" integer,
	"chunk_index" integer,
	"relevance_score" numeric(3, 2),
	"snippet" text,
	"citation_order" smallint DEFAULT 1 NOT NULL,
	"source_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(30) NOT NULL,
	"department_id" uuid,
	"degree_type" varchar(30) DEFAULT 'bachelor' NOT NULL,
	"duration_years" smallint DEFAULT 3 NOT NULL,
	"total_semesters" smallint DEFAULT 6 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_study_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_date" date NOT NULL,
	"messages_sent" integer DEFAULT 0 NOT NULL,
	"quizzes_taken" integer DEFAULT 0 NOT NULL,
	"flashcards_reviewed" integer DEFAULT 0 NOT NULL,
	"minutes_active" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(20) NOT NULL,
	"description" text,
	"head_faculty_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"file_type" varchar(20) NOT NULL,
	"file_size_bytes" bigint,
	"mime_type" varchar(100),
	"storage_path" text NOT NULL,
	"content_hash" varchar(80),
	"category_id" uuid,
	"department_id" uuid,
	"access_level" "access_level" DEFAULT 'public' NOT NULL,
	"audience" jsonb,
	"status" "doc_status" DEFAULT 'uploaded' NOT NULL,
	"is_active_version" boolean DEFAULT false NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"page_count" integer,
	"word_count" integer,
	"chunk_count" integer,
	"embedding_model" varchar(100),
	"effective_date" date,
	"expiry_date" date,
	"processing_error" text,
	"uploaded_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "embeddings" (
	"chunk_id" uuid PRIMARY KEY NOT NULL,
	"embedding_vector" vector(1536) NOT NULL,
	"embedding_model" varchar(100) NOT NULL,
	"embedding_model_version" varchar(20) DEFAULT 'v1' NOT NULL,
	"dimensions" integer DEFAULT 1536 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "faculty" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"employee_id" varchar(50),
	"designation" varchar(100),
	"specialization" text,
	"is_hod" boolean DEFAULT false NOT NULL,
	"joining_date" date
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" uuid,
	"feedback_type" "feedback_type" NOT NULL,
	"category" varchar(50),
	"comment" text,
	"is_reviewed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flashcards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject_id" uuid,
	"deck_name" varchar(200),
	"front" text NOT NULL,
	"back" text NOT NULL,
	"source_chunk_id" uuid,
	"ease_factor" numeric(3, 2) DEFAULT '2.50' NOT NULL,
	"interval_days" integer DEFAULT 1 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"next_review_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"correct_reviews" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "highlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"text_content" text NOT NULL,
	"start_offset" integer,
	"end_offset" integer,
	"color" varchar(20) DEFAULT 'coral' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingestion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"job_type" "job_type" DEFAULT 'ingest_document' NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"stage" varchar(30),
	"stage_progress" smallint DEFAULT 0,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(150) NOT NULL,
	"parent_category_id" uuid,
	"depth" smallint DEFAULT 0 NOT NULL,
	"icon" varchar(50),
	"display_order" smallint DEFAULT 0 NOT NULL,
	"document_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"content_format" varchar(20) DEFAULT 'markdown' NOT NULL,
	"intent" "intent",
	"intent_confidence" numeric(3, 2),
	"parent_message_id" uuid,
	"is_edited" boolean DEFAULT false NOT NULL,
	"original_content" text,
	"sequence_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "otp_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"otp_hash" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"permission_key" varchar(100) NOT NULL,
	"resource" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prompt_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" varchar(100) NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"model_tier" varchar(30),
	"changelog" text,
	"rollout_status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"sequence_number" smallint NOT NULL,
	"question_type" "quiz_question_type" DEFAULT 'mcq' NOT NULL,
	"question_text" text NOT NULL,
	"options" jsonb,
	"correct_answer" varchar(500) NOT NULL,
	"explanation" text,
	"source_chunk_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"score" smallint NOT NULL,
	"total_marks" smallint NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"time_taken_seconds" integer,
	"answers" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject_id" uuid,
	"chat_session_id" uuid,
	"topic" varchar(300),
	"difficulty" varchar(20) DEFAULT 'medium' NOT NULL,
	"question_count" smallint DEFAULT 10 NOT NULL,
	"time_limit_minutes" smallint,
	"status" "quiz_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_name" varchar(50) NOT NULL,
	"role_type" varchar(20) DEFAULT 'system' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" varchar(20) DEFAULT 'onboarding' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "students" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enrollment_number" varchar(50),
	"roll_number" varchar(50),
	"course_id" uuid,
	"current_year" smallint,
	"current_semester" smallint,
	"section" varchar(10),
	"admission_year" smallint,
	"is_hostel_resident" boolean DEFAULT false,
	"guardian_name" varchar(100),
	"guardian_contact" varchar(20)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(30) NOT NULL,
	"course_id" uuid,
	"department_id" uuid,
	"semester" smallint,
	"year" smallint,
	"subject_type" varchar(30) DEFAULT 'theory' NOT NULL,
	"syllabus_document_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_settings" (
	"setting_key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"category" varchar(50) DEFAULT 'general' NOT NULL,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"virus_scan_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"scan_result" jsonb,
	"upload_source" varchar(20) DEFAULT 'portal' NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_memory" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"memory_summary" text,
	"is_opt_in" boolean DEFAULT false NOT NULL,
	"updated_source" varchar(20) DEFAULT 'user_edit' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" "theme" DEFAULT 'light' NOT NULL,
	"language" "language" DEFAULT 'en' NOT NULL,
	"font_scale" smallint DEFAULT 100 NOT NULL,
	"notification_email" boolean DEFAULT true NOT NULL,
	"notification_push" boolean DEFAULT false NOT NULL,
	"response_length" "response_length" DEFAULT 'detailed' NOT NULL,
	"difficulty" "difficulty" DEFAULT 'intermediate' NOT NULL,
	"default_study_mode" "study_mode" DEFAULT 'learn' NOT NULL,
	"show_citations" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"department_id" uuid,
	"granted_by" uuid,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"device_info" jsonb,
	"ip_address" varchar(45),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text,
	"display_name" varchar(100) NOT NULL,
	"avatar_url" text,
	"user_type" "user_type" NOT NULL,
	"department_id" uuid,
	"phone" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"google_sub" varchar(255),
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"login_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_responses" ADD CONSTRAINT "ai_responses_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "citations" ADD CONSTRAINT "citations_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "courses" ADD CONSTRAINT "courses_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_study_activity" ADD CONSTRAINT "daily_study_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_category_id_knowledge_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."knowledge_categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "faculty" ADD CONSTRAINT "faculty_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "highlights" ADD CONSTRAINT "highlights_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_results" ADD CONSTRAINT "quiz_results_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_results" ADD CONSTRAINT "quiz_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_chat_session_id_chat_sessions_id_fk" FOREIGN KEY ("chat_session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_subjects" ADD CONSTRAINT "student_subjects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_subjects" ADD CONSTRAINT "student_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subjects" ADD CONSTRAINT "subjects_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subjects" ADD CONSTRAINT "subjects_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "uploads" ADD CONSTRAINT "uploads_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_responses_message_unique" ON "ai_responses" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_sessions_user_idx" ON "chat_sessions" USING btree ("user_id","is_archived","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chunks_document_index_unique" ON "chunks" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chunks_document_status_idx" ON "chunks" USING btree ("document_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "citations_message_idx" ON "citations" USING btree ("message_id","citation_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "courses_code_unique" ON "courses" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_activity_unique" ON "daily_study_activity" USING btree ("user_id","activity_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "departments_code_unique" ON "departments" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_active_version_unique" ON "documents" USING btree ("canonical_id","is_active_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_category_idx" ON "documents" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_content_hash_idx" ON "documents" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_message_idx" ON "feedback" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flashcards_due_idx" ON "flashcards" USING btree ("user_id","is_archived","next_review_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "highlights_user_doc_idx" ON "highlights" USING btree ("user_id","document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingestion_jobs_status_idx" ON "ingestion_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_categories_slug_unique" ON "knowledge_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messages_session_sequence_unique" ON "messages" USING btree ("session_id","sequence_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_session_created_idx" ON "messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otp_email_purpose_idx" ON "otp_records" USING btree ("email","purpose","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_key_unique" ON "permissions" USING btree ("permission_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prompt_templates_id_version_unique" ON "prompt_templates" USING btree ("prompt_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quiz_questions_quiz_seq_unique" ON "quiz_questions" USING btree ("quiz_id","sequence_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quizzes_user_idx" ON "quizzes" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_unique" ON "roles" USING btree ("role_name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_subjects_unique" ON "student_subjects" USING btree ("user_id","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "students_enrollment_unique" ON "students" USING btree ("enrollment_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_course_idx" ON "students" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_code_unique" ON "subjects" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_refresh_hash_unique" ON "user_sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_department_idx" ON "users" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_sub_unique" ON "users" USING btree ("google_sub");