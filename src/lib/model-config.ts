/**
 * Fonte di verita unica per i modelli AI usati nel progetto.
 * Assicura che il lineage (DB) e l'esecuzione (SDK) siano allineati.
 *
 * DECISIONE MODELLO (2026-06-15):
 * Fase sviluppo/eval → Groq Llama 3.3 70B — GRATUITO (14.400 RPD, 30 RPM)
 *   Richiede: GROQ_API_KEY in .env (console.groq.com → API Keys)
 *   Installare: npm install @ai-sdk/groq
 *
 * UPGRADE PATH (quando il sistema va in produzione):
 *   "sonnet" → claude-sonnet-4-6 (~$3/MTok)
 *   "opus"   → claude-opus-4-8  (~$15/MTok)
 *   "gemini" → gemini-2.5-flash (gratuito ma ~50 RPD free, a pagamento 1500 RPD)
 */

import { createGroq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";

// Cambia ACTIVE_PROVIDER per switchare modello senza toccare il resto del codice
const ACTIVE_PROVIDER: "groq" | "gemini" | "sonnet" | "opus" = "sonnet";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

function getParserModel() {
  switch (ACTIVE_PROVIDER) {
    case "groq":
      return groq("llama-3.3-70b-versatile");
    case "gemini":
      return google("gemini-2.5-flash");
    case "sonnet":
      return anthropic("claude-sonnet-4-6");
    case "opus":
      return anthropic("claude-opus-4-8");
  }
}

function getParserModelName() {
  switch (ACTIVE_PROVIDER) {
    case "groq":    return "llama-3.3-70b-versatile";
    case "gemini":  return "gemini-2.5-flash";
    case "sonnet":  return "claude-sonnet-4-6";
    case "opus":    return "claude-opus-4-8";
  }
}

export const AI_MODELS = {
  PARSER_MODEL: getParserModel(),
  PARSER_MODEL_NAME: getParserModelName(),
  ACTIVE_PROVIDER,
};
