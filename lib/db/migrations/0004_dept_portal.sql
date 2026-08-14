CREATE TYPE "public"."staff_role" AS ENUM('DEPT_ADMIN', 'FIELD_STAFF');--> statement-breakpoint
CREATE TABLE "department_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"municipality_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"role" "staff_role" NOT NULL,
	CONSTRAINT "department_memberships_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "possible_duplicate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "pipeline_combined" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "pipeline_nsfw" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "pipeline_collusion" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "nearest_hamming" integer;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "nearest_cosine" real;--> statement-breakpoint
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dept_memberships_dept_ix" ON "department_memberships" USING btree ("department_id");