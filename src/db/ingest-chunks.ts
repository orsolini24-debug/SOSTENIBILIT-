import "dotenv/config";
import * as fs from "fs/promises";
import * as path from "path";
import * as readline from "readline";
import { db } from "./index";
import { documentChunks, documents, projects, organizations } from "./schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// Path to Codex export directory
const CHUNKS_EXPORT_DIR = path.resolve(__dirname, "../../../sustainchain_core/07_outputs/chunks_export");

export interface ChunkRecord {
  document_name: string;
  source_hash: string;
  page: number;
  chunk_idx: number;
  text: string;
  table_id?: string;
  bbox?: number[];
}

export interface Manifest {
  total_documents: number;
  total_chunks: number;
  document_stats: Record<string, number>;
}

export async function ingestChunks(exportDir: string = CHUNKS_EXPORT_DIR) {
  console.log(`Avvio ingestione chunks da: ${exportDir}`);
  
  // 1. Verifica esistenza directory e manifest
  try {
    await fs.access(exportDir);
  } catch {
    console.error(`Directory non trovata: ${exportDir}. I chunk non sono ancora stati generati da Codex.`);
    return null;
  }

  let manifest: Manifest | null = null;
  try {
    const manifestPath = path.join(exportDir, "manifest.json");
    const manifestData = await fs.readFile(manifestPath, "utf-8");
    manifest = JSON.parse(manifestData);
    console.log(`Manifest trovato: ${manifest?.total_documents} documenti, ${manifest?.total_chunks} chunks previsti.`);
  } catch {
    console.warn("Nessun manifest.json trovato. Procedo con la lettura diretta dei file jsonl.");
  }

  // Creazione progetto di default per i documenti ingeriti se non esiste
  const [org] = await db.insert(organizations).values({ name: "Default Org (Ingestion)" }).onConflictDoNothing().returning();
  let orgId = org?.id;
  if (!orgId) {
     const orgs = await db.select().from(organizations).limit(1);
     orgId = orgs[0].id;
  }
  const [proj] = await db.insert(projects).values({ organizationId: orgId, name: "Default Project (Ingestion)", year: 2026 }).onConflictDoNothing().returning();
  let projId = proj?.id;
  if (!projId) {
     const projs = await db.select().from(projects).limit(1);
     projId = projs[0].id;
  }

  const files = await fs.readdir(exportDir);
  const jsonlFiles = files.filter(f => f.endsWith(".jsonl"));
  
  const stats = {
    documents: new Set<string>(),
    chunksIngested: 0,
    errors: 0
  };

  for (const file of jsonlFiles) {
    console.log(`Elaborazione file: ${file}`);
    const filePath = path.join(exportDir, file);
    const fileStream = require("fs").createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const chunk: ChunkRecord = JSON.parse(line);
        if (!chunk.source_hash || chunk.page === undefined || chunk.text === undefined) {
           console.warn(`Chunk invalido (dati mancanti): ${line.substring(0,50)}...`);
           continue;
        }

        // Risolvi o crea Documento
        let docId = "";
        const existingDocs = await db.select({ id: documents.id }).from(documents).where(eq(documents.hash, chunk.source_hash)).limit(1);
        
        if (existingDocs.length > 0) {
          docId = existingDocs[0].id;
        } else {
          const [newDoc] = await db.insert(documents).values({
            projectId: projId,
            name: chunk.document_name || `doc_${chunk.source_hash.substring(0,8)}`,
            type: "report",
            storagePath: `/placeholder/${chunk.source_hash}`,
            hash: chunk.source_hash,
            status: "completed"
          }).returning();
          docId = newDoc.id;
        }
        stats.documents.add(docId);

        // Inserisci Chunk (Idempotente)
        await db.insert(documentChunks).values({
          documentId: docId,
          page: chunk.page,
          chunkIdx: chunk.chunk_idx || 0,
          text: chunk.text,
          sourceHash: chunk.source_hash,
          tableId: chunk.table_id || null,
          bbox: chunk.bbox ? (chunk.bbox as any) : null,
        }).onConflictDoUpdate({
          target: [documentChunks.sourceHash, documentChunks.page, documentChunks.chunkIdx],
          set: {
            text: chunk.text,
            tableId: chunk.table_id || null,
            bbox: chunk.bbox ? (chunk.bbox as any) : null,
          }
        });
        
        stats.chunksIngested++;

      } catch (err) {
        console.error(`Errore parsing o inserimento linea: ${err}`);
        stats.errors++;
      }
    }
  }

  console.log(`Ingestione completata. Documenti: ${stats.documents.size}, Chunks Inseriti/Aggiornati: ${stats.chunksIngested}, Errori: ${stats.errors}`);
  
  if (manifest) {
    console.log(`\n--- CONFRONTO MANIFEST ---`);
    console.log(`Documenti: Manifest=${manifest.total_documents} | DB=${stats.documents.size}`);
    console.log(`Chunks:    Manifest=${manifest.total_chunks} | DB=${stats.chunksIngested}`);
  }

  return { stats, manifest };
}

// Esecuzione stand-alone
if (require.main === module) {
  ingestChunks().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
