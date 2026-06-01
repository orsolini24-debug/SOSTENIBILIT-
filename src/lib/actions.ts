"use server";

import { db } from "@/db";
import { documents, extractionRuns, extractedFields } from "@/db/schema";
import { put } from "@vercel/blob";
import { parseDocument } from "@/services/document-parser";
import { validateExtractedField } from "@/services/validation";
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
  // Delega alla fonte di verità unica (services/validation.ts): scrive evidence_link,
  // validation_event e audit_event e applica i sanity-check settoriali.
  const result = await validateExtractedField(projectId, datapointValueId, extractedFieldId);
  revalidatePath(`/dashboard/${projectId}`);
  return { success: true, anomaly: result.anomaly };
}
