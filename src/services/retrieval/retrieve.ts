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
// v2 — aggiornato 2026-06-13 (failure analysis ciclo 2: Campari S3, LU-VE S3, Prysmian p.288, La Doria S1)
const DISCLOSURE_TEMPLATES: Record<string, string[]> = {
  "total_energy_consumption": [
    "energia", "consumo elettrico", "consumo totale di energia", "total energy consumption",
    "elettricita", "kwh", "mwh", "consumo totale energia", "total energy", "energia totale"
  ],
  "scope_1_ghg_emissions": [
    "scope 1", "emissioni dirette", "ghg", "gas serra", "co2", "riscaldamento", "flotta", "veicoli",
    "emissioni dirette scope 1", "gross scope 1", "gross direct ghg", "gas a effetto serra",
    "greenhouse gas protocol", "emissioni ghg scope 1"
  ],
  "scope_2_location_based_ghg_emissions": [
    "scope 2", "emissioni indirette", "location based", "energia acquistata",
    "location based methodology", "gross scope 2 location", "scope 2 lb", "emissioni indirette location"
  ],
  "scope_2_market_based_ghg_emissions": [
    "scope 2", "emissioni indirette", "market based", "energia acquistata",
    "market based methodology", "gross scope 2 market", "scope 2 mb", "emissioni indirette market"
  ],
  "scope_3_total_ghg_emissions": [
    "scope 3", "catena del valore", "value chain", "altre emissioni indirette",
    "total gross indirect", "total gross indirect ghg", "gross scope 3",
    "total gross indirect scope 3", "indirect ghg emissions scope 3",
    "emissioni indirette scope 3", "totale emissioni indirette scope 3",
    "total indirect ghg emissions"
  ],
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