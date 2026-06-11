import "dotenv/config";
import { db } from "./src/db";
import { datapoints } from "./src/db/schema";
import { sql } from "drizzle-orm";

async function run() {
  const res = await db.select({ 
    module: datapoints.module, 
    count: sql<number>`count(*)` 
  })
  .from(datapoints)
  .groupBy(datapoints.module);
  
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

run().catch(console.error);
