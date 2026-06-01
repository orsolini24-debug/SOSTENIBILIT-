import "dotenv/config";
import { db } from "./src/db";
import { 
  organizations, companies, projects, documents, 
  datapoints, datapointValues, evidenceLinks 
} from "./src/db/schema";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const KNOWLEDGE_BASE = "C:/Users/g.orsolini/Desktop/Giorgio/Privata/Personale/Nuova-cartella/Progetti/Sostenibilità/sustainchain-knowledge";

async function main() {
  console.log("🚀 Starting ESG Data Synchronization...");

  // 1. Get or Create Organization
  let org = await db.query.organizations.findFirst({
    where: eq(organizations.name, "SustainChain Baseline")
  });

  if (!org) {
    [org] = await db.insert(organizations).values({
      name: "SustainChain Baseline",
      settings: { type: "baseline_collection" }
    }).returning();
    console.log(`✅ Created Organization: ${org.id}`);
  } else {
    console.log(`ℹ️ Using Organization: ${org.id}`);
  }

  // 2. Sync Datapoints (Dictionary)
  console.log("📖 Syncing Datapoints from Dictionary...");
  const dictPath = path.join(KNOWLEDGE_BASE, "03_dictionaries", "framework_dictionary", "esg_disclosure_dictionary.csv");
  const dictContent = fs.readFileSync(dictPath, "utf-8");
  const dictData = parse(dictContent, { columns: true, skip_empty_lines: true });

  for (const row of dictData) {
    await db.insert(datapoints).values({
      id: row.disclosure_id,
      code: row.disclosure_id.split('_').pop() || row.disclosure_id,
      name: row.metric_name,
      description: row.description,
      unit: row.unit_canonical,
      module: row.framework,
    }).onConflictDoUpdate({
      target: datapoints.id,
      set: {
        name: row.metric_name,
        description: row.description,
        unit: row.unit_canonical,
        module: row.framework,
      }
    });
  }

  // Add generic GOV_QUALITATIVE if not present
  await db.insert(datapoints).values({
    id: "GOV_QUALITATIVE",
    code: "GOV",
    name: "Informazioni Qualitative Governance",
    description: "Dati qualitativi estratti relativi a policy, certificazioni e modelli organizzativi",
    unit: "boolean",
    module: "G",
  }).onConflictDoNothing();

  console.log(`✅ Synced ${dictData.length} datapoints.`);

  // 3. Sync Companies and Projects
  console.log("🏢 Syncing Companies and Projects...");
  const regPath = path.join(KNOWLEDGE_BASE, "02_company_reports", "metadata", "company_report_registry.csv");
  const regContent = fs.readFileSync(regPath, "utf-8").replace(/^\uFEFF/, ""); // Remove BOM
  const regData = parse(regContent, { columns: true, delimiter: ';', skip_empty_lines: true });

  console.log("First reg row keys:", Object.keys(regData[0]));
  console.log("First reg row data:", regData[0]);

  const companyMap = new Map();
  const projectMap = new Map();
  const docMap = new Map();

  for (const row of regData) {
    if (!row.company_id) {
        console.warn("⚠️ Skipping row with missing company_id:", row);
        continue;
    }
    // Upsert Company
    let [company] = await db.insert(companies).values({
      organizationId: org.id,
      name: row.company_name || row.company_id,
      industry: row.cluster,
      location: row.language === 'it' ? 'Italy' : 'International',
    }).onConflictDoNothing().returning();

    if (!company) {
      company = await db.query.companies.findFirst({
        where: and(eq(companies.organizationId, org.id), eq(companies.name, row.company_name || row.company_id))
      });
    }

    if (!company) {
        console.error("❌ Failed to upsert company:", row.company_name);
        continue;
    }
    companyMap.set(row.company_id, company.id);

    // Upsert Project
    let [project] = await db.insert(projects).values({
      organizationId: org.id,
      companyId: company.id,
      name: `Rendicontazione ${row.year || '2024'}`,
      year: parseInt(row.year) || 2024,
      status: "validated",
    }).onConflictDoNothing().returning();

    if (!project) {
        project = await db.query.projects.findFirst({
            where: and(eq(projects.companyId, company.id), eq(projects.year, parseInt(row.year) || 2024))
        });
    }
    
    if (!project) {
        console.error("❌ Failed to upsert project for:", row.company_id);
        continue;
    }
    projectMap.set(row.company_id, project.id);

    const docName = (row.report_title && row.report_title.trim() !== '') ? row.report_title : row.company_id;
    console.log(`📄 Syncing document: "${docName}" for project ${project.id}`);

    // Upsert Document
    let [doc] = await db.insert(documents).values({
      projectId: project.id,
      name: docName,
      type: "sustainability_report",
      storagePath: row.local_pdf_path || "",
      status: "processed"
    }).onConflictDoNothing().returning();

    if (!doc) {
        doc = await db.query.documents.findFirst({
            where: and(eq(documents.projectId, project.id), eq(documents.name, docName))
        });
    }
    if (doc) docMap.set(row.company_id, doc.id);
  }
  console.log(`✅ Synced ${regData.length} companies and projects.`);

  // 4. Sync ESG Datapoint Values
  console.log("📊 Syncing ESG Datapoint Values (Batching)...");
  const dataPath = path.join(KNOWLEDGE_BASE, "04_extraction_pipeline", "outputs_validated", "esg_dataset_candidate_v2.csv");
  const dataContent = fs.readFileSync(dataPath, "utf-8").replace(/^\uFEFF/, ""); // Remove BOM
  const esgData = parse(dataContent, { columns: true, skip_empty_lines: true });

  const BATCH_SIZE = 50;
  let processed = 0;

  for (let i = 0; i < esgData.length; i += BATCH_SIZE) {
    const batch = esgData.slice(i, i + BATCH_SIZE);
    
    for (const row of batch) {
        const projectId = projectMap.get(row.company_id);
        const docId = docMap.get(row.company_id);
        
        if (!projectId) continue;

        // Map confidence score to enum
        let conf: "Alta" | "Media" | "Bassa" | "Non determinabile" = "Bassa";
        const score = parseFloat(row.confidence);
        if (score >= 0.8) conf = "Alta";
        else if (score >= 0.6) conf = "Media";

        try {
            const [val] = await db.insert(datapointValues).values({
                projectId: projectId,
                datapointId: row.disclosure_id,
                value: row.value_norm,
                state: "auto_extracted_candidate",
                confidence: conf,
                sourceDocumentId: docId,
                evidenceNotes: `Snippet: ${row.snippet?.substring(0, 500)}`,
            }).returning();

            if (val && docId && row.page_number) {
                await db.insert(evidenceLinks).values({
                    datapointValueId: val.id,
                    documentId: docId,
                    pageReference: parseInt(row.page_number) || null,
                    metadata: { snippet: row.snippet, source_type: row.source_type }
                });
            }
            processed++;
        } catch (e) {
            console.error(`❌ Error inserting row for ${row.company_id}:`, e.message);
        }
    }
    console.log(`⏳ Processed ${processed}/${esgData.length} ESG data points...`);
  }

  console.log(`✅ Synced ${processed} ESG data points.`);
  console.log("🎉 Synchronization Complete!");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Error during sync:", err);
  process.exit(1);
});
