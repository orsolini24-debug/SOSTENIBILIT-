import "dotenv/config";
import { db } from "./src/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("🚀 Starting database state migration...");

  const newValues = [
    "estimated",
    "declared_by_company",
    "auto_extracted_candidate",
    "rule_validated",
    "manual_review_required",
    "manually_validated",
    "rejected",
    "conflict_review"
  ];

  for (const val of newValues) {
    try {
      // Postgres doesn't allow ALTER TYPE ... ADD VALUE in a transaction block
      // but Drizzle usually runs in one. We'll try.
      await db.execute(sql.raw(`ALTER TYPE datapoint_state ADD VALUE IF NOT EXISTS '${val}'`));
      console.log(`✅ Added '${val}' to datapoint_state enum`);
    } catch (e: any) {
      if (e.message.includes("already exists")) {
        console.log(`ℹ️ '${val}' already exists in enum`);
      } else {
        console.error(`❌ Error adding '${val}':`, e.message);
      }
    }
  }

  console.log("📈 Migrating data to new states...");

  const mappings = [
    { old: "Estratto", new: "auto_extracted_candidate" },
    { old: "Dichiarato", new: "declared_by_company" },
    { old: "Stimato", new: "estimated" },
    { old: "Validato", new: "manually_validated" }
  ];

  for (const m of mappings) {
    const res = await db.execute(sql.raw(`
      UPDATE datapoint_values 
      SET state = '${m.new}' 
      WHERE state::text = '${m.old}'
    `));
    console.log(`✅ Migrated '${m.old}' -> '${m.new}'`);
  }

  console.log("🏁 Migration completed.");
  process.exit(0);
}

migrate().catch(console.error);
