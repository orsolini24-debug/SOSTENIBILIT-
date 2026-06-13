import "dotenv/config";
import * as fs from "fs/promises";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { retrieveChunks } from "./retrieve";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";

const GT_FILE = path.resolve(__dirname, "../../../../eval/ground_truth_v2.csv");
const OUTPUT_FILE = path.resolve(__dirname, "../../../../eval/retrieval_eval_report.md");

export async function evaluateRetrieval() {
  console.log("Inizio valutazione Retrieval Ibrido contro GT v2...");
  
  let gtData: any[];
  try {
    const csvContent = await fs.readFile(GT_FILE, "utf-8");
    gtData = parse(csvContent, { columns: true, skip_empty_lines: true });
  } catch (e) {
    console.error(`Impossibile leggere Ground Truth da ${GT_FILE}. Salto valutazione.`);
    return;
  }

  let totalQueries = 0;
  let hitsAt5 = 0;
  let hitsAt10 = 0;
  let mrrSum = 0;
  
  const failureCases: any[] = [];

  // Mappa document_name -> document_id
  const docCache = new Map<string, string>();

  for (const row of gtData) {
    // GT v2 CSV uses column "status", not "validation_status"
    if (row.status !== "verified" && row.status !== "rebuilt") {
      continue;
    }
    
    // Serve document_name (es. dal file originale)
    const sourceFile = row.source_file;
    const expectedPage = parseInt(row.page_number, 10);
    const disclosureId = row.disclosure_id;
    
    if (!sourceFile || isNaN(expectedPage) || !disclosureId) continue;

    let documentId = docCache.get(sourceFile);
    if (!documentId) {
       // Cerca per name o hash. Siccome T1 usa name = source_file (o chunk_nome), usiamo like %name%
       const docs = await db.select().from(documents);
       const match = docs.find(d => sourceFile.includes(d.name) || d.name.includes(sourceFile));
       if (match) {
         documentId = match.id;
         docCache.set(sourceFile, match.id);
       }
    }

    if (!documentId) {
       // Se il documento non esiste, non possiamo valutare (salto o mock failure?)
       continue;
    }

    totalQueries++;
    
    // Retrieve top 10
    const chunks = await retrieveChunks(documentId, disclosureId, 10);
    
    // Eval metrics
    let rank = -1;
    for (let i = 0; i < chunks.length; i++) {
       if (chunks[i].page === expectedPage) {
          rank = i + 1;
          break;
       }
    }

    if (rank > 0 && rank <= 5) hitsAt5++;
    if (rank > 0 && rank <= 10) hitsAt10++;
    if (rank > 0) mrrSum += (1.0 / rank);
    else {
      failureCases.push({
        disclosureId,
        sourceFile,
        expectedPage,
        top1Page: chunks.length > 0 ? chunks[0].page : 'N/A'
      });
    }
  }

  if (totalQueries === 0) {
    console.log("Nessuna riga valida (o documenti non ingeriti) per l'evaluation.");
    return;
  }

  const recall5 = (hitsAt5 / totalQueries) * 100;
  const recall10 = (hitsAt10 / totalQueries) * 100;
  const mrr = mrrSum / totalQueries;

  const report = `# Phase 8 - Retrieval Evaluation Report
  
## Metriche Globali
- **Total Queries**: ${totalQueries}
- **Recall@5**: ${recall5.toFixed(2)}%
- **Recall@10**: ${recall10.toFixed(2)}%
- **MRR**: ${mrr.toFixed(3)}

## Analisi Fallimenti (Recall@10 = 0)
${failureCases.length === 0 ? "Nessun fallimento nei top 10." : 
  failureCases.map(f => `- [${f.disclosureId}] in ${f.sourceFile}: attesa pag ${f.expectedPage}, top 1 era ${f.top1Page}`).join("\n")}

*Generato automaticamente da eval-retrieval.ts*
`;

  await fs.writeFile(OUTPUT_FILE, report);
  console.log(`Valutazione completata. Recall@10 = ${recall10.toFixed(2)}%. Report salvato in ${OUTPUT_FILE}`);
}

// Esecuzione stand-alone
if (require.main === module) {
  evaluateRetrieval().then(() => process.exit(0)).catch(e => { c