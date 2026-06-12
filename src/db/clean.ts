import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Cleaning duplicates...");
  await sql`DELETE FROM datapoint_values WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER(PARTITION BY project_id, datapoint_id ORDER BY id) as row_num FROM datapoint_values) t WHERE t.row_num > 1)`;
  console.log("Duplicates deleted.");
}

main();
