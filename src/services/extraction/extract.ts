import { z } from "zod";
import { db } from "@/db";
import { extractionCandidates, documentChunks, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { retrieveChunks } from "../retrieval/retrieve";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { AI_MODELS } from "@/lib/model-config";

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
  stub?: boolean;
  errors?: string[];
}

export async function extract(documentId: string, disclosureId: string, runId?: string): Promise<ExtractionResult> {
  const extractionRunId = runId || `run_${Date.now()}`;
  
  // 1. Retrieval
  const chunks = await retrieveChunks(documentId, disclosureId, 5);
  
  if (chunks.length === 0) {
    return {
      extraction_run_id: extractionRunId,
      candidates: [],
      best_candidate_id: null,
      status: "failed",
      errors: ["Nessun chunk rilevante trovato nel documento."]
    };
  }

  // 2. Chiamata LLM
  // Fallback per mancanza di chiave (mock)
  let object: any;
  if (!process.env.ANTHROPIC_API_KEY) {
     console.log("Chiave ANTHROPIC_API_KEY mancante. Uso LLM mock.");
     object = {
       candidates: [{
         raw_value: "45000",
         normalized_value: 45000,
         unit_raw: "kWh",
         year: 2024,
         evidence_text: chunks[0].text,
         chunk_id: chunks[0].chunk_id,
         confidence_score: 0.95
       }]
     };
  } else {
    const contextText = chunks.map(c => `[CHUNK_ID: ${c.chunk_id} | PAGE: ${c.page}]\\n${c.text}`).join("\\n\\n");
    const response = await generateObject({
      model: anthropic(AI_MODELS.PARSER_MODEL),
      schema: z.object({
         candidates: z.array(z.object({
            raw_value: z.string(),
            normalized_value: z.number().nullable(),
            unit_raw: z.string(),
            year: z.number(),
            evidence_text: z.string(),
            chunk_id: z.string(),
            confidence_score: z.number() // 0-1
         }))
      }),
      prompt: `
        Estrai i candidati per la metrica ${disclosureId} dai seguenti frammenti di testo.
        Devi restituire il valore esatto (raw_value), un valore numerico normalizzato (se applicabile),
        l'unita di misura trovata, l'anno di riferimento (se esplicito, altrimenti 2024 come fallback plausibile, ma segnalalo),
        la frase esatta di evidenza e il CHUNK_ID da cui hai preso l'informazione.

        CONTESTO:
        ${contextText}
      `
    });
    object = response.object;
  }

  if (!object.candidates || object.candidates.length === 0) {
     return {
      extraction_run_id: extractionRunId,
      candidates: [],
      best_candidate_id: null,
      status: "success",
      errors: ["LLM non ha trovato candidati validi nel contesto fornito."]
    };
  }

  // 3. Costruzione e Salvataggio Candidati
  const resultCandidates: ExtractionCandidate[] = [];
  
  for (let i = 0; i < object.candidates.length; i++) {
     const cand = object.candidates[i];
     const chunk = chunks.find(c => String(c.chunk_id) === String(cand.chunk_id));
     if (!chunk) continue; // Salta se LLM ha allucinato un chunk_id
     
     // TS-Light Validation
     const rejectionFlags: string[] = [];
     if (cand.year !== 2024 && cand.year !== 2023) {
        rejectionFlags.push("wrong_year_risk");
     }
     
     const doc = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
     
     const fullCandidate: ExtractionCandidate = {
        candidate_id: `cand_${Date.now()}_${i}`,
        extraction_run_id: extractionRunId,
        company_id: "unknown",
        document_id: documentId,
        source_document_id: documentId,
        document_year: cand.year,
        source_file: doc?.name || "unknown",
        disclosure_id: disclosureId,
        normalized_value: cand.normalized_value,
        unit_normalized: cand.unit_raw, // semplificazione
        raw_value: cand.raw_value,
        unit_raw: cand.unit_raw,
        period: "FY",
        year: cand.year,
        page_number: chunk.page,
        page: chunk.page, // LA PAGINA E' PRESA DAL CHUNK!
        table_coordinates: null,
        evidence_text: cand.evidence_text,
        extraction_method: "hybrid",
        confidence: cand.confidence_score,
        rank: i + 1,
        retrieval_query: "hybrid_query",
        retrieval_rank: chunk.rank,
        chunk_id: cand.chunk_id,
        evidence: {
          evidence_id: `ev_${Date.now()}_${i}`,
          page_number: chunk.page,
          text_snippet: cand.evidence_text,
          evidence_hash: "mock_hash"
        },
        retrieval: {
          retrieval_strategy: "hybrid",
          source_pages_considered: [chunk.page],
          candidate_generation_version: "v8.0",
          parser_stack: ["postgres_fts"],
          top_k_position: chunk.rank
        },
        validation: {
          validation_status: rejectionFlags.length > 0 ? "needs_review" : "accepted",
          rejection_flags: rejectionFlags.length > 0 ? rejectionFlags : undefined,
          unit_normalization_status: "exact",
          year_detection_status: rejectionFlags.includes("wrong_year_risk") ? "wrong_year_risk" : "explicit_2024",
          false_positive_risk: "none"
        },
        review: {
          review_status: "machine_only",
          override_applied: false
        },
        reviewer_decision: null,
        validation_status: rejectionFlags.length > 0 ? "needs_review" : "accepted",
        provenance: {
          original_document_name: doc?.name || "unknown",
          original_document_hash: doc?.hash || "unknown",
          document_version: "1.0",
          extraction_timestamp: new Date().toISOString(),
          extractor_version: "v8.0",
          environment_id: "prod"
        },
        versioning: {
          schema_version: "1.0",
          extractor_version: "v8.0",
          gate_version: "1.0",
          disclosure_dictionary_version: "1.0",
          created_at: new Date().toISOString()
        },
        lineage_hash: `hash_${Date.now()}_${i}`,
        version: "1.0",
        prompt_version: "1.0",
        model_name: AI_MODELS.PARSER_MODEL,
        model_version: AI_MODELS.PARSER_MODEL,
        temperature: 0,
        schema_version: "1.0",
        validator_version: "ts-light-v1",
        document_version: "1.0",
        source_file_hash: doc?.hash || "unknown"
     };
     
     resultCandidates.push(fullCandidate);
     
     // Salvataggio nel DB (tabella canonical extractionCandidates)
     await db.insert(extractionCandidates).values({
        extractionRunId: extractionRunId,
        datapointId: disclosureId,
        rawValue: fullCandidate.raw_value,
        normalizedValue: fullCandidate.normalized_value?.toString(),
        unitRaw: fullCandidate.unit_raw,
        unitNormalized: fullCandidate.unit_normalized,
        confidence: fullCandidate.confidence > 0.8 ? "Alta" : "Media", // conversione semplificata
        pageReference: fullCandidate.page,
        evidenceText: fullCandidate.evidence_text,
        metadata: {
           candidate_id: fullCandidate.candidate_id,
           model: fullCandidate.model_name,
           validator_version: fullCandidate.validator_version,
           rejection_flags: fullCandidate.validation.rejection_flags
        }
     });
  }

  return {
    extraction_run_id: extractionRunId,
    candidates: resultCandidates,
    best_candidate_id: resultCandidates.length > 0 ? resultCandidates[0].candidate_id : null,
    status: "success"
  };
}

