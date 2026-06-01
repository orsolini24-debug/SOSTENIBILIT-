import "dotenv/config";
import { db } from "./src/db";
import { datapointValues } from "./src/db/schema";
import { sql } from "drizzle-orm";

async function run() {
  const res = await db.execute(sql.raw(`
    SELECT datapoint_id, count(*) 
    FROM datapoint_values 
    WHERE (datapoint_id LIKE 'VSME-B1%' OR datapoint_id LIKE 'VSME-B2%' OR datapoint_id LIKE 'VSME-B3%' OR datapoint_id LIKE 'VSME-B4%' OR datapoint_id LIKE 'ESRS_E%')
    GROUP BY datapoint_id
  `));
  
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

run().catch(console.error);
