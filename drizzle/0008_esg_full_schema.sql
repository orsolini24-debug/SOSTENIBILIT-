-- Migration: ESG Full Schema v1
-- Adds canonical indicator ontology, multi-framework mapping, driver map, certification records
-- + enriches sector_distributions and predictions with full statistical output
-- 2026-06-16

-- ============================================================
-- 1. esg_indicators — canonical ESG indicator registry
-- ============================================================
CREATE TABLE IF NOT EXISTS "esg_indicators" (
  "id" text PRIMARY KEY,            -- slug: "scope_1_ghg_emissions", "injury_rate", "anti_corruption_training_rate"
  "code" text NOT NULL,             -- internal: "E-E1-001", "E-S1-005", "E-G1-003"
  "name" text NOT NULL,
  "description" text,
  "pillar" text NOT NULL,           -- 'E' | 'S' | 'G'
  "topic" text NOT NULL,            -- 'climate' | 'pollution' | 'water' | 'biodiversity' | 'circularity'
                                    --  | 'own_workforce' | 'value_chain_workers' | 'affected_communities'
                                    --  | 'consumers_end_users' | 'business_conduct'
  "canonical_unit" text,            -- "tCO2e", "kWh", "m3", "hours", "%", "boolean", "maturity_0_4"
  "allowed_units" jsonb DEFAULT '[]',
  "metric_type" text NOT NULL,      -- 'quantitative_absolute' | 'quantitative_intensity' | 'percentage'
                                    -- | 'boolean_control' | 'categorical_maturity' | 'narrative_disclosure'
                                    -- | 'evidence_required'
  "framework_mappings" jsonb DEFAULT '{}',
  -- {"ESRS": "E1-6", "VSME": "B7", "GRI": "305-1", "SASB": "IF-EU-110a.1", "GHG_Protocol": "Scope1",
  --  "OECD": "Due Diligence Guidance Ch.6", "ISO": "ISO 14064", "SDG": "13", "B_Corp": "ENV-Q10"}
  "materiality_default_by_sector" jsonb DEFAULT '{}',
  -- {"meccatronica": "high", "utilities": "high", "gdo_retail": "medium", "default": "medium"}
  "assurance_relevance" text DEFAULT 'medium',  -- 'high' | 'medium' | 'low' | 'not_applicable'
  "vsme_disclosure_id" text,         -- e.g. "VSME-B7" for cross-reference with datapoints table
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now()
);

-- ============================================================
-- 2. indicator_driver_map — driver hierarchy per indicator
-- ============================================================
CREATE TABLE IF NOT EXISTS "indicator_driver_map" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "indicator_id" text NOT NULL REFERENCES "esg_indicators"("id"),
  "primary_driver" text NOT NULL,    -- "employees", "facility_area_sqm", "revenue_eur", "fleet_size", "hours_worked", "procurement_spend_eur"
  "secondary_driver" text,
  "fallback_driver" text NOT NULL DEFAULT 'employees',
  "denominator_unit" text NOT NULL,  -- "FTE", "m2", "MEUR", "hours", "suppliers"
  "intensity_formula" text,          -- human readable: "tCO2e / FTE"
  "fallback_formula" text,           -- "tCO2e / FTE (fallback from revenue)"
  "driver_requiredness" text DEFAULT 'recommended',  -- 'required' | 'recommended' | 'optional'
  "driver_quality_impact" text,      -- description of what happens when driver unavailable
  "valid_for_clusters" jsonb DEFAULT 'null',  -- null = all clusters; array of cluster names = specific
  "notes" text,
  "created_at" timestamp DEFAULT now()
);

-- ============================================================
-- 3. framework_disclosure_map — multi-framework cross-reference
-- ============================================================
CREATE TABLE IF NOT EXISTS "framework_disclosure_map" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "indicator_id" text NOT NULL REFERENCES "esg_indicators"("id"),
  "framework" text NOT NULL,         -- 'ESRS' | 'VSME' | 'GRI' | 'SASB' | 'IFRS' | 'GHG_Protocol'
                                     -- | 'OECD' | 'CSDDD' | 'ISO' | 'SA8000' | 'B_Corp' | 'SDG'
                                     -- | 'EU_Taxonomy' | 'TCFD' | 'AI_Act'
  "external_id" text NOT NULL,       -- "E1-6", "GRI 305-1", "B12", "SASB-IF-EU-110a.1"
  "external_name" text,
  "mapping_type" text DEFAULT 'direct',   -- 'direct' | 'derived' | 'proxy' | 'related'
  "applicability_condition" text,    -- e.g. "CSRD in-scope companies only" or "industrial sectors"
  "disclosure_obligation" text,      -- 'mandatory' | 'voluntary' | 'conditional' | 'sector_specific'
  "notes" text,
  "created_at" timestamp DEFAULT now()
);

-- ============================================================
-- 4. certification_records — certifications as evidence/control objects
-- ============================================================
CREATE TABLE IF NOT EXISTS "certification_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid REFERENCES "companies"("id") ON DELETE CASCADE,
  "standard_name" text NOT NULL,    -- 'ISO_14001' | 'ISO_50001' | 'ISO_37001' | 'ISO_37301'
                                    -- | 'ISO_37002' | 'ISO_27001' | 'ISO_42001' | 'SA8000'
                                    -- | 'B_Corp' | 'EMAS' | 'SMETA' | 'WRAP' | 'FSC' | 'RSPO'
                                    -- | 'EU_EcoLabel' | 'GreenStar' | 'LEED' | 'BREEAM'
  "standard_version" text,          -- e.g. "2015 (rev. 2023)", "V2.1 (B Corp 2026)"
  "pillar_coverage" jsonb DEFAULT '[]',      -- ["E"], ["S"], ["G"], ["E","S"]
  "topic_coverage" jsonb DEFAULT '[]',       -- ["climate","energy"], ["own_workforce"], ["business_conduct"]
  "certifiable" boolean DEFAULT true,
  "issuer_or_owner" text,           -- company name or issuing body
  "certification_body" text,        -- accredited auditor / certifying body
  "scope" text DEFAULT 'group',     -- 'group' | 'site' | 'business_unit' | 'product' | 'process'
  "scope_description" text,         -- free text description of what's covered
  "valid_from" timestamp,
  "valid_to" timestamp,
  "evidence_document_id" uuid REFERENCES "documents"("id") ON DELETE SET NULL,
  "assurance_level" text,           -- 'limited' | 'reasonable' | 'certification' | 'self_declared'
  "mapped_controls" jsonb DEFAULT '[]',      -- array of control IDs / descriptions this cert covers
  "mapped_disclosures" jsonb DEFAULT '[]',   -- ESRS/GRI/VSME disclosure IDs evidence by this cert
  "confidence_boost_allowed" boolean DEFAULT true,
  -- IMPORTANT: cert can increase confidence on PRESENCE of system/control, NOT on quantitative value
  "confidence_boost_scope" jsonb DEFAULT '[]',
  -- which indicator_ids this cert can boost confidence for
  "limitations" text,
  -- e.g. "ISO 14001 covers management system, not emission levels. Does not justify emission estimate."
  "created_at" timestamp DEFAULT now()
);

-- ============================================================
-- 5. Enrich sector_distributions
-- ============================================================
ALTER TABLE "sector_distributions"
  ADD COLUMN IF NOT EXISTS "p10" numeric(15,6),
  ADD COLUMN IF NOT EXISTS "p90" numeric(15,6),
  ADD COLUMN IF NOT EXISTS "mean_intensity" numeric(15,6),
  ADD COLUMN IF NOT EXISTS "std_intensity" numeric(15,6),
  ADD COLUMN IF NOT EXISTS "iqr" numeric(15,6),
  ADD COLUMN IF NOT EXISTS "interval_width_ratio" numeric(6,3),
  -- (p90-p10)/median — a normalized uncertainty measure. Flag if >3.0
  ADD COLUMN IF NOT EXISTS "data_quality_score" numeric(3,2),
  -- 0.00–1.00: composite of n_sample, source quality, driver availability
  ADD COLUMN IF NOT EXISTS "confidence" text DEFAULT 'Bassa',
  -- 'Alta' | 'Media' | 'Bassa' (at distribution level, separate from prediction-time confidence)
  ADD COLUMN IF NOT EXISTS "esg_indicator_id" text REFERENCES "esg_indicators"("id");
  -- optional FK to esg_indicators for gradual migration (indicatorId is still the primary key)

-- ============================================================
-- 6. Enrich predictions
-- ============================================================
ALTER TABLE "predictions"
  ADD COLUMN IF NOT EXISTS "p10_value" numeric(15,4),
  ADD COLUMN IF NOT EXISTS "p90_value" numeric(15,4),
  ADD COLUMN IF NOT EXISTS "interval_width_ratio" numeric(6,3),
  ADD COLUMN IF NOT EXISTS "data_quality_score" numeric(3,2),
  ADD COLUMN IF NOT EXISTS "evidence_to_request" jsonb DEFAULT '[]',
  -- list of evidence items user should provide to improve this prediction
  -- e.g. [{"type":"document","description":"Fattura energia elettrica 2024"},
  --       {"type":"form_field","key":"fleet_size","label":"Numero veicoli fleet"}]
  ADD COLUMN IF NOT EXISTS "assumptions" text,
  ADD COLUMN IF NOT EXISTS "limitations" text,
  ADD COLUMN IF NOT EXISTS "requires_human_validation" boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS "method" text DEFAULT 'peer_median',
  -- 'peer_median' | 'hierarchical_shrinkage' | 'external_benchmark' | 'rule_based_proxy' | 'unavailable'
  ADD COLUMN IF NOT EXISTS "driver_used" text,
  ADD COLUMN IF NOT EXISTS "denominator_value" numeric(15,2);

-- ============================================================
-- 7. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS "esg_indicators_pillar_idx" ON "esg_indicators"("pillar");
CREATE INDEX IF NOT EXISTS "esg_indicators_topic_idx" ON "esg_indicators"("topic");
CREATE INDEX IF NOT EXISTS "indicator_driver_map_indicator_idx" ON "indicator_driver_map"("indicator_id");
CREATE INDEX IF NOT EXISTS "framework_disclosure_map_indicator_idx" ON "framework_disclosure_map"("indicator_id");
CREATE INDEX IF NOT EXISTS "framework_disclosure_map_framework_idx" ON "framework_disclosure_map"("framework");
CREATE INDEX IF NOT EXISTS "certification_records_company_idx" ON "certification_records"("company_id");
CREATE INDEX IF NOT EXISTS "certification_records_standard_idx" ON "certification_records"("standard_name");
