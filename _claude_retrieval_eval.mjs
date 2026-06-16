import { config } from "dotenv"; config({ path: ".env" });
import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const sql = neon(process.env.DATABASE_URL);
const GT_FILE = path.resolve("..", "eval/ground_truth_v2.csv");
const OUTPUT_FILE = path.resolve("..", "eval/retrieval_eval_report_phase8.md");

// Sinonimi per disclosure — v2 aggiornato 2026-06-13 (ciclo 2 failure analysis)
const DISCLOSURE_TEMPLATES = {
  "VSME-B1": ["energia", "consumo elettrico", "consumo totale di energia", "total energy consumption", "elettricita", "kwh", "mwh"],
  "VSME-B2-S1": ["scope 1", "emissioni dirette", "ghg", "gas serra", "co2", "riscaldamento", "flotta", "veicoli"],
  "VSME-B2-S2": ["scope 2", "emissioni indirette", "location based", "market based", "energia acquistata"],
  "VSME-B2-S2-LB": ["scope 2", "emissioni indirette", "location based", "energia acquistata"],
  "VSME-B2-S2-MB": ["scope 2", "emissioni indirette", "market based", "energia acquistata"],
  "VSME-B3": ["acqua", "prelievo idrico", "consumo idrico", "water withdrawal", "m3", "litri"],
  "VSME-B4": ["rifiuti", "waste", "tonnellate", "kg", "pericolosi", "smaltimento"],
  "VSME-B5": ["dipendenti", "addetti", "personale", "risorse umane", "hr", "headcount", "employees"],
  "scope_1_ghg_emissions": [
    "scope 1", "emissioni dirette", "ghg", "gas serra", "co2",
    "scope 1 emissions", "direct emissions",
    "emissioni dirette scope 1", "gross scope 1", "gross direct ghg",
    "gas a effetto serra", "greenhouse gas protocol", "emissioni ghg scope 1"
  ],
  "scope_2_location_based_ghg_emissions": [
    "scope 2", "location based", "location-based", "emissioni indirette", "energia acquistata",
    "location based methodology", "gross scope 2 location", "scope 2 lb"
  ],
  "scope_2_market_based_ghg_emissions": [
    "scope 2", "market based", "market-based", "emissioni indirette", "energia acquistata",
    "market based methodology", "gross scope 2 market", "scope 2 mb"
  ],
  "scope_3_total_ghg_emissions": [
    "scope 3", "emissioni indirette", "value chain", "catena del valore", "scope 3 emissions",
    "total gross indirect", "total gross indirect ghg", "gross scope 3",
    "total gross indirect scope 3", "indirect ghg emissions scope 3",
    "emissioni indirette scope 3", "totale emissioni indirette scope 3",
    "total indirect ghg emissions"
  ],
  "total_energy_consumption": [
    "energia", "consumo totale di energia", "total energy consumption", "consumo energetico",
    "kwh", "mwh", "gigajoule", "gj", "consumo totale energia", "total energy", "energia totale"
  ],
};

async function retrieveChunks(documentId, disclosureId, topK = 10) {
  const synonyms = DISCLOSURE_TEMPLATES[disclosureId] || [`"${disclosureId}"`];
  const tsQueryStr = synonyms.map(s => `"${s}"`).join(" OR ");

  const rows = await sql`
    WITH search_query AS (
      SELECT websearch_to_tsquery('italian', ${tsQueryStr}) AS q_it,
             websearch_to_tsquery('english', ${tsQueryStr}) AS q_en
    )
    SELECT
      id,
      chunk_idx,
      page,
      text,
      (ts_rank_cd(to_tsvector('italian', text), (SELECT q_it FROM search_query)) +
       ts_rank_cd(to_tsvector('english', text), (SELECT q_en FROM search_query))) AS score
    FROM document_chunks
    WHERE document_id = ${documentId}
      AND (
        to_tsvector('italian', text) @@ (SELECT q_it FROM search_query) OR
        to_tsvector('english', text) @@ (SELECT q_en FROM search_query)
      )
    ORDER BY score DESC
    LIMIT ${topK}
  `;
  return rows;
}

async function main() {
  console.log("=== SustainChain Retrieval Eval v2 — Phase 8 sinonimi aggiornati ===");

  const csvContent = fs.readFileSync(GT_FILE, "utf-8");
  const gtData = parse(csvContent, { columns: true, skip_empty_lines: true });

  const verified = gtData.filter(r => r.status === "verified" || r.status === "rebuilt");
  console.log(`GT rows verified/rebuilt: ${verified.length}`);

  const docs = await sql`
    SELECT d.id, d.name, COUNT(dc.id)::int as chunk_count
    FROM documents d
    JOIN document_chunks dc ON dc.document_id = d.id
    GROUP BY d.id, d.name
    HAVING COUNT(dc.id) > 0
  `;
  console.log(`Documents with chunks in DB: ${docs.length}`);

  const stemToDoc = new Map();
  for (const d of docs) {
    const stem = d.name.replace(/\.pdf$/i, "").toLowerCase();
    stemToDoc.set(stem, d.id);
    stemToDoc.set(d.name.toLowerCase(), d.id);
  }

  const docCache = new Map();

  let totalQueries = 0;
  let hitsAt5 = 0;
  let hitsAt10 = 0;
  let mrrSum = 0;
  let skipped = 0;
  const failureCases = [];
  const successCases = [];

  for (const row of verified) {
    const sourceFile = row.source_file || row.document_name || row.document_id;
    const expectedPage = parseInt(row.page_number, 10);
    const disclosureId = row.disclosure_id;

    if (!sourceFile || isNaN(expectedPage) || !disclosureId) {
      skipped++;
      continue;
    }

    let documentId = docCache.get(sourceFile);
    if (!documentId) {
      const sourceStem = sourceFile.replace(/\.pdf$/i, "").toLowerCase();
      documentId = stemToDoc.get(sourceStem) || stemToDoc.get(sourceFile.toLowerCase());
      if (documentId) docCache.set(sourceFile, documentId);
    }

    if (!documentId) {
      console.log(`  SKIP (no doc match): ${sourceFile}`);
      skipped++;
      continue;
    }

    totalQueries++;
    const chunks = await retrieveChunks(documentId, disclosureId, 10);

    let rank = -1;
    for (let i = 0; i < chunks.length; i++) {
      if (Number(chunks[i].page) === expectedPage) {
        rank = i + 1;
        break;
      }
    }

    if (rank > 0 && rank <= 5) hitsAt5++;
    if (rank > 0 && rank <= 10) hitsAt10++;
    if (rank > 0) {
      mrrSum += 1.0 / rank;
      successCases.push({ id: row.ground_truth_id, disc: disclosureId, page: expectedPage, rank });
    } else {
      const top3Pages = chunks.slice(0, 3).map(c => c.page).join(", ");
      failureCases.push({
        id: row.ground_truth_id,
        disc: disclosureId,
        company: row.company_name,
        sourceFile: sourceFile.slice(0, 40),
        expectedPage,
        chunksReturned: chunks.length,
        top3Pages: top3Pages || "none"
      });
    }
  }

  if (totalQueries === 0) {
    console.error("ERRORE: 0 query eseguite.");
    process.exit(1);
  }

  const recall5 = (hitsAt5 / totalQueries) * 100;
  const recall10 = (hitsAt10 / totalQueries) * 100;
  const mrr = mrrSum / totalQueries;

  console.log(`\n=== RISULTATI v2 ===`);
  console.log(`Queries eseguite: ${totalQueries} (skipped: ${skipped})`);
  console.log(`Recall@5:  ${recall5.toFixed(2)}%  (${hitsAt5}/${totalQueries})`);
  console.log(`Recall@10: ${recall10.toFixed(2)}%  (${hitsAt10}/${totalQueries})`);
  console.log(`MRR:       ${mrr.toFixed(3)}`);
  console.log(`Gate 90%:  ${recall10 >= 90 ? "PASS" : "FAIL"}`);

  const discStats = {};
  for (const r of verified) {
    if (!r.disclosure_id) continue;
    if (!discStats[r.disclosure_id]) discStats[r.disclosure_id] = { total: 0, hit: 0 };
    discStats[r.disclosure_id].total++;
    if (successCases.some(s => s.id === r.ground_truth_id)) discStats[r.disclosure_id].hit++;
  }
  const discLines = Object.entries(discStats)
    .map(([d, s]) => "- **" + d + "**: " + ((s.hit/s.total)*100).toFixed(0) + "% (" + s.hit + "/" + s.total + ")")
    .join("\n");

  const failLines = failureCases.length === 0
    ? "Nessun fallimento."
    : failureCases.map(f =>
        "- [" + f.id + "] " + f.disc + " | " + f.company + " | p." + f.expectedPage + " | returned:" + f.chunksReturned + " | top3:" + f.top3Pages
      ).join("\n");

  const rankLines = [1,2,3,4,5,6,7,8,9,10].map(r =>
    "- rank=" + r + ": " + successCases.filter(s => s.rank === r).length
  ).join("\n");

  const gateStr = recall10 >= 90 ? "PASS" : "FAIL";
  const lines = [
    "# Phase 8 - Retrieval Evaluation Report (sinonimi v2)",
    "*Generato: " + new Date().toISOString() + "*",
    "",
    "## Metriche Globali",
    "| Metrica | Valore | Gate |",
    "|---|---|---|",
    "| Total Queries | " + totalQueries + " | - |",
    "| Recall@5 | " + recall5.toFixed(2) + "% | - |",
    "| Recall@10 | " + recall10.toFixed(2) + "% | >= 90% |",
    "| MRR | " + mrr.toFixed(3) + " | - |",
    "| Gate G2.1 | " + gateStr + " | - |",
    "",
    "Skipped (no doc match): " + skipped,
    "",
    "## Recall@10 per Disclosure",
    discLines,
    "",
    "## Fallimenti Recall@10 (" + failureCases.length + " casi)",
    failLines,
    "",
    "## Distribuzione rank (successi)",
    rankLines,
    "",
    "*Eval su GT v2: " + verified.length + " righe verified/rebuilt, " + totalQueries + " con documento in DB*"
  ];
  const report = lines.join("\n");

  fs.writeFileSync(OUTPUT_FILE, report);
  console.log(`\nReport salvato: eval/retrieval_eval_report_phase8.md`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
