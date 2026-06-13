import "dotenv/config";
import * as fs from "fs/promises";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { extract } from "./extract";
import { db } from "@/db";
import { documents } from "@/db/schema";

const GT_FILE = path.resolve(__dirname, "../../../../eval/ground_truth_v2.csv");
const OUTPUT_FILE = path.resolve(__dirname, "../../../../eval/extract_e2e_phase8c2_2026-06-13.md");

export async function runE2EEval() {
  console.log("Inizio E2E Measurement su GT v2...");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ATTENZIONE: ANTHROPIC_API_KEY mancante. Le estrazioni reali useranno il mock, generando risultati fallati o mockati.");
  }

  let gtData: any[];
  try {
    const csvContent = await fs.readFile(GT_FILE, "utf-8");
    gtData = parse(csvContent, { columns: true, skip_empty_lines: true });
  } catch (e) {
    console.error(`Impossibile leggere Ground Truth da ${GT_FILE}.`);
    return;
  }

  // Prendi solo le prime 10 righe verified per non consumare troppi token
  const validRows = gtData.filter(r => r.status === "verified" || r.status === "rebuilt").slice(0, 10);
  
  if (validRows.length < 5) {
    console.warn(`Trovate solo ${validRows.length} righe valide. L'istruzione richiedeva >= 5.`);
  }

  const results: any[] = [];
  const docCache = new Map<string, string>();

  for (const row of validRows) {
    const sourceFile = row.source_file;
    const disclosureId = row.disclosure_id;
    const expectedValue = row.raw_value;
    const expectedPage = parseInt(row.page_number, 10);
    const expectedYear = parseInt(row.year, 10) || 2024;

    let documentId = docCache.get(sourceFile);
    if (!documentId) {
       const docs = await db.select().from(documents);
       const match = docs.find(d => sourceFile.includes(d.name) || d.name.includes(sourceFile));
       if (match) {
         documentId = match.id;
         docCache.set(sourceFile, match.id);
       }
    }

    if (!documentId) {
      console.warn(`Documento non trovato nel DB: ${sourceFile}`);
      continue;
    }

    console.log(`Esecuzione extract per ${disclosureId} su ${sourceFile}...`);
    
    try {
      const extResult = await extract(documentId, disclosureId);
      
      const best = extResult.candidates.length > 0 ? extResult.candidates[0] : null;

      results.push({
        disclosureId,
        sourceFile,
        expectedValue,
        expectedPage,
        expectedYear,
        actualValue: best ? best.raw_value : "N/A",
        actualPage: best ? best.page : "N/A",
        actualYear: best ? best.year : "N/A",
        status: best ? "Extracted" : "Failed (No candidates)",
        match: best && 
               String(best.raw_value).trim() === String(expectedValue).trim() && 
               best.page === expectedPage && 
               best.year === expectedYear
      });
    } catch (e) {
      console.error(`Errore in extract per ${disclosureId}:`, e);
      results.push({
        disclosureId,
        sourceFile,
        expectedValue,
        expectedPage,
        expectedYear,
        actualValue: "ERROR",
        actualPage: "ERROR",
        actualYear: "ERROR",
        status: "Exception",
        match: false
      });
    }
  }

  const matches = results.filter(r => r.match).length;
  const total = results.length;
  
  const markdown = `# Phase 8 - E2E Extraction Evaluation
  
## Metriche Globali
- **Total Tested**: ${total}
- **Perfect Matches (Value, Page, Year)**: ${matches} (${total > 0 ? ((matches/total)*100).toFixed(2) : 0}%)

## Tabella Onesta dei Risultati

| Disclosure | Source File | Expected (Val, Pag, Anno) | Actual (Val, Pag, Anno) | Status | Match |
|---|---|---|---|---|---|
${results.map(r => `| ${r.disclosureId} | ${r.sourceFile} | ${r.expectedValue}, p.${r.expectedPage}, ${r.expectedYear} | ${r.actualValue}, p.${r.actualPage}, ${r.actualYear} | ${r.status} | ${r.match ? '✅' : '❌'} |`).join('\n')}

*Generato automaticamente da eval-e2e.ts*
`;

  await fs.writeFile(OUTPUT_FILE, markdown);
  console.log(`E2E Evaluation completata. Risultati in ${OUTPUT_FILE}`);
}

if (require.main === module) {
  runE2EEval().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
