import "dotenv/config";
import { db } from "./src/db";
import { datapoints, sectorCoefficients } from "./src/db/schema";

async function seed() {
  console.log("Seeding VSME Basic datapoints (~25 datapoint)...");

  // ── VSME BASIC MODULE ──────────────────────────────────────────────────────
  // Fonte: EFRAG VSME Exposure Draft (2023), Modulo Base obbligatorio per PMI
  const basicModule = [
    // ── AMBIENTE ──
    {
      id: "VSME-B1",
      code: "B1",
      name: "Consumo di energia",
      description: "Consumo totale di energia da fonti rinnovabili e non rinnovabili (elettricità, calore, vapore, combustibili)",
      unit: "kWh",
      module: "B",
    },
    {
      id: "VSME-B1-REN",
      code: "B1",
      name: "Quota energia rinnovabile",
      description: "Percentuale di energia da fonti rinnovabili sul totale consumato",
      unit: "%",
      module: "B",
    },
    {
      id: "VSME-B2-S1",
      code: "B2",
      name: "Emissioni GHG Scope 1",
      description: "Emissioni dirette di gas serra (combustione stazionaria, veicoli aziendali, processi, f-gas)",
      unit: "tCO2e",
      module: "B",
    },
    {
      id: "VSME-B2-S2-MB",
      code: "B2",
      name: "Emissioni GHG Scope 2 (Market-based)",
      description: "Emissioni indirette da energia acquistata — metodo market-based (considera contratti EAC/GO)",
      unit: "tCO2e",
      module: "B",
    },
    {
      id: "VSME-B2-S2-LB",
      code: "B2",
      name: "Emissioni GHG Scope 2 (Location-based)",
      description: "Emissioni indirette da energia acquistata — metodo location-based (mix elettrico nazionale)",
      unit: "tCO2e",
      module: "B",
    },
    {
      id: "VSME-B3",
      code: "B3",
      name: "Consumo di acqua",
      description: "Prelievo totale di acqua da rete idrica, pozzi, acque superficiali",
      unit: "m3",
      module: "B",
    },
    {
      id: "VSME-B3-STRESS",
      code: "B3",
      name: "Consumo acqua in aree a stress idrico",
      description: "Prelievo idrico in aree classificate ad alto o molto alto stress idrico (WRI Aqueduct)",
      unit: "m3",
      module: "B",
    },
    {
      id: "VSME-B4",
      code: "B4",
      name: "Produzione rifiuti totali",
      description: "Totale rifiuti prodotti (pericolosi + non pericolosi)",
      unit: "t",
      module: "B",
    },
    {
      id: "VSME-B4-HAZ",
      code: "B4",
      name: "Rifiuti pericolosi",
      description: "Rifiuti classificati come pericolosi ai sensi della direttiva 2008/98/CE",
      unit: "t",
      module: "B",
    },
    {
      id: "VSME-B4-NONHAZ",
      code: "B4",
      name: "Rifiuti non pericolosi",
      description: "Rifiuti non classificati come pericolosi",
      unit: "t",
      module: "B",
    },
    // ── SOCIALE ──
    {
      id: "VSME-B5",
      code: "B5",
      name: "Numero totale dipendenti",
      description: "Totale dipendenti (headcount) al 31/12 dell'anno di riferimento",
      unit: "count",
      module: "B",
    },
    {
      id: "VSME-B5-M",
      code: "B5",
      name: "Dipendenti — Uomini",
      description: "Numero di dipendenti di genere maschile",
      unit: "count",
      module: "B",
    },
    {
      id: "VSME-B5-F",
      code: "B5",
      name: "Dipendenti — Donne",
      description: "Numero di dipendenti di genere femminile",
      unit: "count",
      module: "B",
    },
    {
      id: "VSME-B5-TI",
      code: "B5",
      name: "Dipendenti a tempo indeterminato",
      description: "Dipendenti con contratto a tempo indeterminato",
      unit: "count",
      module: "B",
    },
    {
      id: "VSME-B5-TD",
      code: "B5",
      name: "Dipendenti a tempo determinato",
      description: "Dipendenti con contratto a tempo determinato",
      unit: "count",
      module: "B",
    },
    {
      id: "VSME-B5-PT",
      code: "B5",
      name: "Dipendenti part-time",
      description: "Dipendenti con orario di lavoro ridotto (part-time)",
      unit: "count",
      module: "B",
    },
    {
      id: "VSME-B6",
      code: "B6",
      name: "Gender Pay Gap",
      description: "Differenza percentuale media non aggiustata tra retribuzione maschile e femminile",
      unit: "percentage",
      module: "B",
    },
    {
      id: "VSME-B7-INC",
      code: "B7",
      name: "Infortuni sul lavoro",
      description: "Numero totale di infortuni sul lavoro con almeno 1 giorno di assenza",
      unit: "count",
      module: "B",
    },
    {
      id: "VSME-B7-FATAL",
      code: "B7",
      name: "Infortuni mortali",
      description: "Numero di infortuni sul lavoro con esito fatale",
      unit: "count",
      module: "B",
    },
    {
      id: "VSME-B7-TRIR",
      code: "B7",
      name: "Tasso di frequenza infortuni (TRIR)",
      description: "Total Recordable Incident Rate: (infortuni × 200.000) / ore lavorate",
      unit: "rate",
      module: "B",
    },
    // ── GOVERNANCE ──
    {
      id: "VSME-B8",
      code: "B8",
      name: "Incidenti di corruzione e concussione",
      description: "Numero di condanne o procedimenti giudiziari per corruzione, concussione o frode",
      unit: "count",
      module: "B",
    },
    // ── SUPPLY CHAIN ──
    {
      id: "VSME-B9",
      code: "B9",
      name: "Screening fornitori ESG",
      description: "Percentuale di fornitori (per valore acquisti) valutati tramite criteri ESG",
      unit: "percentage",
      module: "B",
    },
    // ── TRANSITION ──
    {
      id: "VSME-B10",
      code: "B10",
      name: "Target di riduzione emissioni",
      description: "Obiettivo percentuale di riduzione delle emissioni GHG rispetto all'anno base",
      unit: "percentage",
      module: "B",
    },
    {
      id: "VSME-B11",
      code: "B11",
      name: "Investimenti sostenibili (CapEx verde)",
      description: "Investimenti in attività allineate alla tassonomia UE o a obiettivi di sostenibilità",
      unit: "EUR",
      module: "B",
    },
    {
      id: "VSME-B12",
      code: "B12",
      name: "Rischi climatici identificati",
      description: "Numero di rischi fisici e di transizione climatica identificati nel processo di risk assessment",
      unit: "count",
      module: "B",
    },
  ];

  for (const dp of basicModule) {
    await db.insert(datapoints).values(dp).onConflictDoUpdate({
      target: datapoints.id,
      set: dp,
    });
  }
  console.log(`✓ ${basicModule.length} datapoint VSME Basic inseriti/aggiornati`);

  // ── SECTOR COEFFICIENTS ────────────────────────────────────────────────────
  // Fonte: bilanci di sostenibilità reali (RX PACK 2023, Intesa Sanpaolo 2023,
  //        Simone Gatto Industrie Alimentari 2023) + letteratura EFRAG/GRI
  //
  // coefficient_type naming convention:
  //   kwh_per_sqm          → kWh consumati per metro quadro di superficie
  //   kwh_per_employee     → kWh consumati per addetto (FTE)
  //   waste_per_employee   → tonnellate rifiuti per addetto
  //   water_per_employee   → m3 acqua per addetto
  //   fgas_per_100sqm      → tCO2e f-gas per 100 mq (impianti industriali/HVAC)

  const coefficients = [
    // ── UFFICI / SERVIZI (generic) ─────────────────────────────────────────
    // Benchmark: Intesa Sanpaolo Sustainability Report 2023
    { atecoPrefix: "generic", coefficientType: "kwh_per_sqm",        value: "50",    unit: "kWh/mq",      source: "Intesa Sanpaolo Sustainability Report 2023", sampleSize: 1,  confidence: "Alta" as const },
    { atecoPrefix: "generic", coefficientType: "kwh_per_employee",   value: "3000",  unit: "kWh/addetto", source: "Intesa Sanpaolo Sustainability Report 2023", sampleSize: 1,  confidence: "Alta" as const },
    { atecoPrefix: "generic", coefficientType: "waste_per_employee", value: "0.04",  unit: "t/addetto",   source: "Intesa Sanpaolo Sustainability Report 2023 (38.3 kg/addetto)", sampleSize: 1, confidence: "Alta" as const },
    { atecoPrefix: "generic", coefficientType: "water_per_employee", value: "20",    unit: "m3/addetto",  source: "Intesa Sanpaolo Sustainability Report 2023", sampleSize: 1,  confidence: "Alta" as const },
    { atecoPrefix: "generic", coefficientType: "fgas_per_100sqm",    value: "0",     unit: "tCO2e/100mq", source: "Default uffici senza impianti industriali",  sampleSize: null, confidence: "Media" as const },

    // ── PLASTICA / CHIMICA (ATECO 20, 22) ──────────────────────────────────
    // Benchmark: RX PACK SpA Bilancio di Sostenibilità 2023
    { atecoPrefix: "20", coefficientType: "kwh_per_sqm",        value: "200",  unit: "kWh/mq",      source: "RX PACK SpA Bilancio Sostenibilità 2023", sampleSize: 1, confidence: "Alta" as const },
    { atecoPrefix: "20", coefficientType: "kwh_per_employee",   value: "15000", unit: "kWh/addetto", source: "RX PACK SpA Bilancio Sostenibilità 2023", sampleSize: 1, confidence: "Alta" as const },
    { atecoPrefix: "20", coefficientType: "waste_per_employee", value: "1.5",  unit: "t/addetto",   source: "RX PACK SpA Bilancio Sostenibilità 2023", sampleSize: 1, confidence: "Alta" as const },
    { atecoPrefix: "20", coefficientType: "water_per_employee", value: "50",   unit: "m3/addetto",  source: "RX PACK SpA Bilancio Sostenibilità 2023", sampleSize: 1, confidence: "Alta" as const },
    { atecoPrefix: "20", coefficientType: "fgas_per_100sqm",    value: "5",    unit: "tCO2e/100mq", source: "Proxy impianti industriali e camere bianche",  sampleSize: null, confidence: "Bassa" as const },
    // ATECO 22 (materie plastiche) — stessi coefficienti di ATECO 20
    { atecoPrefix: "22", coefficientType: "kwh_per_sqm",        value: "200",  unit: "kWh/mq",      source: "RX PACK SpA Bilancio Sostenibilità 2023 (proxy ATECO 22)", sampleSize: null, confidence: "Media" as const },
    { atecoPrefix: "22", coefficientType: "kwh_per_employee",   value: "15000", unit: "kWh/addetto", source: "RX PACK SpA Bilancio Sostenibilità 2023 (proxy ATECO 22)", sampleSize: null, confidence: "Media" as const },
    { atecoPrefix: "22", coefficientType: "waste_per_employee", value: "1.5",  unit: "t/addetto",   source: "RX PACK SpA Bilancio Sostenibilità 2023 (proxy ATECO 22)", sampleSize: null, confidence: "Media" as const },
    { atecoPrefix: "22", coefficientType: "water_per_employee", value: "50",   unit: "m3/addetto",  source: "RX PACK SpA Bilancio Sostenibilità 2023 (proxy ATECO 22)", sampleSize: null, confidence: "Media" as const },
    { atecoPrefix: "22", coefficientType: "fgas_per_100sqm",    value: "5",    unit: "tCO2e/100mq", source: "Proxy impianti industriali", sampleSize: null, confidence: "Bassa" as const },

    // ── ALIMENTARE / BEVANDE (ATECO 10, 11) ────────────────────────────────
    // Benchmark: Simone Gatto Industrie Alimentari Bilancio Sostenibilità 2023
    { atecoPrefix: "10", coefficientType: "kwh_per_sqm",        value: "150",  unit: "kWh/mq",      source: "Simone Gatto Industrie Alimentari BS 2023", sampleSize: 1, confidence: "Alta" as const },
    { atecoPrefix: "10", coefficientType: "kwh_per_employee",   value: "8000", unit: "kWh/addetto", source: "Simone Gatto Industrie Alimentari BS 2023", sampleSize: 1, confidence: "Alta" as const },
    { atecoPrefix: "10", coefficientType: "waste_per_employee", value: "5.0",  unit: "t/addetto",   source: "Simone Gatto Industrie Alimentari BS 2023 (scarti biologici)", sampleSize: 1, confidence: "Alta" as const },
    { atecoPrefix: "10", coefficientType: "water_per_employee", value: "250",  unit: "m3/addetto",  source: "Simone Gatto Industrie Alimentari BS 2023 (lavaggi intensivi)", sampleSize: 1, confidence: "Alta" as const },
    { atecoPrefix: "10", coefficientType: "fgas_per_100sqm",    value: "2",    unit: "tCO2e/100mq", source: "Proxy celle frigorifere alimentari", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "11", coefficientType: "kwh_per_sqm",        value: "150",  unit: "kWh/mq",      source: "Proxy da ATECO 10", sampleSize: null, confidence: "Media" as const },
    { atecoPrefix: "11", coefficientType: "kwh_per_employee",   value: "8000", unit: "kWh/addetto", source: "Proxy da ATECO 10", sampleSize: null, confidence: "Media" as const },
    { atecoPrefix: "11", coefficientType: "waste_per_employee", value: "5.0",  unit: "t/addetto",   source: "Proxy da ATECO 10", sampleSize: null, confidence: "Media" as const },
    { atecoPrefix: "11", coefficientType: "water_per_employee", value: "250",  unit: "m3/addetto",  source: "Proxy da ATECO 10", sampleSize: null, confidence: "Media" as const },
    { atecoPrefix: "11", coefficientType: "fgas_per_100sqm",    value: "2",    unit: "tCO2e/100mq", source: "Proxy celle frigorifere", sampleSize: null, confidence: "Bassa" as const },

    // ── MECCANICA / MANIFATTURA (ATECO 25, 28, 29) ─────────────────────────
    { atecoPrefix: "25", coefficientType: "kwh_per_sqm",        value: "150",  unit: "kWh/mq",      source: "Benchmark PMI manifatturiere italiane (GRI 302, letteratura EFRAG)", sampleSize: null, confidence: "Media" as const },
    { atecoPrefix: "25", coefficientType: "kwh_per_employee",   value: "6000", unit: "kWh/addetto", source: "Benchmark PMI manifatturiere italiane", sampleSize: null, confidence: "Media" as const },
    { atecoPrefix: "25", coefficientType: "waste_per_employee", value: "3.5",  unit: "t/addetto",   source: "Benchmark PMI manifatturiere italiane", sampleSize: null, confidence: "Media" as const },
    { atecoPrefix: "25", coefficientType: "water_per_employee", value: "60",   unit: "m3/addetto",  source: "Benchmark PMI manifatturiere italiane", sampleSize: null, confidence: "Media" as const },
    { atecoPrefix: "25", coefficientType: "fgas_per_100sqm",    value: "0",    unit: "tCO2e/100mq", source: "Default meccanica (no camere bianche)", sampleSize: null, confidence: "Media" as const },

    // ── EDILIZIA / COSTRUZIONI (ATECO 41, 42, 43) ──────────────────────────
    { atecoPrefix: "41", coefficientType: "kwh_per_sqm",        value: "80",   unit: "kWh/mq",      source: "Benchmark edilizia italiana (GRI 302)", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "41", coefficientType: "kwh_per_employee",   value: "3000", unit: "kWh/addetto", source: "Benchmark edilizia italiana", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "41", coefficientType: "waste_per_employee", value: "15.0", unit: "t/addetto",   source: "Benchmark edilizia (macerie e scarti cantiere)", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "41", coefficientType: "water_per_employee", value: "40",   unit: "m3/addetto",  source: "Benchmark edilizia italiana", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "41", coefficientType: "fgas_per_100sqm",    value: "0",    unit: "tCO2e/100mq", source: "Default edilizia", sampleSize: null, confidence: "Media" as const },

    // ── COMMERCIO / RETAIL (ATECO 46, 47) ──────────────────────────────────
    { atecoPrefix: "46", coefficientType: "kwh_per_sqm",        value: "70",   unit: "kWh/mq",      source: "Benchmark retail italiano (letteratura GRI)", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "46", coefficientType: "kwh_per_employee",   value: "3500", unit: "kWh/addetto", source: "Benchmark retail italiano", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "46", coefficientType: "waste_per_employee", value: "0.3",  unit: "t/addetto",   source: "Benchmark retail italiano", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "46", coefficientType: "water_per_employee", value: "15",   unit: "m3/addetto",  source: "Benchmark retail italiano", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "46", coefficientType: "fgas_per_100sqm",    value: "1",    unit: "tCO2e/100mq", source: "Proxy refrigerazione negozi", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "47", coefficientType: "kwh_per_sqm",        value: "70",   unit: "kWh/mq",      source: "Proxy da ATECO 46", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "47", coefficientType: "kwh_per_employee",   value: "3500", unit: "kWh/addetto", source: "Proxy da ATECO 46", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "47", coefficientType: "waste_per_employee", value: "0.3",  unit: "t/addetto",   source: "Proxy da ATECO 46", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "47", coefficientType: "water_per_employee", value: "15",   unit: "m3/addetto",  source: "Proxy da ATECO 46", sampleSize: null, confidence: "Bassa" as const },
    { atecoPrefix: "47", coefficientType: "fgas_per_100sqm",    value: "1",    unit: "tCO2e/100mq", source: "Proxy refrigerazione negozi", sampleSize: null, confidence: "Bassa" as const },
  ];

  for (const coeff of coefficients) {
    await db.insert(sectorCoefficients).values(coeff).onConflictDoNothing();
  }
  console.log(`✓ ${coefficients.length} coefficienti settoriali inseriti`);

  console.log("Seed completato!");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
