"use server";

import { db } from "@/db";
import { documents, extractionRuns, extractedFields, datapointValues, auditEvents } from "@/db/schema";
import { put } from "@vercel/blob";
import { parseDocument } from "@/services/document-parser";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

export async function uploadAndParseDocument(projectId: string, formData: FormData) {
  // Utilizziamo require all'interno della funzione per evitare problemi durante il build statico
  const pdf = require("pdf-parse");
  
  const file = formData.get("file") as File;
  const documentType = formData.get("type") as "bolletta" | "hr" | "rifiuti";

  if (!file) {
    throw new Error("Nessun file caricato");
  }

  // 1. Upload su Vercel Blob (o simulazione locale se manca token)
  let storagePath = "";
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(file.name, file, { access: "public" });
    storagePath = blob.url;
  } else {
    // Simulazione locale
    storagePath = `/temp-storage/${file.name}`;
    console.log("Simulazione upload locale:", storagePath);
  }

  // 2. Crea record Documento
  const [doc] = await db.insert(documents).values({
    projectId,
    name: file.name,
    type: documentType,
    storagePath,
    status: "processing",
  }).returning();

  // 3. Estrazione testo dal PDF
  const buffer = Buffer.from(await file.arrayBuffer());
  const data = await pdf(buffer);
  const text = data.text;

  // 4. Esecuzione Parsing AI
  const [run] = await db.insert(extractionRuns).values({
    documentId: doc.id,
    model: "claude-3-5-sonnet", // o quello configurato in parser.ts
    status: "running",
  }).returning();

  try {
    const fields = await parseDocument(text, documentType);

    // 5. Salva i campi estratti
    for (const field of fields) {
      await db.insert(extractedFields).values({
        extractionRunId: run.id,
        datapointId: field.datapointId,
        fieldName: field.field,
        value: field.value,
        confidence: field.confidence,
        pageReference: field.page,
        sourceSnippet: field.sourceSnippet,
      });
    }

    await db.update(extractionRuns).set({ status: "completed", result: { fields } }).where(eq(extractionRuns.id, run.id));
    await db.update(documents).set({ status: "completed" }).where(eq(documents.id, doc.id));

    revalidatePath(`/dashboard/${projectId}`);
    return { success: true, docId: doc.id };
  } catch (error: any) {
    console.error("Errore durante il parsing:", error);
    await db.update(extractionRuns).set({ status: "failed", result: { error: error.message } }).where(eq(extractionRuns.id, run.id));
    await db.update(documents).set({ status: "error" }).where(eq(documents.id, doc.id));
    throw error;
  }
}

export async function validateDatapoint(projectId: string, datapointValueId: string, extractedFieldId: string) {
  // 1. Recupera il campo estratto
  const field = await db.query.extractedFields.findFirst({
    where: (ef, { eq }) => eq(ef.id, extractedFieldId),
  });

  if (!field) throw new Error("Campo estratto non trovato");

  // 2. Recupera il valore attuale del datapoint (la stima)
  const [oldValue] = await db.select().from(datapointValues).where(eq(datapointValues.id, datapointValueId));

  // 3. Aggiorna con il dato reale
  const [newValue] = await db.update(datapointValues).set({
    value: field.value,
    state: "manually_validated",
    confidence: "Alta", // O mappato dal campo
    updatedAt: new Date(),
  }).where(eq(datapointValues.id, datapointValueId)).returning();

  // 4. Registra evento di validazione/audit
  await db.insert(auditEvents).values({
    projectId,
    entityType: "datapoint_value",
    entityId: datapointValueId,
    action: "validate_from_extraction",
    oldValue: oldValue,
    newValue: newValue,
    metadata: { extractedFieldId, source: "AI Extraction" }
  });

  revalidatePath(`/dashboard/${projectId}`);
  return { success: true };
}
