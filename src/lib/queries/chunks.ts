import { db } from "@/db";
import { documentChunks } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * Counts the percentage of document chunks that have a non-null page reference.
 * Although 'page' is NOT NULL in the schema, this provides a template for similar checks.
 */
export async function getPageCompletionRate() {
  const result = await db.select({
    total: sql<number>`count(*)`,
    withPage: sql<number>`count(${documentChunks.page})`
  }).from(documentChunks);

  const total = Number(result[0].total);
  const withPage = Number(result[0].withPage);

  if (total === 0) return 0;
  return (withPage / total) * 100;
}
