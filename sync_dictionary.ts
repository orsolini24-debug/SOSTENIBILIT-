import "dotenv/config";
import { db } from "./src/db";
import { datapoints } from "./src/db/schema";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

async function syncDictionary() {
  const dictionaryPath = path.join(__dirname, "..", "sustainchain-knowledge", "03_dictionaries", "framework_dictionary", "esg_disclosure_dictionary.csv");
  
  if (!fs.existsSync(dictionaryPath)) {
    console.error("Dictionary file not found at:", dictionaryPath);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(dictionaryPath, "utf-8");
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Found ${records.length} records in dictionary. Syncing to DB...`);

  for (const record of records as any[]) {
    await db.insert(datapoints).values({
      id: record.disclosure_id,
      code: record.standard + "-" + record.section,
      name: record.metric_name,
      description: record.description,
      unit: record.unit,
      module: record.framework,
      sectorRelevance: { 
        mandatory_status: record.mandatory_status,
        applicability: record.applicability_rule,
        pillar: record.pillar
      },
    }).onConflictDoUpdate({
      target: datapoints.id,
      set: {
        name: record.metric_name,
        description: record.description,
        unit: record.unit,
        module: record.framework,
        sectorRelevance: { 
          mandatory_status: record.mandatory_status,
          applicability: record.applicability_rule,
          pillar: record.pillar
        },
      }
    });
  }

  console.log("Sync complete!");
  process.exit(0);
}

syncDictionary().catch((e) => {
  console.error(e);
  process.exit(1);
});
