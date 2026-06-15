import "dotenv/config";
import * as fs from "fs/promises";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { extract } from "./extract";
import { db } from "@/db";
import { sql } from "drizzle-orm";

const GT_FILE = path.resolve(__dirname, "../../../../eval/ground_truth_v2.csv");
const TODAY = new Date().toISOString().slice(0, 10);
const OUTPUT_FILE = path.resolve(__dirname, "../../../../eval/extract_e2e_" + TODAY + ".md");
const PROGRESS_FILE = path.resolve(__dirname, "../../../../eval/extract_e2e_" + TODAY + "_progress.jsonl");

export async function runE2EEval(batchSize: number = 999) {
  console.log("E2E Measurement su GT v2 (batchSize=" + batchSize + ")...");

  const hasApiKey = process.env.GROQ_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!hasApiKey) { console.error("ERRORE: nessuna chiave API."); process.exit(1); }

  let gtData: any[];
  try {
    const csvContent = await fs.readFile(GT_FILE, "utf-8");
    gtData = parse(csvContent, { columns: true, skip_empty_lines: true });
  } catch (e) { console.error("Cannot read GT: " + GT_FILE); return; }

  const validRows = gtData.filter((r: any) => r.status === "verified" || r.status === "rebuilt");
  console.log("Righe GT valide: " + validRows.length);

  // Carica progress esistente (resume support)
  const done = new Map<string, any>();
  try {
    const lines = (await fs.readFile(PROGRESS_FILE, "utf-8")).trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const e = JSON.parse(line);
      done.set(e.disclosureId + "|" + e.sourceFile, e);
    }
    console.log("Gia processate: " + done.size + "/" + validRows.length);
  } catch { await fs.writeFile(PROGRESS_FILE, ""); }

  const remaining = validRows.filter((r: any) => {
    const prev = done.get(r.disclosure_id + "|" + r.source_file);
    return !prev || prev.status === "Exception"; // retry Exception rows
  });
  console.log("Da processare ora: " + Math.min(batchSize, remaining.length) + " (di " + remaining.length + " rimanenti)");

  const docCache = new Map<string, string>();
  let processed = 0;

  function normalizeNum(v: any): number | null {
    if (v == null || v === "N/A") return null;
    const s = String(v).trim().replace(/[€$£]/g,"").replace(/\s/g,"").replace(/[a-zA-Z%°\/]+.*$/,"");
    const normalized = s
      .replace(/\.(?=\d{3}(?:[.,]|$))/g, "")
      .replace(/,(?=\d{3}(?:[.,]|$))/g, "")
      .replace(",", ".");
    const n = parseFloat(normalized);
    return isNaN(n) ? null : n;
  }

  for (const row of remaining) {
    if (processed >= batchSize) break;
    const sourceFile: string = row.source_file;
    const disclosureId: string = row.disclosure_id;
    const expectedValue: string = row.expected_value;
    const expectedPage: number = parseInt(row.page_number, 10);
    const expectedYear: number = parseInt(row.year, 10) || 2024;

    let documentId = docCache.get(sourceFile);
    if (!documentId) {
      // 1. Try exact match first (case-insensitive) to avoid stem collision
      //    e.g. "report_2024_ita" stem matches AQUAFIL_SUST-REPORT_2024_ITA incorrectly
      const exactRows = await db.execute(sql`
        SELECT d.id, d.name, COUNT(dc.id)::int as chunk_count
        FROM documents d LEFT JOIN document_chunks dc ON dc.document_id = d.id
        WHERE LOWER(d.name) = LOWER(${sourceFile})
        GROUP BY d.id, d.name ORDER BY chunk_count DESC LIMIT 1
      `);
      const exactMatch = (exactRows as any).rows?.[0] ?? (exactRows as any)[0];
      if (exactMatch && Number(exactMatch.chunk_count) > 0) {
        documentId = exactMatch.id as string;
        console.log("  [DOC] exact match: " + exactMatch.name + " (" + exactMatch.chunk_count + " chunks)");
      } else {
        // 2. Fallback to stem ILIKE (handles name truncation / slight variations)
        const stem = sourceFile.replace(/\.pdf$/i, "").substring(0, 20);
        const stemRows = await db.execute(sql`
          SELECT d.id, d.name, COUNT(dc.id)::int as chunk_count
          FROM documents d LEFT JOIN document_chunks dc ON dc.document_id = d.id
          WHERE d.name ILIKE ${"%" + stem + "%"}
          GROUP BY d.id, d.name ORDER BY chunk_count DESC LIMIT 1
        `);
        const stemMatch = (stemRows as any).rows?.[0] ?? (stemRows as any)[0];
        if (stemMatch && Number(stemMatch.chunk_count) > 0) {
          documentId = stemMatch.id as string;
          console.log("  [DOC] stem fallback: " + stemMatch.name + " (" + stemMatch.chunk_count + " chunks)");
        }
      }
      if (documentId) docCache.set(sourceFile, documentId);
    }
    if (!documentId) { console.warn("MISSING DOC: " + sourceFile); continue; }

    console.log("[" + (done.size + processed + 1) + "/" + validRows.length + "] " + disclosureId + " / " + sourceFile.substring(0, 30));
    try {
      const extResult = await extract(documentId, disclosureId);
      const best = extResult.candidates.length > 0 ? extResult.candidates[0] : null;
      const expNum = normalizeNum(expectedValue);
      const actNum = normalizeNum(best?.raw_value);
      const valueMatch = expNum !== null && actNum !== null && Math.abs(expNum - actNum) / Math.max(Math.abs(expNum), 1) < 0.01;
      const pageMatch = best ? (best.page === expectedPage || Math.abs(best.page - expectedPage) <= 1) : false;
      const yearMatch = best ? (best.year === expectedYear) : false;
      const isMatch = best != null && valueMatch && pageMatch && yearMatch;
      const entry = {
        disclosureId, sourceFile, expectedValue, expectedPage, expectedYear,
        actualValue: best ? best.raw_value : "N/A",
        actualPage: best ? best.page : "N/A",
        actualYear: best ? best.year : "N/A",
        status: best ? "Extracted" : "No candidates",
        match: isMatch
      };
      await fs.appendFile(PROGRESS_FILE, JSON.stringify(entry) + "\n");
      done.set(disclosureId + "|" + sourceFile, entry);
      console.log("  -> " + (isMatch ? "OK" : "FAIL") + " exp=" + expectedValue + " act=" + entry.actualValue);
      processed++;
      await new Promise(r => setTimeout(r, 2500)); // rate limit Groq: 30 RPM
    } catch (e) {
      console.error("  ERROR: " + String(e).substring(0, 100));
      const entry = {
        disclosureId, sourceFile, expectedValue, expectedPage, expectedYear,
        actualValue: "ERROR", actualPage: "ERROR", actualYear: "ERROR",
        status: "Exception", match: false
      };
      await fs.appendFile(PROGRESS_FILE, JSON.stringify(entry) + "\n");
      done.set(disclosureId + "|" + sourceFile, entry);
      processed++;
      await new Promise(r => setTimeout(r, 2500)); // rate limit Groq
    }
  }

  // Rigenera report markdown da tutto il progress
  const allResults = Array.from(done.values());
  const matches = allResults.filter((r: any) => r.match).length;
  const total = allResults.length;
  const pct = total > 0 ? ((matches / total) * 100).toFixed(2) : "0";
  const tableRows = allResults.map((r: any) => {
    return "| " + r.disclosureId + " | " + r.sourceFile + " | " + r.expectedValue + ", p." + r.expectedPage + ", " + r.expectedYear +
      " | " + r.actualValue + ", p." + r.actualPage + ", " + r.actualYear + " | " + r.status + " | " + (r.match ? "OK" : "FAIL") + " |";
  }).join("\n");
  const md =
    "# Phase 8 - E2E Extraction Evaluation\n\n" +
    "## Metriche (" + total + "/" + validRows.length + " completate)\n" +
    "- **Perfect Matches**: " + matches + " (" + pct + "%)\n\n" +
    "## Risultati\n\n" +
    "| Disclosure | Source File | Expected | Actual | Status | Match |\n" +
    "|---|---|---|---|---|---|\n" +
    tableRows + "\n\n*Generato da eval-e2e.ts*\n";
  await fs.writeFile(OUTPUT_FILE, md);
  console.log("Salvato: " + OUTPUT_FILE);
  console.log("STATO: " + total + "/" + validRows.length + " righe processate, " + matches + " match (" + pct + "%)");
}

if (require.main === module) {
  const batchSize = parseInt(process.env.EVAL_BATCH || "3", 10);
  runE2EEval(batchSize).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
