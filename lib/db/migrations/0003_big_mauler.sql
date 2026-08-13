CREATE TABLE "ai_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_sha256" varchar(64) NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"is_civic_issue" boolean,
	"category" "category",
	"confidence" real,
	"spam_suspected" boolean,
	"reason" text,
	"bbox" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_comparison_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid,
	"comparison_type" text NOT NULL,
	"image1_sha256" varchar(64) NOT NULL,
	"image2_sha256" varchar(64) NOT NULL,
	"same_physical_issue" boolean,
	"same_scene" boolean,
	"issue_addressed" boolean,
	"confidence" real,
	"reason" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "spam_flag" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "duplicate_flag" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "ai_analysis_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "ai_reason" text;--> statement-breakpoint
ALTER TABLE "ai_comparison_results" ADD CONSTRAINT "ai_comparison_results_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_analyses_sha256_ix" ON "ai_analyses" USING btree ("image_sha256");--> statement-breakpoint
CREATE INDEX "ai_comparisons_report_ix" ON "ai_comparison_results" USING btree ("report_id");