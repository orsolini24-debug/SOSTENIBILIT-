import "dotenv/config";
import { generateBaseline } from '../services/baseline';
import { db } from '../db';
import { datapointValues, companies, projects, organizations, extractedFields, extractionRuns, documents } from '../db/schema';
import { eq } from 'drizzle-orm';
import { validateExtractedField } from '../services/validation';
import { AI_MODELS } from '../lib/model-config';

async function runTests() {
  console.log("Running Integrity Fixes Tests...");

  try {
    // 1. Baseline idempotente: nessuna duplicazione
    console.log("Test 1: Baseline idempotente...");
    const [org] = await db.insert(organizations).values({ name: 'Test Org' }).returning();
    const [comp] = await db.insert(companies).values({ organizationId: org.id, name: 'Test Comp' }).returning();
    const [proj] = await db.insert(projects).values({ organizationId: org.id, companyId: comp.id, name: 'Test Proj', year: 2026 }).returning();

    await generateBaseline(proj.id, comp.id);
    const count1 = await db.select().from(datapointValues).where(eq(datapointValues.projectId, proj.id));

    await generateBaseline(proj.id, comp.id);
    const count2 = await db.select().from(datapointValues).where(eq(datapointValues.projectId, proj.id));

    if (count1.length === 0 || count1.length !== count2.length) {
      throw new Error(`Test 1 Failed: Expected ${count1.length} === ${count2.length}`);
    }
    console.log("✅ Test 1 Passed.");

    // 2. Validazione anomalie: nessuna promozione errata
    console.log("Test 2: Validazione anomalie...");
    const [org2] = await db.insert(organizations).values({ name: 'Test Org 2' }).returning();
    const [comp2] = await db.insert(companies).values({ organizationId: org2.id, name: 'Test Comp 2', facilityArea: 100 }).returning();
    const [proj2] = await db.insert(projects).values({ organizationId: org2.id, companyId: comp2.id, name: 'Test Proj 2', year: 2026 }).returning();

    const [dpValue] = await db.insert(datapointValues).values({
      projectId: proj2.id,
      datapointId: 'VSME-B1',
      state: 'estimated',
      confidence: 'Bassa'
    }).returning();

    const [doc] = await db.insert(documents).values({ projectId: proj2.id, name: 'test.pdf', storagePath: 'test' }).returning();
    const [run] = await db.insert(extractionRuns).values({ documentId: doc.id, model: AI_MODELS.PARSER_MODEL }).returning();
    
    // Anomalia: 200.000 kWh per 100 mq (ratio = 2000 > 1000)
    const [field] = await db.insert(extractedFields).values({
      extractionRunId: run.id,
      datapointId: 'VSME-B1',
      fieldName: 'Energia',
      value: '200000',
    }).returning();

    const result = await validateExtractedField(proj2.id, dpValue.id, field.id);
    
    if (!result.anomaly || result.data?.state !== 'manual_review_required' || result.data?.confidence !== 'Bassa') {
      throw new Error(`Test 2 Failed: Expected anomaly and manual_review_required, got ${result.data?.state}`);
    }
    console.log("✅ Test 2 Passed.");

    // 3. Lineage modello
    console.log("Test 3: Lineage modello...");
    if (AI_MODELS.PARSER_MODEL !== "claude-sonnet-4-6") {
      throw new Error(`Test 3 Failed: Model is ${AI_MODELS.PARSER_MODEL} instead of claude-sonnet-4-6`);
    }
    console.log("✅ Test 3 Passed.");

  } catch (error) {
    console.error("❌ Test Failed:", error);
    process.exit(1);
  }

  console.log("All tests passed!");
  process.exit(0);
}

runTests();
