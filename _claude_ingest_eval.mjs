import { config } from "dotenv"; config({ path: ".env" });
import { neon } from "@neondatabase/serverless";
import fs from "fs"; import path from "path";
const sql = neon(process.env.DATABASE_URL);
const EXP = path.resolve("..", "sustainchain_core/07_outputs/chunks_export");

// colonna chunk_idx (migrazione Gemini) presente?
const col = await sql`SELECT count(*)::int n FROM information_schema.columns WHERE table_name='document_chunks' AND column_name='chunk_idx'`;
if (!col[0].n) { await sql`ALTER TABLE document_chunks ADD COLUMN chunk_idx integer NOT NULL DEFAULT 0`; console.log("chunk_idx aggiunta"); }

const files = fs.readdirSync(EXP).filter(f=>f.endsWith(".jsonl"));
console.log("JSONL:", files.length);
let totIns = 0;
for (const f of files) {
  const lines = fs.readFileSync(path.join(EXP,f),"utf-8").split("\n").filter(Boolean);
  const first = JSON.parse(lines[0]);
  const name = first.document_name;
  let doc = await sql`SELECT id FROM documents WHERE name=${name} LIMIT 1`;
  if (!doc.length) doc = await sql`INSERT INTO documents (name, type, storage_path, hash, status) VALUES (${name},'report',${'local://'+name},${first.source_hash},'ingested') RETURNING id`;
  const docId = doc[0].id;
  await sql`DELETE FROM document_chunks WHERE document_id=${docId}`;
  for (let i=0;i<lines.length;i+=250) {
    const batch = lines.slice(i,i+250).map(l=>JSON.parse(l));
    const vals=[]; const params=[];
    batch.forEach((c,j)=>{ const b=j*10;
      vals.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10})`);
      params.push(docId, c.page, c.table_id??null, c.row_idx??null, c.col_idx??null, c.heading??null, c.bbox?JSON.stringify(c.bbox):null, c.source_hash, c.text, c.chunk_idx);
    });
    await sql.query(`INSERT INTO document_chunks (document_id,page,table_id,row_idx,col_idx,heading,bbox,source_hash,text,chunk_idx) VALUES ${vals.join(",")}`, params);
    totIns += batch.length;
  }
  process.stdout.write(`${name.slice(0,30)}: ${lines.length}\n`);
}
const n = await sql`SELECT count(*)::int n FROM document_chunks`;
console.log("INGEST DONE. inseriti:", totIns, "| in tabella:", n[0].n);
