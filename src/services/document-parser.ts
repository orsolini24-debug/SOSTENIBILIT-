import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

import { AI_MODELS } from "@/lib/model-config";

export interface ExtractedField {
  datapointId: string;
  field: string;
  value: string;
  unit: string;
  period: string;
  page: number;
  confidence: "Alta" | "Media" | "Bassa";
  sourceSnippet: string;
}

export async function parseDocument(documentText: string, documentType: "bolletta" | "hr" | "rifiuti"): Promise<ExtractedField[]> {
  console.log(`Avvio parsing reale per documento tipo: ${documentType} con modello ${AI_MODELS.SDK_PARSER_ID}`);

  // Se manca la chiave usiamo il mock (Fallback per sviluppo locale)
  if (!process.env.ANTHROPIC_API_KEY) {
     console.log("Chiave Anthropic mancante, ritorno mock...");
     if (documentType === "bolletta") {
        return [{
          datapointId: "VSME-B1",
          field: "Consumo Elettrico Attivo",
          value: "14250",
          unit: "kWh",
          period: "2026",
          page: 1,
          confidence: "Alta",
          sourceSnippet: "Totale energia attiva prelevata: 14.250 kWh"
        }];
     }
     return [];
  }

  const { object } = await generateObject({
    model: anthropic(AI_MODELS.SDK_PARSER_ID),
    schema: z.object({

      extracted_fields: z.array(
        z.object({
          datapointId: z.string().describe("ID del datapoint VSME (es. VSME-B1)"),
          field: z.string().describe("Nome logico del campo trovato"),
          value: z.string().describe("Valore estratto numerico o stringa"),
          unit: z.string().describe("Unità di misura (es. kWh, count, t)"),
          period: z.string().describe("Anno o periodo di riferimento"),
          page: z.number().describe("Pagina in cui è stato trovato il dato"),
          confidence: z.enum(["Alta", "Media", "Bassa"]).describe("Confidenza sull'estrazione"),
          sourceSnippet: z.string().describe("La frase esatta presente nel documento che giustifica il valore")
        })
      )
    }),
    prompt: `
      Sei un estrattore dati specializzato nel framework EFRAG VSME.
      Il tuo compito è estrarre dati dal documento seguente.
      Non inventare nulla. Se un dato non è presente, non inserirlo.
      
      DocumentType: ${documentType}
      
      Regole di mapping:
      - Se 'bolletta', cerca 'consumo totale' in kWh e assegnalo a 'VSME-B1'.
      - Se 'hr', cerca 'numero dipendenti' e assegnalo a 'VSME-B5'.
      - Se 'rifiuti', cerca tonnellate totali e assegnalo a 'VSME-B4'.
      
      Testo del documento:
      ${documentText.substring(0, 15000)} // Limite di sicurezza
    `
  });

  return object.extracted_fields;
}
