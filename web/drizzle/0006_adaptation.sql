CREATE TABLE "edition_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"edition_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"section_id" uuid,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"kid_title" text,
	"recap" text,
	"text_path" text NOT NULL,
	"words" integer NOT NULL,
	"original_words" integer NOT NULL,
	"change_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fix_note" text,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edition_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"edition_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"section_ids" jsonb NOT NULL,
	"chapters_done" integer DEFAULT 0 NOT NULL,
	"estimate_usd" numeric(10, 4) DEFAULT '0' NOT NULL,
	"cap_usd" numeric(10, 2) NOT NULL,
	"spent_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"comments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"overall" text DEFAULT '' NOT NULL,
	"stage" text,
	"error" text,
	"workflow_run_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "edition_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"edition_id" uuid NOT NULL,
	"number" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"level" text NOT NULL,
	"guidance" text DEFAULT '' NOT NULL,
	"manifest" jsonb NOT NULL,
	"run_id" uuid,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_settings" ADD COLUMN "monthly_budget" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "editions" ADD COLUMN "notice" text;--> statement-breakpoint
ALTER TABLE "editions" ADD COLUMN "notice_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "edition_chapters" ADD CONSTRAINT "edition_chapters_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_chapters" ADD CONSTRAINT "edition_chapters_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_chapters" ADD CONSTRAINT "edition_chapters_run_id_edition_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."edition_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_chapters" ADD CONSTRAINT "edition_chapters_section_id_book_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."book_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_runs" ADD CONSTRAINT "edition_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_runs" ADD CONSTRAINT "edition_runs_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_versions" ADD CONSTRAINT "edition_versions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_versions" ADD CONSTRAINT "edition_versions_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_versions" ADD CONSTRAINT "edition_versions_run_id_edition_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."edition_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edition_chapters_run_idx" ON "edition_chapters" USING btree ("run_id","position");--> statement-breakpoint
CREATE INDEX "edition_runs_edition_idx" ON "edition_runs" USING btree ("edition_id","started_at");--> statement-breakpoint
CREATE INDEX "edition_versions_edition_idx" ON "edition_versions" USING btree ("edition_id","created_at");