CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"page" integer NOT NULL,
	"table_id" text,
	"row_idx" integer,
	"col_idx" integer,
	"heading" text,
	"bbox" jsonb,
	"source_hash" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "datapoint_values" ALTER COLUMN "state" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "datapoint_values" ALTER COLUMN "state" SET DEFAULT 'estimated'::text;--> statement-breakpoint
ALTER TABLE "validation_events" ALTER COLUMN "previous_state" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "validation_events" ALTER COLUMN "new_state" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."datapoint_state";--> statement-breakpoint
CREATE TYPE "public"."datapoint_state" AS ENUM('estimated', 'declared_by_company', 'auto_extracted_candidate', 'rule_validated', 'manual_review_required', 'manually_validated', 'rejected', 'conflict_review');--> statement-breakpoint
ALTER TABLE "datapoint_values" ALTER COLUMN "state" SET DEFAULT 'estimated'::"public"."datapoint_state";--> statement-breakpoint
ALTER TABLE "datapoint_values" ALTER COLUMN "state" SET DATA TYPE "public"."datapoint_state" USING "state"::"public"."datapoint_state";--> statement-breakpoint
ALTER TABLE "validation_events" ALTER COLUMN "previous_state" SET DATA TYPE "public"."datapoint_state" USING "previous_state"::"public"."datapoint_state";--> statement-breakpoint
ALTER TABLE "validation_events" ALTER COLUMN "new_state" SET DATA TYPE "public"."datapoint_state" USING "new_state"::"public"."datapoint_state";--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doc_page_idx" ON "document_chunks" USING btree ("document_id","page");