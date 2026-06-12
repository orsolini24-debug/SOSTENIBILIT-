import { db } from "@/db";
import {
  datapointValues,
  evidenceLinks,
  auditEvents,
  validationEvents,
  companies,
  projects,
  extractedFields,
  extractionRuns,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ValidateResult {
  success: boolean;
  anomaly?: string;
  data?: typeof datapointValues.$inferSelect;
}

/**
 * Fonte di verita UNICA per la validazione di un datapoint a partire da un campo
 * estratto dall'AI. Promuove la stima ("estimated") a "manually_validated" e scrive
 * l'intero lineage: evidence_link + validation_event + audit_event. Applica anche i
 * sanity-check settoriali (es. consumi elettrici vs superficie).
 *
 * Tutto (valore, documento, pagina) viene derivato da extractedFieldId, cosi i diversi
 * punti della UI non devono ripetere la logica. userId e opzionale finche l'auth e mock.
 */
export async function validateExtractedField(
  projectId: string,
  datapointValueId: string,
  extractedFieldId: string,
  userId: string | null = null,
): Promise<ValidateResult> {
  // 1. Campo estratto (valore reale + pagina + run di estrazione)
  const [field] = await db
    .select()
    .from(extractedFields)
    .where(eq(extractedFields.id, extractedFieldId))
    .limit(1);
  if (!field) throw new Error("Campo estratto non trovato");

  // 2. Documento di origine (via extraction run) -> lineage probatorio
  let documentId: string | null = null;
  if (field.extractionRunId) {
    const [run] = await db
      .select({ documentId: extractionRuns.documentId })
      .from(extractionRuns)
      .where(eq(extractionRuns.id, field.extractionRunId))
      .limit(1);
    documentId = run?.documentId ?? null;
  }

  // 3. Valore precedente (la stima) - necessario per audit e transizione di stato
  const [oldValue] = await db
    .select()
    .from(datapointValues)
    .where(eq(datapointValues.id, datapointValueId))
    .limit(1);
  if (!oldValue) throw new Error("Datapoint Value non trovato");

  // 4. Contesto progetto/azienda (organizationId + dati per i sanity-check)
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const organizationId = project?.organizationId ?? null;

  // 4b. Sanity-check settoriale: rapporto consumi elettrici / superficie
  let anomaly: string | undefined;
  if (project?.companyId && oldValue.datapointId === "VSME-B1") {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, project.companyId))
      .limit(1);
    const area = company?.facilityArea ?? 0;
    const numericValue = parseFloat(field.value ?? "");
    if (area > 0 && numericValue > 0) {
      const ratio = numericValue / area;
      if (ratio > 1000) {
        anomaly = `Rapporto kWh/mq anomalo (${Math.round(ratio)}). Possibile errore di unita (Wh vs kWh) o OCR.`;
        console.warn(`[Anomaly] ${anomaly}`);
      }
    }
  }

  // 5. Promozione del datapoint
  // P0 Fix: Se c'Ã¨ un'anomalia, lo stato deve essere "manual_review_required" e la confidenza Bassa.
  const targetState = anomaly ? "manual_review_required" : "manually_validated";
  const targetConfidence = anomaly ? "Bassa" : "Alta";

  const [newValue] = await db
    .update(datapointValues)
    .set({
      value: field.value,
      state: targetState,
      confidence: targetConfidence,
      sourceDocumentId: documentId,
      updatedAt: new Date(),
    })
    .where(eq(datapointValues.id, datapointValueId))
    .returning();

  // 6. Evidence link (collega il dato alla pagina del documento)
  if (documentId) {
    await db.insert(evidenceLinks).values({
      datapointValueId: newValue.id,
      documentId,
      pageReference: field.pageReference ?? null,
    });
  }

  // 7. Evento di validazione (userId nullable finche l'auth e mock)
  await db.insert(validationEvents).values({
    datapointValueId: newValue.id,
    userId,
    action: anomaly ? "flagged_anomaly" : "approved",
    previousState: oldValue.state,
    newState: targetState,
    reason: anomaly ? `Anomalia rilevata: ${anomaly}` : "Approvazione utente dopo estrazione documentale",
  });

  // 8. Audit trail immutabile
  await db.insert(auditEvents).values({
    organizationId,
    projectId,
    entityType: "datapoint_value",
    entityId: newValue.id,
    action: "validate_from_extraction",
    oldValue,
    newValue,
    metadata: {
      extractedFieldId,
      documentId,
      pageReference: field.pageReference,
      anomaly: anomaly ?? null,
    },
  });

  return { success: true, anomaly, data: newValue };
}
