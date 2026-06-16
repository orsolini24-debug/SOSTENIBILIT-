import "dotenv/config";
import { db } from "./src/db";
import { documentChunks, documents } from "./src/db/schema";
import { sql } from "drizzle-orm";

async function run() { 
  const docCount = await db.select({count: sql<number>`count(*)`}).from(documents); 
  const chunkCount = await db.select({count: sql<number>`count(*)`}).from(documentChunks); 
  console.log('Docs:', docCount[0].count, 'Chunks:', chunkCount[0].count); 
} 
run();