// @ts-nocheck
/**
 * certificationGuardrail.test.ts
 * Gate G3.9 — Certifications must NOT modify quantitative ESG predictions.
 *
 * Run: npx jest src/tests/certificationGuardrail.test.ts
 */

import {
  applyCertificationBoost,
  assertCertGuardrail,
  CertificationGuardrailError,
  PredictionForGuardrail,
  IndicatorForGuardrail,
  CertRecordForGuardrail,
} from "../services/predictive/certificationGuardrail";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const QUANT_PREDICTION: PredictionForGuardrail = {
  predicted_value: 1200.5,
  p25_value: 900.0,
  p75_value: 1600.0,
  p10_value: 700.0,
  p90_value: 2000.0,
  confidence: "Bassa",
};

const BOOL_PREDICTION: PredictionForGuardrail = {
  predicted_value: null,
  p25_value: null,
  p75_value: null,
  p10_value: null,
  p90_value: null,
  confidence: "Bassa",
};

const INDICATOR_QUANT: IndicatorForGuardrail = {
  id: "scope_1_ghg_emissions",
  metric_type: "quantitative_absolute",
};

const INDICATOR_BOOL: IndicatorForGuardrail = {
  id: "ohs_management_system_certified",
  metric_type: "boolean_control",
};

const ISO_45001_CERT: CertRecordForGuardrail = {
  id: "iso-45001-2018",
  name: "ISO 45001:2018 — Occupational Health & Safety",
  confidence_boost_allowed: true,
  confidence_boost_scope: ["ohs_management_system_certified", "injury_rate_ltifr"],
};

const ISO_14001_CERT: CertRecordForGuardrail = {
  id: "iso-14001-2015",
  name: "ISO 14001:2015 — Environmental Management",
  confidence_boost_allowed: true,
  confidence_boost_scope: ["scope_1_ghg_emissions", "total_energy_consumption"],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Gate G3.9 — Certification Guardrail", () => {

  // ── 1. Happy path: boolean_control gets confidence boost ───────────────────
  it("boosts confidence for boolean_control indicator", () => {
    const boosted = applyCertificationBoost(BOOL_PREDICTION, INDICATOR_BOOL, ISO_45001_CERT);
    expect(boosted).toBe("Media"); // Bassa → Media
  });

  // ── 2. Core rule: quantitative_absolute NEVER gets confidence boost ────────
  it("does NOT boost confidence for quantitative_absolute indicator", () => {
    const conf = applyCertificationBoost(QUANT_PREDICTION, INDICATOR_QUANT, ISO_14001_CERT);
    expect(conf).toBe("Bassa"); // unchanged
  });

  // ── 3. assertCertGuardrail PASSES when values unchanged ───────────────────
  it("assertCertGuardrail passes when quantitative values are unchanged", () => {
    const after = { ...QUANT_PREDICTION }; // identical copy — no modifications
    expect(() =>
      assertCertGuardrail(QUANT_PREDICTION, after, INDICATOR_QUANT, ISO_14001_CERT)
    ).not.toThrow();
  });

  // ── 4. assertCertGuardrail FAILS if predicted_value was changed ───────────
  it("throws if certification modified predicted_value on quantitative_absolute", () => {
    const tampered = { ...QUANT_PREDICTION, predicted_value: 900.0 }; // cert illegally lowered it
    expect(() =>
      assertCertGuardrail(QUANT_PREDICTION, tampered, INDICATOR_QUANT, ISO_14001_CERT)
    ).toThrow(CertificationGuardrailError);
  });

  // ── 5. assertCertGuardrail FAILS if p25 was changed ──────────────────────
  it("throws if certification modified p25_value on quantitative_absolute", () => {
    const tampered = { ...QUANT_PREDICTION, p25_value: 500.0 };
    expect(() =>
      assertCertGuardrail(QUANT_PREDICTION, tampered, INDICATOR_QUANT, ISO_14001_CERT)
    ).toThrow(CertificationGuardrailError);
  });

  // ── 6. assertCertGuardrail FAILS if confidence was boosted on quant_abs ──
  it("throws if certification boosted confidence on quantitative_absolute", () => {
    const boostedConf: PredictionForGuardrail = { ...QUANT_PREDICTION, confidence: "Media" };
    expect(() =>
      assertCertGuardrail(QUANT_PREDICTION, boostedConf, INDICATOR_QUANT, ISO_14001_CERT)
    ).toThrow(CertificationGuardrailError);
  });

  // ── 7. Error message is informative ───────────────────────────────────────
  it("error message identifies cert, indicator, metric_type and attempted change", () => {
    const tampered = { ...QUANT_PREDICTION, p90_value: 5000.0 };
    let err: CertificationGuardrailError | null = null;
    try {
      assertCertGuardrail(QUANT_PREDICTION, tampered, INDICATOR_QUANT, ISO_14001_CERT);
    } catch (e) {
      err = e as CertificationGuardrailError;
    }
    expect(err).not.toBeNull();
    expect(err!.certId).toBe("iso-14001-2015");
    expect(err!.indicatorId).toBe("scope_1_ghg_emissions");
    expect(err!.metricType).toBe("quantitative_absolute");
    expect(err!.message).toContain("G3.9 VIOLATION");
    expect(err!.message).toContain("p90_value");
  });

  // ── 8. applyCertificationBoost throws if quantitative changes are proposed ─
  it("throws immediately if quantitative changes are proposed", () => {
    expect(() =>
      applyCertificationBoost(
        QUANT_PREDICTION,
        INDICATOR_QUANT,
        ISO_14001_CERT,
        { predicted_value: 999 } // caller tried to modify
      )
    ).toThrow(CertificationGuardrailError);
  });

  // ── 9. Cert with confidence_boost_allowed=false is a no-op ────────────────
  it("cert with confidence_boost_allowed=false does not boost anything", () => {
    const noBoostCert: CertRecordForGuardrail = {
      ...ISO_45001_CERT,
      confidence_boost_allowed: false,
    };
    const conf = applyCertificationBoost(BOOL_PREDICTION, INDICATOR_BOOL, noBoostCert);
    expect(conf).toBe("Bassa"); // unchanged
  });

  // ── 10. Double boost: Media → Alta for eligible type ──────────────────────
  it("boosts Media → Alta for boolean_control with Media baseline", () => {
    const mediaPred: PredictionForGuardrail = { ...BOOL_PREDICTION, confidence: "Media" };
    const conf = applyCertificationBoost(mediaPred, INDICATOR_BOOL, ISO_45001_CERT);
    expect(conf).toBe("Alta");
  });
});
