/**
 * Test end-to-end: retrieval + LLM extraction + DB save
 * Testa Alimenta Produzioni (09_...) su total_energy_consumption
 * Eseguire: npx tsx test_extract_e2e.ts
 */
import "dotenv/config";
import { db } from "./src/db/index";
import { documents, extractionCandidates, extractionRuns } from "./src/db/schema";
import { eq, sql } from "drizzle-orm";
import { extract } from "./src/services/extraction/extract";

async function main() {
  // 1. Trova documento Alimenta Produzioni
  const docs = await db
    .select({ id: documents.id, name: documents.name, hash: documents.hash })
    .from(documents)
    .where(eq(documents.hash, "0bb80f98a0c3e799fa8715a4dc65505f448340a89493e749ffaee82f671e5f7f"))
    .limit(1);

  if (!docs.length) {
    console.error("❌ Alimenta Produzioni non trovata nel DB");
    process.exit(1);
  }
  const doc = docs[0];
  console.log(`✅ Documento trovato: ${doc.name} (${doc.id.slice(0,8)}...)`);

  // 2. Conta chunks disponibili
  const chunkCount = await db.execute(
    sql`SELECT COUNT(*) as n FROM document_chunks WHERE document_id = ${doc.id}`
  );
  console.log(`   Chunks nel DB: ${(chunkCount as any).rows[0].n}`);

  // 3. Esegui estrazione
  console.log("\n🔄 Eseguendo estrazione total_energy_consumption...");
  const result = await extract(doc.id, "total_energy_consumption");

  console.log(`\n📊 RISULTATO ESTRAZIONE:`);
  console.log(`   extraction_run_id: ${result.extraction_run_id}`);
  console.log(`   status: ${result.status}`);
  console.log(`   candidati: ${result.candidates.length}`);
  if (result.errors?.length) console.log(`   errori: ${result.errors.join(", ")}`);

  if (result.candidates.length > 0) {
    const best = result.candidates[0];
    console.log(`\n   Miglior candidato:`);
    console.log(`     raw_value: ${best.raw_value}`);
    console.log(`     normalized: ${best.normalized_value}`);
    console.log(`     unit: ${best.unit_raw}`);
    console.log(`     confidence: ${best.confidence}`);
    console.log(`     page: ${best.page}`);
    console.log(`     evidence: ${best.evidence_text?.slice(0, 120)}...`);
  }

  // 4. Verifica DB
  const savedRun = await db
    .select({ id: extractionRuns.id, status: extractionRuns.status })
    .from(extractionRuns)
    .where(eq(extractionRuns.id, result.extraction_run_id))
    .limit(1);

  const savedCandidates = await db
    .select({ id: extractionCandidates.id, rawValue: extractionCandidates.rawValue })
    .from(extractionCandidates)
    .where(eq(extractionCandidates.extractionRunId, result.extraction_run_id));

  console.log(`\n✅ DB VERIFICATION:`);
  console.log(`   extraction_run row: ${savedRun.length > 0 ? "TROVATA ✅" : "MANCANTE ❌"} (status=${savedRun[0]?.status})`);
  console.log(`   extraction_candidates: ${savedCandidates.length} rows ${savedCandidates.length > 0 ? "✅" : "❌"}`);
  if (savedCandidates.length > 0) {
    console.log(`   raw_value in DB: ${savedCandidates[0].rawValue}`);
  }

  if (savedRun.length > 0 && savedCandidates.length > 0) {
    console.log("\n🎉 PIPELINE END-TO-END: OK");
  } else {
    console.log("\n❌ PIPELINE END-TO-END: FALLITA");
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error("FATAL:", e); process.exit(1); });
