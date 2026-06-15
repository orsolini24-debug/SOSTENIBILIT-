import "dotenv/config";
import * as fs from "fs/promises";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { extract } from "./extract";
import { db } from "@/db";
import { documents, documentChunks } from "@/db/schema";
import { sql, count } from "drizzle-orm";

const GT_FILE = path.resolve(__dirname, "../../../../eval/ground_truth_v2.csv");
const TODAY = new Date().toISOString().slice(0, 10);
const OUTPUT_FILE = path.resolve(__dirname, `../../../../eval/extract_e2e_${TODAY}.md`);

export async function runE2EEval() {
  console.log("Inizio E2E Measurement su GT v2...");

  const hasApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!hasApiKey) {
    console.error("ERRORE: nessuna chiave API trovata nel file .env.");
    console.error("  Aggiungi GOOGLE_GENERATIVE_AI_API_KEY (Gemini, gratuito) oppure ANTHROPIC_API_KEY.");
    process.exit(1);
  }

  let gtData: any[];
  try {
    const csvContent = await fs.readFile(GT_FILE, "utf-8");
    gtData = parse(csvContent, { columns: true, skip_empty_lines: true });
  } catch (e) {
    console.error(`Impossibile leggere Ground Truth da ${GT_FILE}.`);
    return;
  }

  const validRows = gtData.filter(r => r.status === "verified" || r.status === "rebuilt");
  
  if (validRows.length < 5) {
    console.warn(`Trovate solo ${validRows.length} righe valide. L'istruzione richiedeva >= 5.`);
  }

  const results: any[] = [];
  const docCache = new Map<string, string>();

  for (const row of validRows) {
    const sourceFile = row.source_file;
    const disclosureId = row.disclosure_id;
    const expectedValue = row.expected_value;
    const expectedPage = parseInt(row.page_number, 10);
    const expectedYear = parseInt(row.year, 10) || 2024;

    let documentId = docCache.get(sourceFile);
    if (!documentId) {
       // Cerca il documento con più chunks (ci sono duplicati con 0 chunks nel DB)
       const rows = await db.execute(sql`
         SELECT d.id, d.name, COUNT(dc.id)::int as chunk_count
         FROM documents d
         LEFT JOIN document_chunks dc ON dc.document_id = d.id
         WHERE d.name ILIKE ${'%' + sourceFile.replace(/\.pdf$/i,'') + '%'}
         GROUP BY d.id, d.name
         ORDER BY chunk_count DESC
         LIMIT 1
       `);
       const match = (rows as any).rows?.[0] ?? rows[0];
       if (match && Number(match.chunk_count) > 0) {
         documentId = match.id as string;
         docCache.set(sourceFile, documentId);
         console.log(`  [DOC] ${sourceFile} → id=${documentId} chunks=${match.chunk_count}`);
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

      // Normalizza numero: rimuove separatori migliaia (. o ,) e converte virgola decimale in punto
      function normalizeNum(v: any): number | null {
        if (v == null || v === "N/A") return null;
        const s = String(v).trim()
          .replace(/[€$£]/g, "")
          .replace(/\s/g, "");
        // Distingui decimale da migliaia: se l'ultimo separatore è , o . con 1-2 cifre dopo → decimale
        // Altrimenti → migliaia
        const normalized = s
          .replace(/\.(?=\d{3}(?:[.,]|$))/g, "")  // rimuovi . come migliaia (es. 91.347 → 91347)
          .replace(/,(?=\d{3}(?:[.,]|$))/g, "")    // rimuovi , come migliaia (es. 91,347 → 91347)
          .replace(",", ".");                         // converti virgola decimale
        const n = parseFloat(normalized);
        return isNaN(n) ? null : n;
      }

      const expNum = normalizeNum(expectedValue);
      const actNum = normalizeNum(best?.raw_value);
      const valueMatch = expNum !== null && actNum !== null && Math.abs(expNum - actNum) / Math.max(Math.abs(expNum), 1) < 0.01;
      const pageMatch = best ? (best.page === expectedPage || Math.abs(best.page - expectedPage) <= 1) : false;
      const yearMatch = best ? (best.year === expectedYear) : false;

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
        match: best != null && valueMatch && pageMatch && yearMatch
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
