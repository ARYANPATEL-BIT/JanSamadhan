CREATE TYPE "public"."capture_path" AS ENUM('IN_APP', 'GALLERY');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('pothole', 'garbage_dump', 'streetlight_out', 'waterlogging', 'broken_footpath', 'open_drain', 'illegal_dumping', 'damaged_signage', 'fallen_tree', 'stray_animal', 'other');--> statement-breakpoint
CREATE TYPE "public"."escalation_trigger" AS ENUM('STALE_30D', 'REOPENED_TWICE', 'SLA_BREACH');--> statement-breakpoint
CREATE TYPE "public"."lang" AS ENUM('en', 'hi', 'bn', 'mr', 'ta', 'te');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('REPORT', 'BEFORE', 'AFTER', 'CORROBORATING');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_CITIZEN_VERIFICATION', 'RESOLVED', 'REOPENED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');--> statement-breakpoint
CREATE TYPE "public"."verification_verdict" AS ENUM('CONFIRM', 'REOPEN');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sla_due_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "category_department_map" (
	"municipality_id" uuid NOT NULL,
	"category" "category" NOT NULL,
	"department_id" uuid NOT NULL,
	"sla_hours" integer NOT NULL,
	CONSTRAINT "category_department_map_municipality_id_category_pk" PRIMARY KEY("municipality_id","category")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact" text
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"trigger" "escalation_trigger" NOT NULL,
	"escalated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "municipalities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"boundary" geography(Polygon,4326)
);
--> statement-breakpoint
CREATE TABLE "report_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"kind" "media_kind" DEFAULT 'REPORT' NOT NULL,
	"url" text NOT NULL,
	"phash" bit(64),
	"sha256" varchar(64),
	"embedding" vector(512),
	"capture_path" "capture_path" DEFAULT 'IN_APP' NOT NULL,
	"captured_at" timestamp with time zone,
	"gps_accuracy_m" real,
	"exif_present" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"category" "category" NOT NULL,
	"category_confidence" real,
	"location" geography(Point,4326) NOT NULL,
	"ward_id" uuid,
	"department_id" uuid,
	"status" "report_status" DEFAULT 'SUBMITTED' NOT NULL,
	"priority_score" real DEFAULT 0 NOT NULL,
	"upvote_count" integer DEFAULT 0 NOT NULL,
	"parent_report_id" uuid,
	"capture_trust" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sla_due_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"reopen_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"from_status" "report_status",
	"to_status" "report_status" NOT NULL,
	"actor_id" uuid,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upvotes" (
	"user_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upvotes_user_id_report_id_pk" PRIMARY KEY("user_id","report_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"name" text,
	"lang" "lang" DEFAULT 'en' NOT NULL,
	"civic_score" integer DEFAULT 0 NOT NULL,
	"tier" "tier" DEFAULT 'BRONZE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"verdict" "verification_verdict" NOT NULL,
	"rating" integer,
	"reason" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"ward_no" integer NOT NULL,
	"boundary" geography(Polygon,4326) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_department_map" ADD CONSTRAINT "category_department_map_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_department_map" ADD CONSTRAINT "category_department_map_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_media" ADD CONSTRAINT "report_media_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_events" ADD CONSTRAINT "status_events_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_events" ADD CONSTRAINT "status_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upvotes" ADD CONSTRAINT "upvotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upvotes" ADD CONSTRAINT "upvotes_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wards" ADD CONSTRAINT "wards_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_media_report_ix" ON "report_media" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "report_media_sha256_ix" ON "report_media" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "reports_location_gix" ON "reports" USING gist ("location");--> statement-breakpoint
CREATE INDEX "reports_status_ix" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reports_ward_ix" ON "reports" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX "reports_department_ix" ON "reports" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "reports_category_ix" ON "reports" USING btree ("category");--> statement-breakpoint
CREATE INDEX "wards_boundary_gix" ON "wards" USING gist ("boundary");