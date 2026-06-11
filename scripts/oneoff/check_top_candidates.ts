import "dotenv/config";
import { db } from "./src/db";
import { datapointValues, datapoints } from "./src/db/schema";
import { eq, sql } from "drizzle-orm";

async function run() {
  const res = await db.select({ 
    datapointId: datapointValues.datapointId,
    count: sql<number>`count(*)`
  })
  .from(datapointValues)
  .where(eq(datapointValues.state, "auto_extracted_candidate"))
  .groupBy(datapointValues.datapointId)
  .limit(20);
  
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

run().catch(console.error);
