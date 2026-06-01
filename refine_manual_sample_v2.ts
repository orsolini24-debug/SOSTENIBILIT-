import "dotenv/config";
import { db } from "./src/db";
import { 
  datapoints, datapointValues, companies, projects, documents
} from "./src/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

const OUTPUT_CSV = "C:/Users/g.orsolini/Desktop/Giorgio/Privata/Personale/Nuova-cartella/Progetti/Sostenibilità/sustainchain-knowledge/05_quality_assurance/manual_checks/manual_validation_sample_v2.csv";

async function refineSample() {
  console.log("🎯 Refining Stratified Manual Validation Sample (v2)...");

  // 1. Get pool of candidates
  const allData = await db.query.datapointValues.findMany({
    where: eq(datapointValues.state, "auto_extracted_candidate"),
    with: {
      datapoint: true,
      project: { with: { company: true } },
      sourceDocument: true
    }
  });

  // Pillar Mapping Logic
  const getPillar = (dpId: string): string => {
    if (dpId.startsWith("VSME-B1") || dpId.startsWith("VSME-B2") || dpId.startsWith("VSME-B3") || dpId.startsWith("VSME-B4") || 
        dpId.startsWith("VSME-B10") || dpId.startsWith("VSME-B11") || dpId.startsWith("VSME-B12") ||
        dpId.startsWith("ESRS_E") || dpId.startsWith("VSME_B1_GHG") || dpId.startsWith("VSME_B2_ENERGY") ||
        dpId.startsWith("GRI_302") || dpId.startsWith("GRI_305")) return "E";
    
    if (dpId.startsWith("VSME-B5") || dpId.startsWith("VSME-B6") || dpId.startsWith("VSME-B7") || 
        dpId.startsWith("ESRS_S") || dpId.startsWith("VSME_B5_HEADCOUNT") || dpId.startsWith("VSME_B7_PAYGAP") ||
        dpId.startsWith("GRI_405")) return "S";

    if (dpId.startsWith("VSME-B8") || dpId.startsWith("VSME-B9") || 
        dpId.startsWith("ESRS_G") || dpId.startsWith("VSME_B8_CORRUPTION") || dpId.startsWith("GOV_QUALITATIVE")) return "G";

    return "Other";
  };

  // Stratification
  const targetTotal = 120;
  const pillars = { E: 45, S: 45, G: 30 };
  const sample: any[] = [];
  
  const byPillar: { [key: string]: any[] } = { E: [], S: [], G: [], Other: [] };
  allData.forEach(d => {
    const dpId = d.datapointId || "";
    const p = getPillar(dpId);
    if (byPillar[p]) byPillar[p].push(d);
    if (dpId.includes("B1") || dpId.includes("B2")) {
       // console.log(`Debug: ID=${dpId}, Pillar=${p}`);
    }
  });

  console.log(`📊 Distribution: E: ${byPillar.E.length}, S: ${byPillar.S.length}, G: ${byPillar.G.length}, Other: ${byPillar.Other.length}`);

  for (const [p, count] of Object.entries(pillars)) {
    const pool = byPillar[p as keyof typeof pillars];
    if (!pool || pool.length === 0) {
      console.warn(`⚠️ Pillar ${p} has no candidates!`);
      continue;
    }
    pool.sort(() => Math.random() - 0.5);
    const selected = pool.slice(0, count);
    sample.push(...selected);
    console.log(`✅ Selected ${selected.length}/${count} for Pillar ${p}`);
  }

  // 2. Add metadata and QA split
  // Shuffle sample to mix pillars before splitting
  sample.sort(() => Math.random() - 0.5);
  
  const finalRows = sample.map((s, idx) => {
    // Determine split: 80 calibration (2/3), 40 holdout (1/3)
    const qa_split = (idx % 3 === 0) ? "holdout" : "calibration";
    
    return {
      company_name: s.project?.company?.name || "",
      cluster: s.project?.company?.industry || "",
      pdf_path: s.sourceDocument?.storagePath || "",
      disclosure_id: s.datapointId,
      metric_name: s.datapoint?.name,
      pillar: getPillar(s.datapointId || ""),
      extracted_value: s.value,
      unit: s.datapoint?.unit || "",
      source_page: "?", // To be filled manually during audit
      source_snippet: (s.evidenceNotes || "").replace(/"/g, '""').substring(0, 300),
      confidence: s.confidence,
      year: s.project?.year || "2024",
      boundary: "unknown",
      qa_split: qa_split,
      manual_value: "",
      manual_unit: "",
      manual_page: "",
      manual_status: "",
      error_type: "",
      reviewer: "",
      review_date: "",
      notes: ""
    };
  });

  // 3. Save to CSV
  const headers = Object.keys(finalRows[0]).join(",");
  const csvContent = [headers];
  finalRows.forEach(row => {
    const values = Object.values(row).map(v => `"${v}"`);
    csvContent.push(values.join(","));
  });

  fs.writeFileSync(OUTPUT_CSV, csvContent.join("\n"), "utf-8");
  console.log(`✅ Refined sample created with ${finalRows.length} rows at: ${OUTPUT_CSV}`);
  process.exit(0);
}

refineSample();
