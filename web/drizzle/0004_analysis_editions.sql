CREATE TABLE "book_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"book_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"chapters_done" integer DEFAULT 0 NOT NULL,
	"chapters_total" integer DEFAULT 0 NOT NULL,
	"model" text NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"error" text,
	"workflow_run_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"settings" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"cost_cap" numeric(10, 2) NOT NULL,
	"estimate" jsonb,
	"sample_guidance" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_analyses" (
	"analysis_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"position" integer NOT NULL,
	"intensities" jsonb NOT NULL,
	"notes" jsonb NOT NULL,
	"summary" text NOT NULL,
	"characters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "section_analyses_analysis_id_section_id_pk" PRIMARY KEY("analysis_id","section_id")
);
--> statement-breakpoint
CREATE TABLE "story_bibles" (
	"book_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"analysis_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_analyses" ADD CONSTRAINT "book_analyses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_analyses" ADD CONSTRAINT "book_analyses_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_analyses" ADD CONSTRAINT "section_analyses_analysis_id_book_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."book_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_analyses" ADD CONSTRAINT "section_analyses_section_id_book_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."book_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_analyses" ADD CONSTRAINT "section_analyses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_bibles" ADD CONSTRAINT "story_bibles_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_bibles" ADD CONSTRAINT "story_bibles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_bibles" ADD CONSTRAINT "story_bibles_analysis_id_book_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."book_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_analyses_book_idx" ON "book_analyses" USING btree ("book_id","started_at");--> statement-breakpoint
CREATE INDEX "editions_book_idx" ON "editions" USING btree ("user_id","book_id");