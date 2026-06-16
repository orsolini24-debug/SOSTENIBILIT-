-- Migration 0009: add missing columns to framework_disclosure_map
-- These columns exist in schema.ts (added in Task #59) but were missing from migration 0008.

ALTER TABLE "framework_disclosure_map"
  ADD COLUMN IF NOT EXISTS "framework_version" text,
  ADD COLUMN IF NOT EXISTS "valid_from" timestamp,
  ADD COLUMN IF NOT EXISTS "valid_to" timestamp,
  ADD COLUMN IF NOT EXISTS "source_reference" text,
  ADD COLUMN IF NOT EXISTS "confidence" text DEFAULT 'high';
