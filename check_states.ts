import "dotenv/config";
import { db } from "./src/db";
import { datapointValues } from "./src/db/schema";
import { sql } from "drizzle-orm";

async function run() {
  const res = await db.select({ 
    state: datapointValues.state, 
    count: sql<number>`count(*)` 
  }).from(datapointValues).groupBy(datapointValues.state);
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

run().catch(console.error);
