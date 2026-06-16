import 'dotenv/config';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

async function main() {
  const stems = [
    '2024-Campari-Group-Annual-Report','2024_Bilancio_RSI','2024_Rendicontazione_Consolidata',
    '2025_06_26_GruppoFS','AQUAFIL_SUST-REPORT_2024_ITA','Bilancio-sostenibilita-2024-ITA',
    'Bilancio_Consolidato_2024','TOD','Prysmian','Italgas-Integrated','LU-VE_Integrated',
    'REP25_Bilancio','RX PACK','Relazione-Finanziaria-31.12.24','SESA-Relazione',
    'Terna_2024','Zegna-Group','itc_2024','mapei-bilancio','report_2024_ita',
  ];
  let ok = 0, missing = 0;
  for (const stem of stems) {
    const rows = await db.execute(sql`
      SELECT d.name, COUNT(dc.id)::int as cnt
      FROM documents d
      LEFT JOIN document_chunks dc ON dc.document_id = d.id
      WHERE d.name ILIKE ${`%${stem}%`}
      GROUP BY d.name ORDER BY cnt DESC LIMIT 1
    `);
    const row = ((rows as any).rows ?? rows)[0];
    const cnt = row ? Number(row.cnt) : 0;
    if (cnt > 0) { ok++; console.log(`✅ ${stem}  chunks=${cnt}`); }
    else { missing++; console.log(`❌ ${stem}`); }
  }
  console.log(`\nTotale: ${ok} OK, ${missing} MISSING`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
