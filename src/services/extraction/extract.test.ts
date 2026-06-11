import { CandidateSchema, extract } from "./extract";

const fixture = {
  candidate_id: "cand_123",
  extraction_run_id: "run_456",
  company_id: "comp_789",
  document_id: "doc_001",
  source_document_id: "doc_001",
  document_year: 2024,
  source_file: "report_2024.pdf",
  disclosure_id: "VSME-B1",
  normalized_value: 100,
  raw_value: "100",
  unit_raw: "kWh",
  unit_normalized: "kWh",
  period: "FY",
  year: 2024,
  page_number: 10,
  page: 10,
  table_coordinates: null,
  evidence_text: "Il consumo totale è di 100 kWh",
  extraction_method: "text_regex",
  confidence: 0.95,
  rank: 1,
  retrieval_query: "consumo energia",
  retrieval_rank: 1,
  chunk_id: "chunk_99",
  evidence: {
    evidence_id: "ev_1",
    page_number: 10,
    text_snippet: "Il consumo totale è di 100 kWh",
    evidence_hash: "hash_xyz"
  },
  retrieval: {
    retrieval_strategy: "text_regex",
    source_pages_considered: [10],
    candidate_generation_version: "1.0",
    parser_stack: ["pdfplumber"],
    top_k_position: 1
  },
  validation: {
    validation_status: "accepted",
    unit_normalization_status: "exact",
    year_detection_status: "explicit_2024",
    false_positive_risk: "none"
  },
  review: {
    review_status: "machine_only",
    override_applied: false
  },
  reviewer_decision: null,
  validation_status: "pass",
  provenance: {
    original_document_name: "report_2024.pdf",
    original_document_hash: "hash_pdf",
    document_version: "v1",
    extraction_timestamp: new Date().toISOString(),
    extractor_version: "v1",
    environment_id: "prod"
  },
  versioning: {
    schema_version: "1.0",
    extractor_version: "v1",
    gate_version: "v1",
    disclosure_dictionary_version: "v1",
    created_at: new Date().toISOString()
  },
  lineage_hash: "lineage_hash_xyz",
  version: "1.0",
  prompt_version: null,
  model_name: null,
  model_version: null,
  temperature: null,
  schema_version: "1.0",
  validator_version: "v1",
  document_version: "v1",
  source_file_hash: "hash_pdf"
};

async function testSchema() {
  console.log("Testing Zod Schema...");
  const result = CandidateSchema.safeParse(fixture);
  if (result.success) {
    console.log("✅ Schema validation PASSED");
  } else {
    console.error("❌ Schema validation FAILED", result.error.format());
    process.exit(1);
  }
}

async function testStub() {
  console.log("Testing Extraction Stub...");
  const result = await extract("doc_1", "VSME-B1");
  if (result.status === "success" && Array.isArray(result.candidates)) {
    console.log("✅ Extraction stub PASSED");
  } else {
    console.error("❌ Extraction stub FAILED");
    process.exit(1);
  }
}

// Simple test runner
(async () => {
  await testSchema();
  await testStub();
})();
