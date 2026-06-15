import { db } from "@/db";
import { documentChunks, datapoints } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export interface RetrievedChunk {
  id: string;
  chunk_id: string;
  page: number;
  text: string;
  score: number;
  rank: number;
}

// Sinonimi espansi per disclosure (Query Template)
const DISCLOSURE_TEMPLATES: Record<string, string[]> = {
  "total_energy_consumption": ["energia", "consumo elettrico", "consumo totale di energia", "total energy consumption", "elettricita", "kwh", "mwh"],
  "scope_1_ghg_emissions": ["scope 1", "emissioni dirette", "ghg", "gas serra", "co2", "riscaldamento", "flotta", "veicoli"],
  "scope_2_location_based_ghg_emissions": ["scope 2", "emissioni indirette", "location based", "energia acquistata"],
  "scope_2_market_based_ghg_emissions": ["scope 2", "emissioni indirette", "market based", "energia acquistata"],
  "scope_3_total_ghg_emissions": ["scope 3", "catena del valore", "value chain", "altre emissioni indirette"],
  "total_water_withdrawal": ["acqua", "prelievo idrico", "consumo idrico", "water withdrawal", "m3", "litri"],
  "total_waste_generated": ["rifiuti", "waste", "tonnellate", "kg", "pericolosi", "smaltimento"],
  "employees": ["dipendenti", "addetti", "personale", "risorse umane", "hr", "headcount", "employees"]
};

export async function retrieveChunks(documentId: string, disclosureId: string, topK: number = 5): Promise<RetrievedChunk[]> {
  // 1. Recupera sinonimi per la disclosure
  const synonyms = DISCLOSURE_TEMPLATES[disclosureId] || [];
  
  // Costruisci una stringa per websearch_to_tsquery unendo i sinonimi con l'operatore OR
  let tsQueryStr = "";
  if (synonyms.length > 0) {
     tsQueryStr = synonyms.map(s => `"${s}"`).join(" OR ");
  } else {
     // Fallback: cerca almeno il nome della disclosure
     const dp = await db.query.datapoints.findFirst({ where: eq(datapoints.id, disclosureId) });
     tsQueryStr = dp ? `"${dp.name}"` : `"${disclosureId}"`;
  }

  // 2. Esegui la ricerca full-text in Postgres
  // Utilizziamo plainto_tsquery o websearch_to_tsquery.
  // websearch_to_tsquery è flessibile. Convertiamo la tsQueryStr per l'italiano e inglese.
  
  const query = sql`
    WITH search_query AS (
      SELECT websearch_to_tsquery('italian', ${tsQueryStr}) AS q_it,
             websearch_to_tsquery('english', ${tsQueryStr}) AS q_en
    )
    SELECT 
      id, 
      chunk_idx as chunk_id, 
      page, 
      text,
      (ts_rank_cd(to_tsvector('italian', text), (SELECT q_it FROM search_query)) + 
       ts_rank_cd(to_tsvector('english', text), (SELECT q_en FROM search_query))) AS score
    FROM ${documentChunks}
    WHERE document_id = ${documentId}
      AND (
        to_tsvector('italian', text) @@ (SELECT q_it FROM search_query) OR
        to_tsvector('english', text) @@ (SELECT q_en FROM search_query)
      )
    ORDER BY score DESC
    LIMIT ${topK}
  `;

  const results = await db.execute(query);
  const rows = (results as any).rows || results;

  return rows.map((r: any, idx: number) => ({
    id: r.id,
    chunk_id: String(r.chunk_id),
    page: r.page,
    text: r.text,
    score: Number(r.score),
    rank: idx + 1
  }));
}
