-- Migration: Predictive Engine v1
-- Adds intensity-first distributions + Bayesian shrinkage fields + prediction runtime tables
-- 2026-06-16

-- 1. Alter sector_distributions: add intensity + shrinkage + quality fields
ALTER TABLE "sector_distributions"
  ADD COLUMN IF NOT EXISTS "intensity_driver" text NOT NULL DEFAULT 'employees',
  ADD COLUMN IF NOT EXISTS "intensity_unit" text NOT NULL DEFAULT 'value/employee',
  ADD COLUMN IF NOT EXISTS "shrinkage_weight" numeric(4,3) DEFAULT 1.000,
  ADD COLUMN IF NOT EXISTS "fallback_level" text DEFAULT 'cluster',
  ADD COLUMN IF NOT EXISTS "sharpness" numeric(6,3);

-- Rename n_sample to match schema (already exists as n_sample, no rename needed)
-- Add unique constraint on cluster+indicator+version
ALTER TABLE "sector_distributions"
  DROP CONSTRAINT IF EXISTS "cluster_indicator_unq";
ALTER TABLE "sector_distributions"
  ADD CONSTRAINT "cluster_indicator_unq" UNIQUE ("cluster_id", "indicator_id", "version");

-- 2. prediction_runs: one record per predict() call
CREATE TABLE IF NOT EXISTS "prediction_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid REFERENCES "companies"("id") ON DELETE CASCADE,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "cluster_id" uuid REFERENCES "cluster_definitions"("id"),
  "distribution_version" text DEFAULT '1.0',
  "input_profile" jsonb NOT NULL DEFAULT '{}',
  "status" text DEFAULT 'completed',
  "created_at" timestamp DEFAULT now()
);

-- 3. predictions: one row per (run, indicator)
CREATE TABLE IF NOT EXISTS "predictions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "run_id" uuid NOT NULL REFERENCES "prediction_runs"("id") ON DELETE CASCADE,
  "indicator_id" text NOT NULL REFERENCES "datapoints"("id"),
  "distribution_id" uuid REFERENCES "sector_distributions"("id"),
  "predicted_value" numeric(15,4),
  "p25_value" numeric(15,4),
  "p75_value" numeric(15,4),
  "unit" text,
  "confidence" "confidence" DEFAULT 'Bassa',
  "fallback_level" text DEFAULT 'cluster',
  "n_sample_used" integer,
  "shrinkage_weight_used" numeric(4,3),
  "rationale" text,
  "state" text DEFAULT 'proposed',
  "created_at" timestamp DEFAULT now()
);

-- 4. user_confirmations: flywheel — user accepts/corrects a prediction
CREATE TABLE IF NOT EXISTS "user_confirmations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "prediction_id" uuid NOT NULL REFERENCES "predictions"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id"),
  "action" text NOT NULL,         -- 'confirmed' | 'corrected' | 'rejected'
  "final_value" numeric(15,4),    -- null if confirmed, set if corrected
  "correction_reason" text,
  "used_in_recompute" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "predictions_run_idx" ON "predictions"("run_id");
CREATE INDEX IF NOT EXISTS "predictions_indicator_idx" ON "predictions"("indicator_id");
CREATE INDEX IF NOT EXISTS "user_confirmations_prediction_idx" ON "user_confirmations"("prediction_id");
CREATE INDEX IF NOT EXISTS "prediction_runs_company_idx" ON "prediction_runs"("company_id");
