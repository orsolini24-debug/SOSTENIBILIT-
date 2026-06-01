import "dotenv/config";
import { db } from "./src/db";
import { 
  datapointValues, sectorCoefficients 
} from "./src/db/schema";
import { eq } from "drizzle-orm";

function median(values: number[]) {
    if (values.length === 0) return 0;
    values.sort((a, b) => a - b);
    const half = Math.floor(values.length / 2);
    if (values.length % 2) return values[half];
    return (values[half - 1] + values[half]) / 2.0;
}

function quantile(values: number[], q: number) {
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
        return sorted[base];
    }
}

async function main() {
  console.log("📈 Updating Robust Sector Benchmarks...");

  const data = await db.query.datapointValues.findMany({
    where: eq(datapointValues.state, "auto_extracted_candidate"),
    with: { project: { with: { company: true } } }
  });

  const companyMetrics = new Map<string, Map<string, number>>();
  const companySectors = new Map<string, string>();

  for (const val of data) {
    if (!val.project?.company) continue;
    const cid = val.project.company.id;
    companySectors.set(cid, val.project.company.industry || "generic");
    if (!companyMetrics.has(cid)) companyMetrics.set(cid, new Map());
    const valNum = parseFloat(val.value || "0");
    if (!isNaN(valNum)) companyMetrics.get(cid)!.set(val.datapointId!, valNum);
  }

  const sectorIntensities = new Map<string, Map<string, number[]>>();
  const HEADCOUNT_IDS = ["VSME_B5_HEADCOUNT", "ESRS_S1_6_HEADCOUNT", "headcount"];
  const METRIC_MAP = {
    "kwh_per_employee": ["VSME_B1_ENERGY", "ESRS_E1_5_ENERGY", "energy"],
    "water_per_employee": ["VSME_B3_WATER", "ESRS_E3_4_WATER", "water"],
    "waste_per_employee": ["VSME_B4_WASTE", "ESRS_E5_5_WASTE", "waste"]
  };

  for (const [cid, metrics] of companyMetrics.entries()) {
    const sector = companySectors.get(cid)!;
    let headcount = 0;
    for (const id of HEADCOUNT_IDS) { if (metrics.has(id)) { headcount = metrics.get(id)!; break; } }
    if (headcount <= 0) continue;

    for (const [type, ids] of Object.entries(METRIC_MAP)) {
        for (const id of ids) {
            if (metrics.has(id)) {
                if (!sectorIntensities.has(sector)) sectorIntensities.set(sector, new Map());
                if (!sectorIntensities.get(sector)!.has(type)) sectorIntensities.get(sector)!.set(type, []);
                sectorIntensities.get(sector)!.get(type)!.push(metrics.get(id)! / headcount);
            }
        }
    }
  }

  for (const [sector, types] of sectorIntensities.entries()) {
    const prefix = sector.match(/^\d+/) ? sector.substring(0, 2) : sector;
    for (const [type, values] of types.entries()) {
        const n = values.length;
        const med = median(values);
        const p25 = quantile(values, 0.25);
        const p75 = quantile(values, 0.75);
        const avg = values.reduce((a, b) => a + b, 0) / n;
        
        let grade: "Alta" | "Media" | "Bassa" | "Non determinabile" = "Bassa";
        if (n >= 30) grade = "Alta";
        else if (n >= 10) grade = "Media";

        console.log(`📊 Sector: ${prefix}, Type: ${type}, Median: ${med.toFixed(2)} (n=${n})`);

        await db.insert(sectorCoefficients).values({
            atecoPrefix: prefix,
            coefficientType: type,
            value: med.toString(), // Use median for robustness
            unit: type.includes("kwh") ? "kWh/addetto" : type.includes("water") ? "m3/addetto" : "t/addetto",
            source: "SustainChain Analytical Sync v2",
            sampleSize: n,
            confidence: grade
        }).onConflictDoNothing(); // Need a better way to update, but for now let's avoid duplicates
    }
  }
  process.exit(0);
}
main();
