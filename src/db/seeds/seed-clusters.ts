/**
 * seed-clusters.ts
 * Seeds cluster_definitions with 7 ATECO × 3 size_class combinations.
 *
 * Cluster logic (scientifically grounded):
 * - ATECO prefix determines the sector type (intensity profiles differ substantially)
 * - size_class (micro/small/medium) controls the driver scale:
 *     micro  = 1-9 addetti
 *     small  = 10-49 addetti
 *     medium = 50-249 addetti
 * - Each cluster has a canonical intensity_driver per KPI (from OECD 2023 SME GHG guidelines)
 *
 * Shrinkage hierarchy: cluster → macro_sector → national
 * macro_sector groups:
 *   manifattura_leggera: moda_tessile, agroalimentare, meccatronica
 *   manifattura_pesante: chimico_plastico
 *   costruzioni: edilizia_impiantistica
 *   servizi_infrastruttura: utilities, gdo
 */

import "dotenv/config";
import { db } from "@/db";
import { clusterDefinitions } from "@/db/schema";
import { eq } from "drizzle-orm";

// ---- Cluster catalog ----
// Each entry = one row in cluster_definitions
// atecoPrefix: first 2 digits of ATECO 2007 code (Italian classification)
// intensityProfiles: canonical driver per KPI (for computeDistributions.ts reference)

const CLUSTERS = [
  // ─── MANIFATTURA LEGGERA ───────────────────────────────────────────────
  {
    name: "meccatronica",
    atecoPrefix: "28",          // Fabbricazione di macchinari e apparecchi n.c.a.
    macroSector: "manifattura_leggera",
    description: "Aziende meccaniche, macchine industriali, lavorazioni metalliche (ATECO 25-30)",
    atecoCoverage: ["24","25","26","27","28","29","30"],
    intensityProfiles: {
      total_energy: { driver: "facility_area_sqm", unit: "kWh/sqm" },
      scope_1_ghg: { driver: "employees", unit: "tCO2e/employee" },
      scope_2_location_based: { driver: "facility_area_sqm", unit: "tCO2e/sqm" },
      scope_2_market_based: { driver: "facility_area_sqm", unit: "tCO2e/sqm" },
      scope_3_total: { driver: "revenue_eur", unit: "tCO2e/MEUR" },
    },
  },
  {
    name: "agroalimentare",
    atecoPrefix: "10",          // Industrie alimentari
    macroSector: "manifattura_leggera",
    description: "Produzione alimentare, bevande, agricoltura e trasformazione (ATECO 01-03, 10-12)",
    atecoCoverage: ["01","02","03","10","11","12"],
    intensityProfiles: {
      total_energy: { driver: "revenue_eur", unit: "kWh/MEUR" },
      scope_1_ghg: { driver: "employees", unit: "tCO2e/employee" },
      scope_2_location_based: { driver: "facility_area_sqm", unit: "tCO2e/sqm" },
      scope_2_market_based: { driver: "facility_area_sqm", unit: "tCO2e/sqm" },
      scope_3_total: { driver: "revenue_eur", unit: "tCO2e/MEUR" },
    },
  },
  {
    name: "moda_tessile",
    atecoPrefix: "13",          // Industrie tessili
    macroSector: "manifattura_leggera",
    description: "Tessile, abbigliamento, pelle, calzature (ATECO 13-15)",
    atecoCoverage: ["13","14","15"],
    intensityProfiles: {
      total_energy: { driver: "employees", unit: "kWh/employee" },
      scope_1_ghg: { driver: "employees", unit: "tCO2e/employee" },
      scope_2_location_based: { driver: "employees", unit: "tCO2e/employee" },
      scope_2_market_based: { driver: "employees", unit: "tCO2e/employee" },
      scope_3_total: { driver: "revenue_eur", unit: "tCO2e/MEUR" },
    },
  },
  // ─── MANIFATTURA PESANTE ───────────────────────────────────────────────
  {
    name: "chimico_plastico",
    atecoPrefix: "20",          // Industria chimica
    macroSector: "manifattura_pesante",
    description: "Chimica, plastica, gomma, farmaceutica (ATECO 20-22)",
    atecoCoverage: ["20","21","22"],
    intensityProfiles: {
      total_energy: { driver: "facility_area_sqm", unit: "kWh/sqm" },
      scope_1_ghg: { driver: "facility_area_sqm", unit: "tCO2e/sqm" },
      scope_2_location_based: { driver: "facility_area_sqm", unit: "tCO2e/sqm" },
      scope_2_market_based: { driver: "facility_area_sqm", unit: "tCO2e/sqm" },
      scope_3_total: { driver: "revenue_eur", unit: "tCO2e/MEUR" },
    },
  },
  // ─── COSTRUZIONI ──────────────────────────────────────────────────────
  {
    name: "edilizia_impiantistica",
    atecoPrefix: "41",          // Costruzione di edifici
    macroSector: "costruzioni",
    description: "Edilizia, costruzioni, impianti tecnici, infrastrutture (ATECO 41-43)",
    atecoCoverage: ["41","42","43"],
    intensityProfiles: {
      total_energy: { driver: "employees", unit: "kWh/employee" },
      scope_1_ghg: { driver: "fleet_size", unit: "tCO2e/vehicle" },
      scope_2_location_based: { driver: "employees", unit: "tCO2e/employee" },
      scope_2_market_based: { driver: "employees", unit: "tCO2e/employee" },
      scope_3_total: { driver: "revenue_eur", unit: "tCO2e/MEUR" },
    },
  },
  // ─── SERVIZI & INFRASTRUTTURA ─────────────────────────────────────────
  {
    name: "utilities",
    atecoPrefix: "35",          // Fornitura di energia elettrica, gas, vapore
    macroSector: "servizi_infrastruttura",
    description: "Utilities, energia, acqua, rifiuti, trasporti (ATECO 35-39, 49-53)",
    atecoCoverage: ["35","36","37","38","39","49","50","51","52","53"],
    intensityProfiles: {
      total_energy: { driver: "revenue_eur", unit: "kWh/MEUR" },
      scope_1_ghg: { driver: "revenue_eur", unit: "tCO2e/MEUR" },
      scope_2_location_based: { driver: "revenue_eur", unit: "tCO2e/MEUR" },
      scope_2_market_based: { driver: "revenue_eur", unit: "tCO2e/MEUR" },
      scope_3_total: { driver: "revenue_eur", unit: "tCO2e/MEUR" },
    },
  },
  {
    name: "gdo_retail",
    atecoPrefix: "47",          // Commercio al dettaglio
    macroSector: "servizi_infrastruttura",
    description: "Grande distribuzione, retail, commercio all'ingrosso (ATECO 45-47)",
    atecoCoverage: ["45","46","47"],
    intensityProfiles: {
      total_energy: { driver: "facility_area_sqm", unit: "kWh/sqm" },
      scope_1_ghg: { driver: "employees", unit: "tCO2e/employee" },
      scope_2_location_based: { driver: "facility_area_sqm", unit: "tCO2e/sqm" },
      scope_2_market_based: { driver: "facility_area_sqm", unit: "tCO2e/sqm" },
      scope_3_total: { driver: "revenue_eur", unit: "tCO2e/MEUR" },
    },
  },
];

const SIZE_CLASSES = [
  { sizeClass: "micro",  label: "1-9 addetti",    employeesMin: 1,  employeesMax: 9   },
  { sizeClass: "small",  label: "10-49 addetti",  employeesMin: 10, employeesMax: 49  },
  { sizeClass: "medium", label: "50-249 addetti", employeesMin: 50, employeesMax: 249 },
];

// ---- Seed function ----

export async function seedClusters(dryRun = false) {
  console.log(`\n=== Seed cluster_definitions (dryRun=${dryRun}) ===\n`);

  const existing = await db.select().from(clusterDefinitions);
  console.log(`Existing clusters: ${existing.length}`);

  let inserted = 0;
  let skipped = 0;

  for (const cluster of CLUSTERS) {
    for (const size of SIZE_CLASSES) {
      const fullName = `${cluster.name}_${size.sizeClass}`;
      const alreadyExists = existing.find(
        (e) => e.name === fullName && e.atecoPrefix === cluster.atecoPrefix && e.sizeClass === size.sizeClass
      );
      if (alreadyExists) {
        console.log(`  SKIP (exists): ${fullName}`);
        skipped++;
        continue;
      }

      const row = {
        name: fullName,
        atecoPrefix: cluster.atecoPrefix,
        sizeClass: size.sizeClass,
        description: `${cluster.description} — ${size.label}`,
        metadata: {
          macroSector: cluster.macroSector,
          atecoCoverage: cluster.atecoCoverage,
          intensityProfiles: cluster.intensityProfiles,
          employeesMin: size.employeesMin,
          employeesMax: size.employeesMax,
        },
      };

      if (!dryRun) {
        await db.insert(clusterDefinitions).values(row);
      }
      console.log(`  ${dryRun ? "DRY" : "INS"}: ${fullName} | ATECO ${cluster.atecoPrefix} | ${size.label}`);
      inserted++;
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped. Total clusters = ${CLUSTERS.length * SIZE_CLASSES.length} (7 sectors × 3 sizes).`);
  return { inserted, skipped };
}

// ---- Macro-sector fallback catalog (for shrinkage) ----
// Used by computeDistributions.ts to build the fallback chain.
export const MACRO_SECTOR_CLUSTER_MAP: Record<string, string[]> = {
  manifattura_leggera: ["meccatronica", "agroalimentare", "moda_tessile"],
  manifattura_pesante: ["chimico_plastico"],
  costruzioni: ["edilizia_impiantistica"],
  servizi_infrastruttura: ["utilities", "gdo_retail"],
};

// canonical intensity driver per indicator (KPI-level, cluster-agnostic default)
export const INDICATOR_DEFAULT_DRIVER: Record<string, { driver: string; unit: string }> = {
  scope_1_ghg_emissions:      { driver: "employees",        unit: "tCO2e/employee" },
  scope_2_location_based:     { driver: "facility_area_sqm",unit: "tCO2e/sqm" },
  scope_2_market_based:       { driver: "facility_area_sqm",unit: "tCO2e/sqm" },
  scope_3_total_ghg_emissions:{ driver: "revenue_eur",      unit: "tCO2e/MEUR" },
  total_energy_consumption:   { driver: "facility_area_sqm",unit: "kWh/sqm" },
};

if (require.main === module) {
  const dryRun = process.argv.includes("--dry");
  seedClusters(dryRun)
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
