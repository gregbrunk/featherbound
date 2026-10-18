CREATE TABLE "character_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"edition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'drawing' NOT NULL,
	"image_id" text,
	"model" text,
	"sticky_model" text,
	"note" text,
	"error" text,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "illustrations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"edition_id" uuid NOT NULL,
	"section_id" uuid,
	"run_id" uuid,
	"source" text NOT NULL,
	"scene" text DEFAULT '' NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"characters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"refused_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "editions" ADD COLUMN "art" jsonb;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "visual_direction" jsonb;--> statement-breakpoint
ALTER TABLE "character_sheets" ADD CONSTRAINT "character_sheets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_sheets" ADD CONSTRAINT "character_sheets_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustrations" ADD CONSTRAINT "illustrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustrations" ADD CONSTRAINT "illustrations_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_sheets_edition_idx" ON "character_sheets" USING btree ("edition_id","position");--> statement-breakpoint
CREATE INDEX "illustrations_edition_idx" ON "illustrations" USING btree ("edition_id");