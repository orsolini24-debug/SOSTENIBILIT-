import "dotenv/config";
import { db } from "./src/db";
import { datapoints } from "./src/db/schema";

async function run() {
  const res = await db.select({ 
    id: datapoints.id, 
    name: datapoints.name,
    module: datapoints.module 
  }).from(datapoints);
  
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

run().catch(console.error);
