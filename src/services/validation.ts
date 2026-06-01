import { db } from "@/db";
import { datapointValues, evidenceLinks, auditEvents, validationEvents, companies, projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function validateDatapoint(
  datapointValueId: string, 
  extractedValue: string, 
  documentId: string, 
  pageReference: number, 
  userId: string,
  organizationId: string
) {
  // 1. Recupera il record precedente (per l'audit e per sapere che datapoint è)
  const oldValue = await db.query.datapointValues.findFirst({
    where: eq(datapointValues.id, datapointValueId)
  });

  if (!oldValue) throw new Error("Datapoint Value non trovato");

  // 1b. Anomaly Detection: Controllo logico di base (es. consumi vs cubatura)
  // Recuperiamo l'azienda collegata al progetto
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, oldValue.projectId!)
  });
  
  if (project && project.companyId) {
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, project.companyId)
    });

    if (company && oldValue.datapointId === "VSME-B1") {
       const numericValue = parseFloat(extractedValue);
       const area = company.facilityArea || 0;
       if (area > 0 && numericValue > 0) {
          const ratio = numericValue / area;
          // Un rapporto anomalo (> 1000 kWh/mq) potrebbe indicare un errore di estrazione o unità (es. Wh invece di kWh)
          if (ratio > 1000) {
             console.warn(`[Anomaly] Rapporto kWh/mq troppo alto (${ratio}). Possibile errore OCR.`);
             // In una versione più evoluta, potremmo passare a 'Pending Review' invece di 'Validato'
             // o restituire un alert alla UI.
          }
       }
    }
  }

  // 2. Aggiorna il record a "manually_validated"
  const [updatedValue] = await db.update(datapointValues).set({
    value: extractedValue,
    state: "manually_validated",
    confidence: "Alta",
    sourceDocumentId: documentId,
    updatedAt: new Date(),
  }).where(eq(datapointValues.id, datapointValueId)).returning();

  // 3. Crea il link probatorio (Evidence Link)
  await db.insert(evidenceLinks).values({
    datapointValueId: updatedValue.id,
    documentId: documentId,
    pageReference: pageReference,
  });

  // 4. Registra l'evento logico di Validazione
  await db.insert(validationEvents).values({
    datapointValueId: updatedValue.id,
    userId: userId,
    action: "approved",
    previousState: oldValue.state as any,
    newState: "manually_validated",
    reason: "Approvazione utente dopo estrazione documentale",
  });

  // 5. Scrivi l'Audit Trail Immutabile
  await db.insert(auditEvents).values({
    organizationId: organizationId,
    projectId: updatedValue.projectId!,
    entityType: "datapoint_value",
    entityId: updatedValue.id,
    action: "validate_from_extraction",
    oldValue: oldValue,
    newValue: updatedValue,
    metadata: { sourceDocumentId: documentId, pageReference }
  });

  return { success: true, data: updatedValue };
}
