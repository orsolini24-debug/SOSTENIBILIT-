/**
 * rebuild_distributions.ts
 * Re-runs computeDistributions with the ×10 parse bug fixed.
 * Deletes old sector_distributions rows (version "1.0") then recomputes.
 *
 * Usage: npx tsx rebuild_distributions.ts [--dry]
 */
import "dotenv/config";
import { db } from "./src/db/index";
import { sectorDistributions } from "./src/db/schema";
import { eq } from "drizzle-orm";
import { computeDistributions } from "./src/services/predictive/computeDistributions";

async function main() {
  const dry = process.argv.includes("--dry");

  if (!dry) {
    console.log("🗑  Deleting existing sector_distributions (version=1.0)...");
    const deleted = await db.delete(sectorDistributions).where(eq(sectorDistributions.version, "1.0"));
    console.log(`   Deleted rows: ${(deleted as any).rowCount ?? "?"}`);
  }

  console.log("\n🔄 Recomputing distributions with fixed parser...");
  await computeDistributions(dry);
  console.log("\n✅ Done. Re-run backtest: python3 eval/backtest_predictive.py");
}

main().then(() => process.exit(0)).catch(e => { console.error("FATAL:", e); process.exit(1); });
