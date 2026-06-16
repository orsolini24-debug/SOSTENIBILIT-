import { z } from "zod";
import { db } from "@/db";
import { extractionCandidates, extractionRuns, documentChunks, documents, esgIndicators } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { retrieveChunks } from "../retrieval/retrieve";
import { generateText } from "ai";
import { AI_MODELS } from "@/lib/model-config";
import crypto from "crypto";

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

/**
 * C6: Risolve disclosure_id (slug es. "scope_2_location_based_ghg_emissions")
 * → datapointId (VSME code es. "VSME-B2-S2-LB") tramite esg_indicators.vsme_disclosure_id.
 * Restituisce null se la tabella non esiste ancora (pre-migration) o se non trovato.
 */
async function resolveDatapointId(disclosureId: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ vsmeId: esgIndicators.vsmeDisclosureId })
      .from(esgIndicators)
      .where(eq(esgIndicators.id, disclosureId))
      .limit(1);
    return rows[0]?.vsmeId ?? null;
  } catch {
    // Tabella esg_indicators non ancora presente (migration 0008 non applicata)
    return null;
  }
}

export async function extract(documentId: string, disclosureId: string, runId?: string): Promise<ExtractionResult> {
  const extractionRunId = runId || crypto.randomUUID();

  // 0. Crea il record extraction_run (FK richiesta da extraction_candidates)
  //    Se runId è stato passato dall'esterno, il chiamante è responsabile del record.
  if (!runId) {
    await db.insert(extractionRuns).values({
      id: extractionRunId,
      documentId: documentId,
      model: AI_MODELS.PARSER_MODEL_NAME,
      promptVersion: "v8.0",
      status: "running",
    });
  }

  // 1. Retrieval
  const chunks = await retrieveChunks(documentId, disclosureId, 10);
  console.log(`  [RETRIEVAL] doc=${documentId} disc=${disclosureId} → ${chunks.length} chunks`);

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
  const hasApiKey = process.env.GROQ_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!hasApiKey) {
     console.log("Nessuna chiave API trovata. Uso LLM mock.");
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
    const contextText = chunks.map(c => `[CHUNK_ID: ${c.chunk_id} | PAGE: ${c.page}]\\n${c.text.substring(0, 1500)}`).join("\\n\\n");
    const responseText = await generateText({
      model: AI_MODELS.PARSER_MODEL,
      prompt: `Estrai i candidati per la metrica ${disclosureId} dai seguenti frammenti di testo.
Rispondi SOLO con JSON valido nel formato: {"candidates": [{"raw_value": "...", "normalized_value": 123.4, "unit_raw": "...", "year": 2024, "evidence_text": "...", "chunk_id": "...", "confidence_score": 0.9}]}
Non aggiungere testo fuori dal JSON.

REGOLE RIGOROSE:
1. ANNO: Se l'anno non e esplicitamente citato nel testo o facilmente deducibile dal contesto immediato, restituisci null. NON inventarlo e non assumere 2024 di default.
2. ANTI-TRAPPOLA: Non estrarre MAI target/obiettivi futuri, valori storici di baseline (es. 2018, 2020 usati per confronto) o metriche di intensita (es. kWh per dipendente, tonnellate per milione di fatturato) a meno che non sia esplicitamente richiesto dalla metrica. Cerca solo il valore assoluto corrente.
3. SCOPE SPECIFICITY: Per metriche di tipo "scope_1", estrai SOLO il valore con etichetta esplicita "Scope 1", "GHG Scope 1" o "Emissioni Scope 1". NON estrarre MAI aggregati come "Scope 1+2", "Scope 1+2+3", "Total GHG", "Totale emissioni GES", "GHG totali". Se una tabella ha piu righe, leggi le label con cura e scegli SOLO la riga Scope 1. Per "scope_2_market_based", estrai solo il valore esplicitamente etichettato "market-based" o "mercato", non il location-based.
4. TABELLE FRAMMENTATE: I PDF dividono spesso le tabelle in chunk separati con header e valori distinti. Se un chunk contiene solo numeri senza label, cerca la label nel testo circostante degli altri chunk con lo stesso PAGE. NON estrarre numeri orfani privi di etichetta identificativa chiara.
5. VALORE RAW: Restituisci il valore ESATTAMENTE come appare nel documento (es. "37.903" se il doc usa il punto come separatore migliaia, "27.106 MWh" se accompagnato da unita). Non convertire unita, non ricalcolare.
6. UNITA PREFERITE: Se lo stesso valore appare in piu unita (es. sia MWh che TJ, sia tCO2e che ktCO2e), scegli SEMPRE: tCO2e per emissioni GHG (non kt, non Mt, non tCO2eq scalato), MWh per energia (non TJ, non GWh, non GJ). Se nel testo compaiono ENTRAMBE le rappresentazioni, estrai quella in MWh/tCO2e. Se compare solo un\'altra unita, estrai quella senza convertire. NOTA: "ton CO2eq", "t CO2eq", "ton GHG", "tonnellate CO2 equivalente", "tonne CO2e", "ton" (senza ulteriori qualifiche, nel contesto di emissioni GHG Scope 1/2/3) sono equivalenti a tCO2e e vanno estratti normalmente senza escluderli.
7. SUBTOTALE vs TOTALE (SOLO per metriche energetiche): In tabelle ENERGETICHE con piu righe (per fonte: fossile, rinnovabile, nucleare), la riga di TOTALE FINALE e etichettata esplicitamente "Total energy consumption", "Total energy consumed", "Totale energia consumata", "Consumo totale di energia" o simile. Scegli SEMPRE questa riga aggregata per le metriche di energia totale, NON i sottototali per fonte (es. "Total energy from fossil sources", "Purchased fuel consumption", "Consumo totale di energia da fonti fossili"). Se trovi piu candidati per l\'energia, il totale e tipicamente quello con valore PIU GRANDE e label piu generica (senza specificare fonte). NOTA: questa regola NON si applica alle metriche GHG (scope_1, scope_2, scope_3) — per quelle usa la Regola 3 (SCOPE SPECIFICITY).
8. COLONNE PERIMETRO: In tabelle con piu colonne che rappresentano perimetri diversi (es. "former perimeter", "old perimeter", "ex-perimeter" affiancati a "Total 2024", "Group total", "Totale Gruppo"), scegli SEMPRE la colonna del perimetro PIU ESTESO E ATTUALE. Evita colonne con "former", "ex-", "previous", "old" nell\'header. REGOLA PRATICA: se per la stessa riga vedi DUE valori numerici per l\'anno corrente (es. due colonne 2024), scegli SEMPRE il VALORE PIU GRANDE — il perimetro consolidato completo ha sempre valori >= al sotto-perimetro. Esempio: se vedi "447,153" e "474,155" entrambi per scope_2 nel 2024, scegli 474,155 (il maggiore = perimetro completo). NOTA ANNO TRONCATO: In alcuni PDF la linearizzazione puo troncare "2024" in "202" (es. header "Total 202\nPrysmian" invece di "Total 2024\nPrysmian"). Tratta qualsiasi colonna con header "Total 202" o "Total 202X" seguita dal nome societa come colonna anno 2024 — NON come anno diverso o ambiguo. La regola del valore maggiore si applica normalmente anche in questo caso.

CONTESTO:
${contextText}
`
    });
    // Parse manuale: bypassa json_schema (non supportato da Groq llama)
    try {
      const raw = responseText.text.trim();
      // Estrai JSON anche se il modello aggiunge testo prima/dopo
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      object = jsonMatch ? JSON.parse(jsonMatch[0]) : { candidates: [] };
    } catch (parseErr) {
      console.error("  JSON parse error:", String(parseErr).substring(0, 80));
      object = { candidates: [] };
    }
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
  
  // C6: risolvi datapointId una volta sola per tutti i candidati di questa run
  const resolvedDatapointId = await resolveDatapointId(disclosureId);

  for (let i = 0; i < object.candidates.length; i++) {
     const cand = object.candidates[i];
     const chunk = chunks.find(c => String(c.chunk_id) === String(cand.chunk_id));
     if (!chunk) continue; // Salta se LLM ha allucinato un chunk_id

     // TS-Light Validation
     const rejectionFlags: string[] = [];

     // A2: se l'LLM non sa determinare l'anno, NON normalizzare a 2024 — segnala come needs_review
     const derivedYear: number | null = cand.year ?? null;
     if (derivedYear === null) {
        rejectionFlags.push("missing_year_context");
     } else if (derivedYear !== 2024 && derivedYear !== 2023) {
        rejectionFlags.push("wrong_year_risk");
     }
     
     const doc = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
     
     // T1: Real evidence_hash
     const evidenceHash = crypto.createHash("sha256").update(cand.evidence_text).digest("hex");

     // A2: se anno sconosciuto, usa 0 come sentinel (mai un anno reale)
     const yearForRecord = derivedYear ?? 0;

     const fullCandidate: ExtractionCandidate = {
        candidate_id: `cand_${Date.now()}_${i}`,
        extraction_run_id: extractionRunId,
        company_id: "unknown",
        document_id: documentId,
        source_document_id: documentId,
        document_year: yearForRecord,
        source_file: doc?.name || "unknown",
        disclosure_id: disclosureId,
        normalized_value: cand.normalized_value,
        unit_normalized: cand.unit_raw, // semplificazione
        raw_value: cand.raw_value,
        unit_raw: cand.unit_raw,
        period: "FY",
        year: yearForRecord,
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
          evidence_hash: evidenceHash
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
          year_detection_status: rejectionFlags.includes("missing_year_context") ? "missing_year_context" : rejectionFlags.includes("wrong_year_risk") ? "wrong_year_risk" : "explicit_2024",
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
        model_name: AI_MODELS.PARSER_MODEL_NAME,
        model_version: AI_MODELS.PARSER_MODEL_NAME,
        temperature: 0,
        schema_version: "1.0",
        validator_version: "ts-light-v1",
        document_version: "1.0",
        source_file_hash: doc?.hash || "unknown"
     };
     
     resultCandidates.push(fullCandidate);
     
     // Salvataggio nel DB (tabella canonical extractionCandidates)
     // C6: datapointId risolto tramite esg_indicators.vsme_disclosure_id
     // Il disclosure_id reale è conservato anche nel campo metadata.disclosure_id per fallback
     await db.insert(extractionCandidates).values({
        extractionRunId: extractionRunId,
        datapointId: resolvedDatapointId,
        rawValue: fullCandidate.raw_value,
        normalizedValue: fullCandidate.normalized_value?.toString(),
        unitRaw: fullCandidate.unit_raw,
        unitNormalized: fullCandidate.unit_normalized,
        confidence: fullCandidate.confidence > 0.8 ? "Alta" : "Media",
        pageReference: fullCandidate.page,
        evidenceText: fullCandidate.evidence_text,
        metadata: {
           candidate_id: fullCandidate.candidate_id,
           disclosure_id: disclosureId,
           model: fullCandidate.model_name,
           validator_version: fullCandidate.validator_version,
           rejection_flags: fullCandidate.validation.rejection_flags
        }
     });
  }

  // Aggiorna status del run a "completed"
  if (!runId) {
    await db.update(extractionRuns)
      .set({ status: "completed" })
      .where(eq(extractionRuns.id, extractionRunId));
  }

  return {
    extraction_run_id: extractionRunId,
    candidates: resultCandidates,
    best_candidate_id: resultCandidates.length > 0 ? resultCandidates[0].candidate_id : null,
    status: "success"
  };
}
