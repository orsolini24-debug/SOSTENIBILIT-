import "dotenv/config";
import { db } from "./src/db";
import { 
  datapointValues, evidenceLinks
} from "./src/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import fs from "fs";
import path from "path";

const OUTPUT_CSV = "C:/Users/g.orsolini/Desktop/Giorgio/Privata/Personale/Nuova-cartella/Progetti/Sostenibilità/sustainchain-knowledge/04_extraction_pipeline/outputs_validated/esg_dataset_candidate_clean_v2.csv";
const AUDIT_FILE = "C:/Users/g.orsolini/Desktop/Giorgio/Privata/Personale/Nuova-cartella/Progetti/Sostenibilità/sustainchain-knowledge/05_quality_assurance/audit_trail/database_sync_audit_clean_v2.md";

async function cleanDataset() {
  console.log("🧹 Starting Dataset Cleaning & Deduplication...");

  // 1. Get all extracted data with metadata
  const allData = await db.query.datapointValues.findMany({
    where: eq(datapointValues.state, "auto_extracted_candidate"),
    with: {
        datapoint: true,
        project: { with: { company: true } }
    }
  });

  const initialCount = allData.length;
  const seen = new Set();
  const cleanData = [];
  let duplicatesRemoved = 0;
  let conflicts = 0;
  const conflictMap = new Map<string, string>(); // company_id + disclosure_id -> value

  for (const row of allData) {
    const cid = row.project?.company?.name || "unknown";
    const discId = row.datapointId || "unknown";
    const val = row.value || "";
    const unit = row.datapoint?.unit || "";
    const snippet = (row.evidenceNotes || "").substring(0, 50); // Use start of snippet for matching

    // Rule: Duplicate if same company, disclosure, value, unit, and snippet start
    const key = `${cid}|${discId}|${val}|${unit}|${snippet}`;
    const conflictKey = `${cid}|${discId}`;

    if (seen.has(key)) {
        duplicatesRemoved++;
        continue;
    }

    // Rule: Conflict if same company + disclosure but different value
    if (conflictMap.has(conflictKey) && conflictMap.get(conflictKey) !== val) {
        conflicts++;
        // We keep both for now but they will be marked in the validation file
    }

    seen.add(key);
    conflictMap.set(conflictKey, val);
    cleanData.push(row);
  }

  // 2. Export clean CSV
  const csvRows = ["company_id,year,disclosure_id,metric_name,pillar,value,unit,confidence,source_snippet,validation_status"];
  cleanData.forEach(d => {
    csvRows.push([
        d.project?.company?.name || "",
        d.project?.year || "2024",
        d.datapointId,
        d.datapoint?.name,
        d.datapoint?.module,
        `"${d.value}"`,
        `"${d.datapoint?.unit || ''}"`,
        d.confidence,
        `"${(d.evidenceNotes || '').replace(/"/g, '""').substring(0, 200)}"`,
        "auto_extracted_candidate"
    ].join(","));
  });

  fs.writeFileSync(OUTPUT_CSV, csvRows.join("\n"), "utf-8");

  // 3. Generate Audit Report
  const missingTrace = cleanData.filter(d => !d.evidenceNotes || d.evidenceNotes.trim() === "").length;
  
  const report = [
    "# Database Sync Audit - Clean V2",
    `**Date:** ${new Date().toISOString().split('T')[0]}`,
    "\n## 1. Cleaning Results",
    `- **Initial Records:** ${initialCount}`,
    `- **Duplicates Removed:** ${duplicatesRemoved}`,
    `- **Records with Conflict (same disc_id, diff value):** ${conflicts}`,
    `- **Final Candidate Records:** ${cleanData.length}`,
    "\n## 2. Quality Metrics (Clean Set)",
    `- **Records without traceability (snippet):** ${missingTrace}`,
    `- **Validation Status:** All set to \`auto_extracted_candidate\``,
    "\n## 3. Next Steps",
    "1. Use `manual_validation_sample_v2.csv` for human review.",
    "2. Patch extractor based on calibration set errors."
  ];

  fs.writeFileSync(AUDIT_FILE, report.join("\n"), "utf-8");

  console.log(`✅ Dataset cleaned. Final records: ${cleanData.length}`);
  process.exit(0);
}

cleanDataset();
