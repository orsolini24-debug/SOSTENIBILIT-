import "dotenv/config";
import { db } from "@/db";
import { documents, documentChunks, projects, organizations } from "@/db/schema";
import { extract } from "./extract";

async function runMockTest() {
  console.log("Mocking data for e2e extraction test...");

  const [org] = await db.insert(organizations).values({ name: "E2E Org" }).onConflictDoNothing().returning();
  let orgId = org?.id;
  if (!orgId) {
     const orgs = await db.select().from(organizations).limit(1);
     orgId = orgs[0].id;
  }
  
  const [proj] = await db.insert(projects).values({ organizationId: orgId, name: "E2E Proj", year: 2026 }).onConflictDoNothing().returning();
  let projId = proj?.id;
  if (!projId) {
     const projs = await db.select().from(projects).limit(1);
     projId = projs[0].id;
  }

  // Creazione documento mock
  const [doc] = await db.insert(documents).values({
    projectId: projId,
    name: "bilancio_mock.pdf",
    type: "report",
    storagePath: "/mock",
    hash: "mock_e2e_hash",
    status: "completed"
  }).returning();

  // Creazione chunk mock per energia (VSME-B1)
  await db.insert(documentChunks).values({
    documentId: doc.id,
    page: 15,
    chunkIdx: 1,
    text: "Nel 2024 il consumo totale di energia elettrica è stato di 45000 kWh.",
    sourceHash: "mock_e2e_hash",
  });

  console.log(`Esecuzione extract() per VSME-B1 su doc: ${doc.id}`);
  
  try {
     const result = await extract(doc.id, "VSME-B1");
     console.log("Risultato:", JSON.stringify(result, null, 2));
  } catch (e) {
     console.error("Errore extract:", e);
  }
}

runMockTest().then(() => process.exit(0)).catch(() => process.exit(1));