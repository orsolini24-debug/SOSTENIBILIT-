/**
 * Targeted ingest: solo i 7 JSONL PMI mancanti. Batch da 30 per ridurre round-trips.
 * Eseguire: npx tsx ingest_missing.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import readline from "readline";
import { db } from "./src/db/index";
import { documentChunks, documents, projects } from "./src/db/schema";
import { eq } from "drizzle-orm";

const CHUNKS_DIR = path.resolve(__dirname, "../sustainchain_core/07_outputs/chunks_export");
const MISSING = [
  "29_NHABI_Relazione_Impatto_2024.jsonl",
  "30_Sartoria_Litrico_Bilancio_Sostenibilita_2024.jsonl",
  "31_Agugiaro_Figna_Report_Sostenibilita_2024.jsonl",
  "32_Bianchi_Costruzioni_Bilancio_Sostenibilita_2024.jsonl",
  "33_Simonelli_Group_Report_Sostenibilita_2024.jsonl",
  "34_Casa_Optima_Bilancio_Sostenibilita_2024.jsonl",
  "36_De_Wave_Group_Sustainability_Report_2024.jsonl",
];

async function readJsonl(filePath: string): Promise<any[]> {
  const lines: any[] = [];
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const l of rl) { if (l.trim()) lines.push(JSON.parse(l)); }
  return lines;
}

async function main() {
  const projs = await db.select({ id: projects.id }).from(projects).limit(1);
  const projId = projs[0]?.id;
  if (!projId) throw new Error("No project found");

  for (const file of MISSING) {
    const fp = path.join(CHUNKS_DIR, file);
    const chunks = await readJsonl(fp);
    if (!chunks.length) { console.log(`${file}: 0 chunks, skip`); continue; }

    const hash = chunks[0].source_hash;
    const docName = chunks[0].document_name;

    // Crea o recupera documento
    let docId: string;
    const ex = await db.select({ id: documents.id }).from(documents).where(eq(documents.hash, hash)).limit(1);
    if (ex.length) {
      docId = ex[0].id;
      console.log(`${file}: doc già presente (${docId.slice(0,8)}...)`);
    } else {
      const [nd] = await db.insert(documents).values({
        projectId: projId, name: docName, type: "report",
        storagePath: `/placeholder/${hash}`, hash, status: "completed",
      }).returning({ id: documents.id });
      docId = nd.id;
      console.log(`${file}: doc creato (${docId.slice(0,8)}...)`);
    }

    // Batch insert chunks (30 per volta)
    let n = 0;
    for (let i = 0; i < chunks.length; i += 30) {
      const batch = chunks.slice(i, i + 30).map((c: any) => ({
        documentId: docId, page: c.page, chunkIdx: c.chunk_idx ?? 0,
        text: c.text, sourceHash: c.source_hash,
        tableId: c.table_id ?? null, bbox: c.bbox ?? null,
      }));
      await db.insert(documentChunks).values(batch).onConflictDoUpdate({
        target: [documentChunks.sourceHash, documentChunks.page, documentChunks.chunkIdx],
        set: { text: batch[0].text },
      });
      n += batch.length;
    }
    console.log(`  → ${n} chunks inseriti`);
  }

  console.log("=== INGEST COMPLETATO ===");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
