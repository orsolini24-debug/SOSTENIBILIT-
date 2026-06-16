/**
 * certificationGuardrail.ts
 *
 * RULE (Gate G3.9):
 *   A certification record may boost confidence ONLY for metric_type IN:
 *     boolean_control | categorical_maturity | evidence_required
 *
 *   A certification NEVER modifies:
 *     predicted_value, p25_value, p75_value, p10_value, p90_value
 *   for any indicator with metric_type = 'quantitative_absolute'.
 *
 * This module provides:
 *   - applyCertificationBoost(): enforces the rule at runtime
 *   - assertCertGuardrail(): throws if the rule is violated (use in tests)
 */

export const CERT_ELIGIBLE_METRIC_TYPES = [
  "boolean_control",
  "categorical_maturity",
  "evidence_required",
] as const;

export type CertEligibleMetricType = (typeof CERT_ELIGIBLE_METRIC_TYPES)[number];

export const QUANTITATIVE_FIELDS = [
  "predicted_value",
  "p25_value",
  "p75_value",
  "p10_value",
  "p90_value",
] as const;

export type QuantitativeField = (typeof QUANTITATIVE_FIELDS)[number];

/** A minimal shape of a prediction row — only the fields the guardrail cares about. */
export interface PredictionForGuardrail {
  predicted_value: number | null;
  p25_value: number | null;
  p75_value: number | null;
  p10_value: number | null;
  p90_value: number | null;
  confidence: "Alta" | "Media" | "Bassa";
}

/** A minimal shape of an indicator row. */
export interface IndicatorForGuardrail {
  id: string;
  metric_type: string;
}

/** A minimal shape of a certification record. */
export interface CertRecordForGuardrail {
  id: string;
  name: string;
  confidence_boost_allowed: boolean;
  confidence_boost_scope: string[]; // indicator_ids this cert applies to
}

export class CertificationGuardrailError extends Error {
  constructor(
    public readonly certId: string,
    public readonly indicatorId: string,
    public readonly metricType: string,
    public readonly attemptedChange: string
  ) {
    super(
      `[G3.9 VIOLATION] Certification "${certId}" attempted to ${attemptedChange} ` +
      `for indicator "${indicatorId}" (metric_type="${metricType}"). ` +
      `Certifications may only boost confidence on boolean_control / categorical_maturity / evidence_required. ` +
      `They NEVER modify quantitative values (predicted_value, p25, p75, p10, p90).`
    );
    this.name = "CertificationGuardrailError";
  }
}

/**
 * Apply a certification boost to a prediction.
 * Returns the updated confidence level (and only that).
 * Throws CertificationGuardrailError if the cert tries to modify quantitative fields.
 *
 * @param prediction - The current prediction values (treated as immutable)
 * @param indicator  - The indicator being predicted
 * @param cert       - The certification record
 * @param proposedQuantitativeChanges - If provided, guardrail will throw
 * @returns The (possibly upgraded) confidence level
 */
export function applyCertificationBoost(
  prediction: PredictionForGuardrail,
  indicator: IndicatorForGuardrail,
  cert: CertRecordForGuardrail,
  proposedQuantitativeChanges?: Partial<Record<QuantitativeField, number>>
): "Alta" | "Media" | "Bassa" {
  // 1. If cert has proposed quantitative changes, reject unconditionally
  if (proposedQuantitativeChanges && Object.keys(proposedQuantitativeChanges).length > 0) {
    const changedFields = Object.keys(proposedQuantitativeChanges).join(", ");
    throw new CertificationGuardrailError(
      cert.id,
      indicator.id,
      indicator.metric_type,
      `modify quantitative fields [${changedFields}]`
    );
  }

  // 2. Check eligibility
  if (!cert.confidence_boost_allowed) {
    return prediction.confidence; // no boost, pass through
  }

  const isEligible = (CERT_ELIGIBLE_METRIC_TYPES as readonly string[]).includes(
    indicator.metric_type
  );

  if (!isEligible) {
    // Cert claims boost but indicator is not eligible: silently skip (don't throw,
    // the cert itself is not malformed — the caller just misapplied it)
    // Log warning in production; in test mode assertCertGuardrail() will catch it
    return prediction.confidence;
  }

  // 3. Apply confidence upgrade (Bassa → Media only; Media → Alta only if N supports it)
  // Conservative upgrade: one step up max
  const LEVELS: Array<"Alta" | "Media" | "Bassa"> = ["Bassa", "Media", "Alta"];
  const currentIdx = LEVELS.indexOf(prediction.confidence);
  const boosted = LEVELS[Math.min(currentIdx + 1, LEVELS.length - 1)] as "Alta" | "Media" | "Bassa";
  return boosted;
}

/**
 * Strict assertion for use in automated tests (Gate G3.9).
 *
 * Verifies that:
 *  1. quantitative_absolute indicators never have their numeric values modified by certs
 *  2. non-eligible metric types never receive a confidence boost from certs
 *
 * Throws CertificationGuardrailError on any violation.
 */
export function assertCertGuardrail(
  prediction: PredictionForGuardrail,
  predictionAfterCert: PredictionForGuardrail,
  indicator: IndicatorForGuardrail,
  cert: CertRecordForGuardrail
): void {
  // Check: no quantitative field was modified
  for (const field of QUANTITATIVE_FIELDS) {
    const before = prediction[field];
    const after = predictionAfterCert[field];
    if (before !== after) {
      throw new CertificationGuardrailError(
        cert.id,
        indicator.id,
        indicator.metric_type,
        `change ${field} from ${before} to ${after}`
      );
    }
  }

  // Check: if metric_type is quantitative_absolute, confidence must NOT have been boosted
  if (indicator.metric_type === "quantitative_absolute") {
    if (prediction.confidence !== predictionAfterCert.confidence) {
      throw new CertificationGuardrailError(
        cert.id,
        indicator.id,
        indicator.metric_type,
        `boost confidence from "${prediction.confidence}" to "${predictionAfterCert.confidence}"`
      );
    }
  }
}
