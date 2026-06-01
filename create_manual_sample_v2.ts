import "dotenv/config";
import { db } from "./src/db";
import { 
  datapoints, datapointValues, companies, projects, documents
} from "./src/db/schema";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import path from "path";

const OUTPUT_PATH = "C:/Users/g.orsolini/Desktop/Giorgio/Privata/Personale/Nuova-cartella/Progetti/Sostenibilità/sustainchain-knowledge/05_quality_assurance/manual_checks/manual_validation_sample_v2.csv";

async function createSample() {
  console.log("🎯 Creating Stratified Manual Validation Sample (v2)...");

  // Get all extracted datapoints with company and document info
  const allData = await db.query.datapointValues.findMany({
    where: eq(datapointValues.state, "auto_extracted_candidate"),
    with: {
      datapoint: true,
      project: {
        with: {
          company: true
        }
      },
      sourceDocument: true
    }
  });

  // Stratification parameters
  const targetTotal = 120;
  const pillars = { E: 45, S: 45, G: 30 };
  
  const sample: any[] = [];
  
  // Group by pillar
  const byPillar: { [key: string]: any[] } = { E: [], S: [], G: [] };
  allData.forEach(d => {
    const p = d.datapoint?.module || "Other";
    if (byPillar[p]) byPillar[p].push(d);
  });

  // Pick stratified rows
  for (const [p, count] of Object.entries(pillars)) {
    const pool = byPillar[p];
    if (!pool) continue;
    
    // Sort by company and confidence to ensure coverage
    pool.sort(() => Math.random() - 0.5);
    sample.push(...pool.slice(0, count));
  }

  // Format for CSV
  const csvRows = [
    "company_name,cluster,pdf_path,disclosure_id,metric_name,pillar,extracted_value,unit,source_page,source_snippet,confidence,manual_value,manual_unit,manual_page,manual_status,error_type,reviewer,review_date,notes"
  ];

  sample.forEach(s => {
    const row = [
      `"${s.project?.company?.name || ''}"`,
      `"${s.project?.company?.industry || ''}"`,
      `"${s.sourceDocument?.storagePath || ''}"`,
      `"${s.datapointId}"`,
      `"${s.datapoint?.name}"`,
      `"${s.datapoint?.module}"`,
      `"${s.value}"`,
      `"${s.datapoint?.unit || ''}"`,
      `"?"`, // Page is in evidenceLinks, but for sample we just need the reference
      `"${(s.evidenceNotes || '').substring(0, 100).replace(/"/g, '""')}"`,
      `"${s.confidence}"`,
      "", "", "", "", "", "", "", "" // Empty for manual review
    ];
    csvRows.push(row.join(","));
  });

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, csvRows.join("\n"), "utf-8");
  console.log(`✅ Stratified sample created at: ${OUTPUT_PATH}`);
  process.exit(0);
}

createSample();
