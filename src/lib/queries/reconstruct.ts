import { db } from "@/db";
import { datapointValues } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Reconstructs the full lineage of a datapoint value.
 * Answers: "Why does this value exist and where did it come from?"
 */
export async function reconstructLineage(valueId: string) {
  const result = await db.query.datapointValues.findFirst({
    where: eq(datapointValues.id, valueId),
    with: {
      sourceDocument: true,
      datapoint: true,
      validationResults: true,
      reviewDecisions: {
        with: {
          user: true
        }
      }
    }
  });

  if (!result) return null;

  // Flattening or structured return
  return {
    value: {
      id: result.id,
      normalized: result.value,
      raw: result.rawValue,
      unit: result.unitNormalized,
      period: result.period,
      year: result.year,
      state: result.state,
      confidence: result.confidence,
    },
    extraction: {
      method: result.extractionMethod,
      run_id: result.provenance?.extraction_run_id,
      parser: result.provenance?.parser_name,
      parser_version: result.provenance?.parser_version,
      model: result.provenance?.model_name,
      prompt_version: result.provenance?.prompt_version,
      validator_version: result.provenance?.validator_version,
    },
    evidence: {
      document: result.sourceDocument?.name,
      document_id: result.sourceDocumentId,
      page: result.page,
      snippet: result.evidenceText,
      bbox: result.tableCoordinates,
      hash: result.evidenceHash,
    },
    validation: result.validationResults.map(vr => ({
      rule: vr.ruleId,
      status: vr.status,
      message: vr.message,
      at: vr.createdAt
    })),
    review: result.reviewDecisions.map(rd => ({
      reviewer: rd.user?.fullName || rd.user?.email,
      decision: rd.decision,
      comment: rd.comment,
      at: rd.createdAt
    }))
  };
}
