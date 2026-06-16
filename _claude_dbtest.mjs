import { config } from "dotenv"; config({ path: ".env" });
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const r = await sql`SELECT count(*) as chunks FROM document_chunks`;
console.log("DB OK, chunks presenti:", r[0].chunks);
