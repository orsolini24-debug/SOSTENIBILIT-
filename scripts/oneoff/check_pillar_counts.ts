import "dotenv/config";
import { db } from "./src/db";
import { datapointValues, datapoints } from "./src/db/schema";
import { eq, sql } from "drizzle-orm";

async function run() {
  const res = await db.select({ 
    module: datapoints.module, 
    count: sql<number>`count(*)` 
  })
  .from(datapointValues)
  .innerJoin(datapoints, eq(datapointValues.datapointId, datapoints.id))
  .where(eq(datapointValues.state, "auto_extracted_candidate"))
  .groupBy(datapoints.module);
  
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

run().catch(console.error);
