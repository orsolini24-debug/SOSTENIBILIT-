-- Migration: add sector_coefficients table
-- Stores sector-level benchmark multipliers keyed by ATECO prefix
-- Used by baseline.ts to replace hardcoded industry if/else blocks

CREATE TABLE IF NOT EXISTS "sector_coefficients" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ateco_prefix"     TEXT NOT NULL,
  "coefficient_type" TEXT NOT NULL,
  "value"            NUMERIC(10, 4) NOT NULL,
  "unit"             TEXT NOT NULL,
  "source"           TEXT,
  "sample_size"      INTEGER,
  "confidence"       "confidence" DEFAULT 'Media',
  "last_updated"     TIMESTAMP DEFAULT now()
);

-- Index for fast lookups by ateco_prefix + coefficient_type
CREATE INDEX IF NOT EXISTS idx_sector_coefficients_lookup
  ON "sector_coefficients" ("ateco_prefix", "coefficient_type");
