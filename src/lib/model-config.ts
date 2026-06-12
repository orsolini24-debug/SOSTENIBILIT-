/**
 * Fonte di veritÃ  unica per i modelli AI usati nel progetto.
 * Assicura che il lineage (DB) e l'esecuzione (SDK) siano allineati.
 */
export const AI_MODELS = {
  // Il modello "reale" usato per il parsing dei documenti (Sonnet 3.5 v2)
  PARSER_MODEL: "claude-3-5-sonnet-20241022",
  // Fallback per compatibilitÃ  SDK se necessario
  SDK_PARSER_ID: "claude-3-5-sonnet-20241022" 
};
