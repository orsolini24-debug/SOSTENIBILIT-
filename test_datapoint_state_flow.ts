/**
 * test_datapoint_state_flow.ts
 * ─────────────────────────────────────────────────────────────
 * Verifica end-to-end che NESSUNO stato italiano sopravviva
 * nel DB né venga prodotto dalla pipeline di codice.
 *
 * Esecuzione: npx tsx test_datapoint_state_flow.ts
 * ─────────────────────────────────────────────────────────────
 */
import "dotenv/config";
import { db } from "./src/db";
import { datapointValues, validationEvents } from "./src/db/schema";
import { sql } from "drizzle-orm";

// ── Costanti ──────────────────────────────────────────────────
const ITALIAN_STATES = ["Estratto", "Validato", "Stimato", "Dichiarato", "Conflitto", "Scartato"];
const CANONICAL_STATES = [
  "estimated",
  "declared_by_company",
  "auto_extracted_candidate",
  "manual_review_required",
  "manually_validated",
  "rule_validated",
  "rejected",
  "conflict_review",
];

let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label: string, detail?: string) {
  console.error(`  ❌ ${label}${detail ? `\n     → ${detail}` : ""}`);
  failed++;
}

// ── Test 1: nessuno stato italiano in datapoint_values ────────
async function testNoItalianStatesInDatapointValues() {
  console.log("\n[1] datapoint_values — stati italiani residui");

  for (const itState of ITALIAN_STATES) {
    const rows = await db.execute(
      sql`SELECT COUNT(*) AS cnt FROM datapoint_values WHERE state = ${itState}`
    );
    const count = Number((rows as any)[0]?.cnt ?? 0);
    if (count === 0) {
      ok(`Nessuna riga con state = '${itState}'`);
    } else {
      fail(`Trovate ${count} righe con state = '${itState}'`);
    }
  }
}

// ── Test 2: tutti gli stati presenti sono canonici ───────────
async function testAllStatesAreCanonical() {
  console.log("\n[2] datapoint_values — tutti gli stati sono canonici");

  const rows = await db.execute(
    sql`SELECT DISTINCT state FROM datapoint_values`
  );
  const found = (rows as any[]).map((r: any) => r.state as string);

  for (const s of found) {
    if (CANONICAL_STATES.includes(s)) {
      ok(`'${s}' è canonico`);
    } else {
      fail(`'${s}' NON è uno stato canonico`);
    }
  }

  if (found.length === 0) {
    ok("Tabella vuota — nessuno stato anomalo possibile");
  }
}

// ── Test 3: nessuno stato italiano in validation_events ───────
async function testNoItalianStatesInValidationEvents() {
  console.log("\n[3] validation_events — stati italiani residui");

  const cols = ["previous_state", "new_state"];
  for (const col of cols) {
    for (const itState of ITALIAN_STATES) {
      const rows = await db.execute(
        sql.raw(`SELECT COUNT(*) AS cnt FROM validation_events WHERE ${col} = '${itState}'`)
      );
      const count = Number((rows as any)[0]?.cnt ?? 0);
      if (count === 0) {
        ok(`validation_events.${col} = '${itState}' → 0 righe`);
      } else {
        fail(`validation_events.${col}: trovate ${count} righe con '${itState}'`);
      }
    }
  }
}

// ── Test 4: il DEFAULT della colonna è 'estimated' ───────────
async function testColumnDefault() {
  console.log("\n[4] datapoint_values.state — DEFAULT di colonna");

  const rows = await db.execute(sql`
    SELECT column_default
    FROM information_schema.columns
    WHERE table_name = 'datapoint_values'
      AND column_name = 'state'
  `);
  const raw = (rows as any)[0]?.column_default as string | undefined;
  // Postgres wraps enum defaults as: 'estimated'::datapoint_state
  const defaultVal = raw?.replace(/^'([^']+)'.*/,"$1");

  if (defaultVal === "estimated") {
    ok(`DEFAULT = 'estimated'`);
  } else {
    fail(`DEFAULT inatteso: '${raw}'`);
  }
}

// ── Test 5: distribuzione stati per sanity check ─────────────
async function printStateDistribution() {
  console.log("\n[5] Distribuzione stati (informativa)");

  const rows = await db.execute(sql`
    SELECT state, COUNT(*) AS cnt
    FROM datapoint_values
    GROUP BY state
    ORDER BY cnt DESC
  `);

  if ((rows as any[]).length === 0) {
    console.log("     (tabella vuota)");
    return;
  }

  for (const row of rows as any[]) {
    console.log(`     ${row.state.padEnd(30)} ${row.cnt}`);
  }
}

// ── Esecuzione ────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" SustainChain — Datapoint State Flow Test              ");
  console.log("═══════════════════════════════════════════════════════");

  await testNoItalianStatesInDatapointValues();
  await testAllStatesAreCanonical();
  await testNoItalianStatesInValidationEvents();
  await testColumnDefault();
  await printStateDistribution();

  console.log("\n───────────────────────────────────────────────────────");
  console.log(` Risultato: ${passed} passati, ${failed} falliti`);
  console.log("───────────────────────────────────────────────────────\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
