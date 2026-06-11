import { z } from "zod";

// Zod Schema mirroring schemas/candidate.schema.json
export const CandidateSchema = z.object({
  candidate_id: z.string(),
  extraction_run_id: z.string(),
  company_id: z.string(),
  document_id: z.string(),
  source_document_id: z.string(),
  document_year: z.number().int(),
  source_file: z.string(),
  disclosure_id: z.string(),
  disclosure_label: z.string().optional(),
  kpi_family: z.enum(["GHG", "Energy", "Water", "Waste", "Social", "Governance", "General"]).optional(),
  normalized_value: z.number().nullable(),
  normalized_unit: z.string().nullable().optional(),
  unit_normalized: z.string().nullable(),
  raw_value: z.string(),
  raw_unit: z.string().nullable().optional(),
  unit_raw: z.string().nullable(),
  period: z.string().nullable(),
  year: z.number().int(),
  page_number: z.number().int().min(1),
  page: z.number().int().min(1),
  table_coordinates: z.record(z.string(), z.any()).nullable(),
  evidence_text: z.string(),
  extraction_method: z.enum(["text_regex", "table_coordinate", "hybrid", "fallback_pdf_text", "fallback_ocr_candidate"]),
  confidence: z.number().min(0).max(1),
  rank: z.number().int().min(1),
  retrieval_query: z.string().nullable(),
  retrieval_rank: z.number().int().min(1),
  chunk_id: z.string().nullable(),
  evidence: z.object({
    evidence_id: z.string(),
    page_number: z.number().int().min(1),
    table_index: z.number().int().nullable().optional(),
    row_index: z.number().int().nullable().optional(),
    column_index: z.number().int().nullable().optional(),
    row_label: z.string().nullable().optional(),
    column_header: z.string().nullable().optional(),
    table_context: z.string().nullable().optional(),
    text_snippet: z.string(),
    bbox: z.array(z.number()).length(4).nullable().optional(),
    evidence_hash: z.string(),
  }),
  retrieval: z.object({
    retrieval_strategy: z.enum(["text_regex", "table_coordinate", "hybrid", "fallback_pdf_text", "fallback_ocr_candidate"]),
    source_pages_considered: z.array(z.number().int().min(1)),
    candidate_generation_version: z.string(),
    parser_stack: z.array(z.string()),
    ranking_features: z.array(z.string()).optional(),
    top_k_position: z.number().int().min(1),
  }),
  validation: z.object({
    validation_status: z.enum(["accepted", "rejected", "needs_review"]),
    validation_rules_applied: z.array(z.string()).optional(),
    rejection_flags: z.array(z.string()).optional(),
    unit_normalization_status: z.enum(["exact", "converted", "incompatible", "missing"]),
    year_detection_status: z.enum(["explicit_2024", "inferred_2024", "wrong_year_risk", "missing_year_context"]),
    page_window_status: z.enum(["within_expected_window", "outside_expected_window", "no_ground_truth_reference"]).optional(),
    false_positive_risk: z.enum(["none", "target_or_intensity", "wrong_year", "scope_2_mb_lb_confusion", "scope_3_category", "subtotal_or_total_confusion", "duplicate_candidate", "unmapped_disclosure"]),
    validation_notes: z.string().optional(),
  }),
  review: z.object({
    review_status: z.enum(["machine_only", "human_pending", "human_verified", "human_rejected", "overridden"]),
    reviewed_by: z.string().nullable().optional(),
    reviewed_at: z.string().datetime().nullable().optional(),
    review_notes: z.string().nullable().optional(),
    override_applied: z.boolean(),
    override_reason: z.string().nullable().optional(),
  }),
  reviewer_decision: z.string().nullable(),
  validation_status: z.string(),
  provenance: z.object({
    original_document_name: z.string(),
    original_document_hash: z.string(),
    document_version: z.string(),
    source_url: z.string().nullable().optional(),
    acquisition_date: z.string().optional(),
    extraction_timestamp: z.string().datetime(),
    extractor_version: z.string(),
    git_commit_sha: z.string().nullable().optional(),
    environment_id: z.string(),
  }),
  versioning: z.object({
    schema_version: z.string(),
    extractor_version: z.string(),
    gate_version: z.string(),
    ground_truth_dataset_version: z.string().nullable().optional(),
    disclosure_dictionary_version: z.string(),
    created_at: z.string().datetime(),
  }),
  lineage_hash: z.string(),
  version: z.string(),
  prompt_version: z.string().nullable(),
  model_name: z.string().nullable(),
  model_version: z.string().nullable(),
  temperature: z.number().nullable(),
  schema_version: z.string(),
  validator_version: z.string(),
  document_version: z.string(),
  source_file_hash: z.string(),
});

export type ExtractionCandidate = z.infer<typeof CandidateSchema>;

export interface ExtractionResult {
  extraction_run_id: string;
  candidates: ExtractionCandidate[];
  best_candidate_id: string | null;
  status: "success" | "partial" | "failed";
  errors?: string[];
}

/**
 * Deterministic stub for the extraction API.
 * Currently returns a fixed skeleton based on the document and disclosure.
 */
export async function extract(documentId: string, disclosureId: string): Promise<ExtractionResult> {
  // Stub implementation
  const runId = `run_${Date.now()}`;
  
  return {
    extraction_run_id: runId,
    candidates: [],
    best_candidate_id: null,
    status: "success"
  };
}
