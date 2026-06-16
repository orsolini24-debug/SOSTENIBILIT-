/**
 * predict.ts — Predictive Engine v1
 *
 * Entry point: predict(profile) → PredictionResult[]
 *
 * Architecture:
 *   1. Resolve cluster for the company (NACE + employees → cluster_id)
 *   2. For each requested indicator:
 *        a. Look up sector_distributions at cluster level (Tier 1/2)
 *        b. If no distribution or N<5 → fallback to macro_sector (Tier 2 shrinkage)
 *        c. If still no distribution → fallback to national (Tier 3, generateBaseline)
 *   3. De-normalize intensity back to absolute value using the profile driver
 *   4. Return predictions[] with confidence, rationale, and fallback level
 *
 * Replaces generateBaseline() for companies with a valid cluster match.
 * generateBaseline() is still called as Tier 3 (national fallback).
 *
 * Flywheel: user_confirmations feed recompute (future sprint).
 */

import { db } from "@/db";
import {
  clusterDefinitions,
  sectorDistributions,
  predictionRuns,
  predictions as predictionsTable,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { generateBaseline } from "@/services/baseline";
import { MACRO_SECTOR_CLUSTER_MAP, INDICATOR_DEFAULT_DRIVER } from "@/db/seeds/seed-clusters";

// ---- Types ----

export interface CompanyProfile {
  companyId?: string;
  projectId?: string;
  naceCode: string;              // e.g. "28.25" or "2825"
  employees: number;             // FTE count (required for intensity de-normalization)
  revenueEur?: number;           // optional — enables revenue-based driver indicators
  facilitySqm?: number;          // optional — enables area-based driver indicators
  indicators?: string[];         // if omitted, predict all known indicators
  distributionVersion?: string;  // default "1.0"
}

export interface PredictionResult {
  indicatorId: string;
  predictedValue: number;        // central estimate (de-normalized from intensity median)
  p25Value: number;
  p75Value: number;
  unit: string;
  confidence: "Alta" | "Media" | "Bassa";
  fallbackLevel: "cluster" | "macro_sector" | "national";
  nSampleUsed: number;
  shrinkageWeightUsed: number;
  sharpness: number | null;
  distributionId: string | null;
  rationale: string;
}

export interface PredictOutput {
  runId: string | null;
  clusterId: string | null;
  clusterName: string | null;
  macroSector: string | null;
  predictions: PredictionResult[];
  persistedCount: number;
}

// ---- Constants ----

const DEFAULT_VERSION = "1.0";
const FALLBACK_SHARPNESS_CAP = 5; // flag if p75/p25 > 5

// Minimum N to use cluster-level distribution directly (vs. shrunk)
const MIN_N_DIRECT = 5;

// All known indicators (predict all if not specified in profile)
const ALL_INDICATORS = Object.keys(INDICATOR_DEFAULT_DRIVER);

// ---- NACE mapping ----

const NACE_TO_CLUSTER_BASE: Record<string, string> = {
  "24": "meccatronica", "25": "meccatronica", "26": "meccatronica",
  "27": "meccatronica", "28": "meccatronica", "29": "meccatronica", "30": "meccatronica",
  "01": "agroalimentare", "02": "agroalimentare", "03": "agroalimentare",
  "10": "agroalimentare", "11": "agroalimentare", "12": "agroalimentare",
  "13": "moda_tessile",   "14": "moda_tessile",   "15": "moda_tessile",
  "20": "chimico_plastico","21": "chimico_plastico","22": "chimico_plastico",
  "41": "edilizia_impiantistica","42": "edilizia_impiantistica","43": "edilizia_impiantistica",
  "35": "utilities","36": "utilities","37": "utilities","38": "utilities","39": "utilities",
  "49": "utilities","50": "utilities","51": "utilities","52": "utilities","53": "utilities",
  "45": "gdo_retail","46": "gdo_retail","47": "gdo_retail",
  "62": "gdo_retail","63": "gdo_retail",
};

function nacePrefix(code: string): string {
  return code.replace(/\./g, "").substring(0, 2);
}

function sizeClass(employees: number): "micro" | "small" | "medium" {
  if (employees < 10) return "micro";
  if (employees < 50) return "small";
  return "medium"; // large companies capped at medium cluster
}

// ---- Driver value resolution ----

function driverValue(
  driver: string,
  profile: CompanyProfile
): { value: number; available: boolean } {
  switch (driver) {
    case "employees":
      return { value: profile.employees, available: true };
    case "revenue_eur":
      if (!profile.revenueEur || profile.revenueEur <= 0)
        return { value: profile.employees, available: false }; // fallback to employees
      return { value: profile.revenueEur / 1_000_000, available: true }; // → MEUR
    case "facility_area_sqm":
      if (!profile.facilitySqm || profile.facilitySqm <= 0)
        return { value: profile.employees, available: false }; // fallback to employees
      return { value: profile.facilitySqm, available: true };
    default:
      return { value: profile.employees, available: false };
  }
}

// ---- Main predict() ----

export async function predict(profile: CompanyProfile): Promise<PredictOutput> {
  const version = profile.distributionVersion ?? DEFAULT_VERSION;
  const requestedIndicators = profile.indicators ?? ALL_INDICATORS;

  // 1. Resolve cluster
  const prefix = nacePrefix(profile.naceCode);
  const clusterBaseName = NACE_TO_CLUSTER_BASE[prefix];
  const sz = sizeClass(profile.employees);
  const clusterFullName = clusterBaseName ? `${clusterBaseName}_${sz}` : null;

  let clusterId: string | null = null;
  let clusterDbRow: typeof clusterDefinitions.$inferSelect | null = null;
  let macroSector: string | null = null;

  if (clusterFullName) {
    const rows = await db
      .select()
      .from(clusterDefinitions)
      .where(eq(clusterDefinitions.name, clusterFullName))
      .limit(1);
    if (rows.length > 0) {
      clusterDbRow = rows[0];
      clusterId = rows[0].id;
      // resolve macro sector
      for (const [ms, names] of Object.entries(MACRO_SECTOR_CLUSTER_MAP)) {
        if (clusterBaseName && names.includes(clusterBaseName)) { macroSector = ms; break; }
      }
    }
  }

  // 2. Load all cluster-level distributions for requested indicators
  const clusterDists = clusterId
    ? await db
        .select()
        .from(sectorDistributions)
        .where(
          and(
            eq(sectorDistributions.clusterId, clusterId),
            eq(sectorDistributions.version, version),
            inArray(sectorDistributions.indicatorId, requestedIndicators)
          )
        )
    : [];

  // 3. Load macro-sector level distributions (all clusters in macro)
  const macroSectorKey = macroSector ?? "";
  const macroClusterNames = macroSectorKey ? MACRO_SECTOR_CLUSTER_MAP[macroSectorKey] ?? [] : [];
  let macroDistMap: Record<string, typeof sectorDistributions.$inferSelect> = {};

  if (macroClusterNames.length > 0) {
    // Get cluster IDs for the macro sector
    const macroClusters = await db
      .select()
      .from(clusterDefinitions)
      .where(inArray(clusterDefinitions.name, macroClusterNames.map(n => `${n}_${sz}`)));
    const macroClusterIds = macroClusters.map(c => c.id);

    if (macroClusterIds.length > 0) {
      const macroDists = await db
        .select()
        .from(sectorDistributions)
        .where(
          and(
            inArray(sectorDistributions.clusterId, macroClusterIds),
            eq(sectorDistributions.version, version),
            inArray(sectorDistributions.indicatorId, requestedIndicators)
          )
        );

      // Average across macro-sector clusters per indicator
      const tempAgg: Record<string, { p25s: number[]; meds: number[]; p75s: number[] }> = {};
      for (const d of macroDists) {
        if (!d.p25 || !d.median || !d.p75 || !d.indicatorId) continue;
        const indKey = d.indicatorId;
        if (!tempAgg[indKey]) tempAgg[indKey] = { p25s: [], meds: [], p75s: [] };
        tempAgg[indKey].p25s.push(parseFloat(d.p25));
        tempAgg[indKey].meds.push(parseFloat(d.median));
        tempAgg[indKey].p75s.push(parseFloat(d.p75));
      }
      for (const [indId, agg] of Object.entries(tempAgg)) {
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        // Synthetic row for macro-sector
        macroDistMap[indId] = {
          ...macroDists[0], // borrow metadata
          indicatorId: indId,
          p25: avg(agg.p25s).toFixed(6),
          median: avg(agg.meds).toFixed(6),
          p75: avg(agg.p75s).toFixed(6),
          nSamples: agg.p25s.length,
          shrinkageWeight: null,
          fallbackLevel: "macro_sector",
          id: "__macro__",
        } as any;
      }
    }
  }

  // 4. Build index for cluster distributions
  const clusterDistMap: Record<string, typeof sectorDistributions.$inferSelect> = {};
  for (const d of clusterDists) {
    if (d.indicatorId) clusterDistMap[d.indicatorId] = d;
  }

  // 5. Predict each indicator
  const resultPredictions: PredictionResult[] = [];

  for (const indicatorId of requestedIndicators) {
    const defaultProfile = INDICATOR_DEFAULT_DRIVER[indicatorId];
    const driver = defaultProfile?.driver ?? "employees";
    const unit = defaultProfile?.unit ?? "value/employee";

    const { value: dv, available: driverAvailable } = driverValue(driver, profile);

    // --- Tier 1/2: cluster-level distribution ---
    const dist = clusterDistMap[indicatorId];
    const macroDist = macroDistMap[indicatorId];

    let p: PredictionResult;

    if (dist && dist.p25 && dist.median && dist.p75 && (dist.nSamples ?? 0) >= MIN_N_DIRECT) {
      // Tier 1: direct cluster distribution
      const p25i = parseFloat(dist.p25);
      const medi = parseFloat(dist.median);
      const p75i = parseFloat(dist.p75);
      const sharpness = p25i > 0 ? p75i / p25i : null;
      const n = dist.nSamples ?? 0;
      const w = parseFloat(dist.shrinkageWeight ?? "1.0");

      const actualUnit = driverAvailable ? unit : unit.replace(/\/.*/, "/employee");

      p = {
        indicatorId,
        predictedValue: medi * dv,
        p25Value: p25i * dv,
        p75Value: p75i * dv,
        unit: actualUnit.split("/")[0], // output unit (e.g. "tCO2e")
        confidence: ((dist as any).confidence as "Alta" | "Media" | "Bassa" | undefined) ?? confidenceFromN(n, sharpness, w),
        fallbackLevel: "cluster",
        nSampleUsed: n,
        shrinkageWeightUsed: w,
        sharpness,
        distributionId: dist.id,
        rationale: buildRationale({
          level: "cluster",
          clusterName: clusterFullName ?? "unknown",
          n,
          w,
          sharpness,
          driver: driverAvailable ? driver : "employees (fallback)",
          dv,
          biasNote: n < 15,
        }),
      };

    } else if (macroDist && macroDist.p25 && macroDist.median && macroDist.p75) {
      // Tier 2: macro-sector fallback
      const p25i = parseFloat(macroDist.p25);
      const medi = parseFloat(macroDist.median);
      const p75i = parseFloat(macroDist.p75);
      const sharpness = p25i > 0 ? p75i / p25i : null;
      const n = macroDist.nSamples ?? 0;

      p = {
        indicatorId,
        predictedValue: medi * dv,
        p25Value: p25i * dv,
        p75Value: p75i * dv,
        unit: unit.split("/")[0],
        confidence: "Bassa",
        fallbackLevel: "macro_sector",
        nSampleUsed: n,
        shrinkageWeightUsed: 0,
        sharpness,
        distributionId: null,
        rationale: buildRationale({
          level: "macro_sector",
          clusterName: macroSector ?? "unknown",
          n,
          w: 0,
          sharpness,
          driver: driverAvailable ? driver : "employees (fallback)",
          dv,
          biasNote: true,
        }),
      };

    } else {
      // Tier 3: national fallback via generateBaseline()
      // generateBaseline() is sector-coefficient based — less precise but always available
      let nationalValue: number | null = null;
      let nationalUnit = unit.split("/")[0];

      try {
        // generateBaseline signature: (projectId, companyData) - wrap safely
        const baseline = await generateBaseline(
          "internal-predict-fallback",
          {
            industry: profile.naceCode,
            employeesCount: profile.employees,
            facilityArea: profile.facilitySqm ?? null,
          } as any
        ).catch(() => null);
        const bRows = Array.isArray(baseline) ? baseline : (baseline as any)?.data ?? [];
        const row = bRows.find((b: any) => b.dpId === indicatorId || b.indicatorId === indicatorId);
        if (row) {
          nationalValue = parseFloat(row.estimatedValue ?? row.value ?? "0") || null;
          nationalUnit = row.unit ?? nationalUnit;
        }
      } catch (e) {
        // generateBaseline may not cover all indicators
      }

      const fallbackVal = nationalValue ?? 0;
      p = {
        indicatorId,
        predictedValue: fallbackVal,
        p25Value: fallbackVal * 0.5,
        p75Value: fallbackVal * 2.0,
        unit: nationalUnit,
        confidence: "Bassa",
        fallbackLevel: "national",
        nSampleUsed: 0,
        shrinkageWeightUsed: 0,
        sharpness: 4.0,  // p75/p25 = 2.0/0.5 = 4x — wide interval
        distributionId: null,
        rationale: `Stima nazionale da coefficienti settoriali (Tier 3 fallback). Cluster ${clusterFullName ?? "sconosciuto"} non ha distribuzione empirica sufficiente (N<${MIN_N_DIRECT}). Intervallo ampio [×0.5, ×2]. Aggiornare con dati PMI reali per migliorare la precisione.`,
      };
    }

    resultPredictions.push(p);
  }

  // 6. Persist prediction_run + predictions to DB (if companyId/projectId provided)
  let runId: string | null = null;
  let persistedCount = 0;

  if (profile.companyId && profile.projectId) {
    try {
      const [run] = await db
        .insert(predictionRuns)
        .values({
          companyId: profile.companyId,
          projectId: profile.projectId,
          clusterId: clusterId ?? undefined,
          distributionVersion: version,
          inputProfile: {
            naceCode: profile.naceCode,
            employees: profile.employees,
            revenueEur: profile.revenueEur,
            facilitySqm: profile.facilitySqm,
            indicators: requestedIndicators,
          },
          status: "completed",
        })
        .returning({ id: predictionRuns.id });

      runId = run.id;

      for (const pred of resultPredictions) {
        await db.insert(predictionsTable).values({
          runId: run.id,
          indicatorId: pred.indicatorId,
          distributionId: pred.distributionId ?? undefined,
          predictedValue: pred.predictedValue.toFixed(4),
          p25Value: pred.p25Value.toFixed(4),
          p75Value: pred.p75Value.toFixed(4),
          unit: pred.unit,
          confidence: pred.confidence as any,
          fallbackLevel: pred.fallbackLevel,
          nSampleUsed: pred.nSampleUsed,
          shrinkageWeightUsed: pred.shrinkageWeightUsed.toFixed(3),
          rationale: pred.rationale,
          state: "proposed",
        });
        persistedCount++;
      }
    } catch (err) {
      // Persist errors are non-fatal — return predictions anyway
      console.warn("[predict] DB persist error:", err);
    }
  }

  return {
    runId,
    clusterId,
    clusterName: clusterFullName,
    macroSector,
    predictions: resultPredictions,
    persistedCount,
  };
}

// ---- Helpers ----

function confidenceFromN(
  n: number,
  sharpness: number | null,
  w: number
): "Alta" | "Media" | "Bassa" {
  if (n >= 30 && w >= 0.8 && sharpness !== null && sharpness < 3) return "Alta";
  if (n >= 10 && sharpness !== null && sharpness < FALLBACK_SHARPNESS_CAP) return "Media";
  return "Bassa";
}

function buildRationale(opts: {
  level: string;
  clusterName: string;
  n: number;
  w: number;
  sharpness: number | null;
  driver: string;
  dv: number;
  biasNote: boolean;
}): string {
  const tier = opts.level === "cluster" ? "Tier 1" : "Tier 2";
  const sharpStr = opts.sharpness !== null ? `sharpness ${opts.sharpness.toFixed(1)}x` : "sharpness n/d";
  let r = `${tier} — distribuzione ${opts.level} "${opts.clusterName}". N=${opts.n} osservazioni`;
  if (opts.w > 0) r += `, shrinkage w=${opts.w.toFixed(2)}`;
  r += `. Driver: ${opts.driver} (valore=${opts.dv.toFixed(1)}). ${sharpStr}.`;
  if (opts.sharpness !== null && opts.sharpness > FALLBACK_SHARPNESS_CAP) {
    r += ` ⚠️ Intervallo ampio (sharpness>${FALLBACK_SHARPNESS_CAP}): aumentare campione per ridurre incertezza.`;
  }
  if (opts.biasNote) {
    r += ` Nota: corpus iniziale rappresenta grandi imprese italiane quotate — le intensità sono normalizzate per mitigare il bias dimensionale, ma la stima per PMI potrebbe differire. Validare con dati reali cliente.`;
  }
  return r;
}
