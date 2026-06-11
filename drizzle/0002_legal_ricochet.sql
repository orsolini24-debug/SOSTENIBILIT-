CREATE TABLE "extraction_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"extraction_run_id" uuid,
	"datapoint_id" text,
	"raw_value" text,
	"normalized_value" text,
	"unit_raw" text,
	"unit_normalized" text,
	"confidence" "confidence" DEFAULT 'Bassa',
	"page_reference" integer,
	"evidence_text" text,
	"table_coordinates" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"datapoint_value_id" uuid,
	"user_id" uuid,
	"decision" text NOT NULL,
	"comment" text,
	"corrected_value" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "validation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"datapoint_value_id" uuid,
	"rule_id" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vsme_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vsme_id" text,
	"external_framework" text NOT NULL,
	"external_id" text NOT NULL,
	"mapping_type" text DEFAULT 'direct',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "raw_value" text;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "unit_raw" text;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "unit_normalized" text;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "period" text DEFAULT 'FY';--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "year" integer;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "disclosure_id" text;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "framework_concept_id" text;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "extraction_method" text DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "validation_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "reviewer_decision" text;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "version" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "lineage_hash" text;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "page" integer;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "table_coordinates" jsonb;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "evidence_text" text;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "evidence_hash" text;--> statement-breakpoint
ALTER TABLE "datapoint_values" ADD COLUMN "provenance" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "extraction_candidates" ADD CONSTRAINT "extraction_candidates_extraction_run_id_extraction_runs_id_fk" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_candidates" ADD CONSTRAINT "extraction_candidates_datapoint_id_datapoints_id_fk" FOREIGN KEY ("datapoint_id") REFERENCES "public"."datapoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_datapoint_value_id_datapoint_values_id_fk" FOREIGN KEY ("datapoint_value_id") REFERENCES "public"."datapoint_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_datapoint_value_id_datapoint_values_id_fk" FOREIGN KEY ("datapoint_value_id") REFERENCES "public"."datapoint_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vsme_mapping" ADD CONSTRAINT "vsme_mapping_vsme_id_datapoints_id_fk" FOREIGN KEY ("vsme_id") REFERENCES "public"."datapoints"("id") ON DELETE no action ON UPDATE no action;