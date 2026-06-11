CREATE TABLE "cluster_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"ateco_prefix" text NOT NULL,
	"size_class" text NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sector_distributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cluster_id" uuid,
	"indicator_id" text,
	"p25" numeric(15, 4),
	"median" numeric(15, 4),
	"p75" numeric(15, 4),
	"n_sample" integer,
	"source_type" text DEFAULT 'statistical',
	"period" text DEFAULT 'FY2024',
	"version" text DEFAULT '1.0',
	"computed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "sector_distributions" ADD CONSTRAINT "sector_distributions_cluster_id_cluster_definitions_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."cluster_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sector_distributions" ADD CONSTRAINT "sector_distributions_indicator_id_datapoints_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."datapoints"("id") ON DELETE no action ON UPDATE no action;