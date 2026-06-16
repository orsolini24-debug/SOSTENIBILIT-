/**
 * seed-esg-indicators.ts
 * Seeds esg_indicators + indicator_driver_map + framework_disclosure_map
 *
 * Coverage:
 *   E: E1 Climate (6), E2 Pollution (2), E3 Water (2), E4 Biodiversity (1), E5 Circularity (2)
 *   S: S1 Own workforce (8), S2 Value chain (3), S3 Affected communities (1), S4 Consumers (1)
 *   G: G1 Business conduct (5)
 *   Total: 31 indicators
 *
 * Driver logic:
 *   E quantitative → physical drivers (employees/sqm/revenue/fleet)
 *   S quantitative → FTE, hours_worked, suppliers
 *   S control/maturity → evidence_required, boolean_control
 *   G → boolean_control, percentage, evidence_required (not quantitative absolute)
 *
 * Framework coverage per indicator: ESRS, VSME, GRI, GHG Protocol, SASB (where applicable)
 */

import "dotenv/config";
import { db } from "@/db";
import { esgIndicators, indicatorDriverMap, frameworkDisclosureMap } from "@/db/schema";
import { eq } from "drizzle-orm";

// ============================================================
// Indicator catalog
// ============================================================

const INDICATORS = [

  // ─── E1: Climate Change ─────────────────────────────────────────────────────
  {
    id: "scope_1_ghg_emissions",
    code: "E-E1-001",
    name: "Emissioni GHG Scope 1",
    description: "Emissioni dirette di gas serra da fonti possedute o controllate dall'organizzazione. Include combustione stazionaria, combustione mobile, processi industriali, emissioni fuggitive.",
    pillar: "E",
    topic: "climate",
    canonicalUnit: "tCO2e",
    allowedUnits: ["tCO2e", "kgCO2e", "MtCO2e"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "E1-6",
      VSME: "B7",
      GRI: "305-1",
      GHG_Protocol: "Scope 1",
      SASB: "varies_by_industry",
      SDG: "13",
      EU_Taxonomy: "Climate Mitigation",
    },
    materialityDefaultBySector: {
      meccatronica: "high", chimico_plastico: "high", agroalimentare: "high",
      edilizia_impiantistica: "high", utilities: "high",
      moda_tessile: "medium", gdo_retail: "medium", default: "medium",
    },
    assuranceRelevance: "high",
    vsmeDisclosureId: "VSME-B7",
  },
  {
    id: "scope_2_location_based",
    code: "E-E1-002",
    name: "Emissioni GHG Scope 2 (location-based)",
    description: "Emissioni indirette da energia acquistata: elettricità, calore, vapore, raffreddamento. Metodo location-based: usa fattore emissione della rete elettrica nazionale/regionale.",
    pillar: "E",
    topic: "climate",
    canonicalUnit: "tCO2e",
    allowedUnits: ["tCO2e", "kgCO2e"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "E1-6",
      VSME: "B7",
      GRI: "305-2",
      GHG_Protocol: "Scope 2 (location-based)",
      SDG: "13",
    },
    materialityDefaultBySector: {
      meccatronica: "high", chimico_plastico: "high", utilities: "high",
      gdo_retail: "high", agroalimentare: "medium", moda_tessile: "medium",
      edilizia_impiantistica: "medium", default: "medium",
    },
    assuranceRelevance: "high",
    vsmeDisclosureId: "VSME-B7",
  },
  {
    id: "scope_2_market_based",
    code: "E-E1-003",
    name: "Emissioni GHG Scope 2 (market-based)",
    description: "Emissioni indirette Scope 2 calcolate con metodo market-based: usa fattori emissione da contratti di acquisto energia (EAC, PPA, GO). Possono essere inferiori al location-based se si acquistano rinnovabili.",
    pillar: "E",
    topic: "climate",
    canonicalUnit: "tCO2e",
    allowedUnits: ["tCO2e", "kgCO2e"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "E1-6",
      GRI: "305-2",
      GHG_Protocol: "Scope 2 (market-based)",
      SDG: "13",
    },
    materialityDefaultBySector: { default: "medium" },
    assuranceRelevance: "high",
    vsmeDisclosureId: "VSME-B7",
  },
  {
    id: "scope_3_total_ghg_emissions",
    code: "E-E1-004",
    name: "Emissioni GHG Scope 3 totali",
    description: "Emissioni indirette nella catena del valore (upstream + downstream). Include le 15 categorie GHG Protocol: acquisti di beni e servizi, capitale, combustibili upstream, trasporti, rifiuti, viaggi di lavoro, commuting, uso prodotti, fine vita, investimenti.",
    pillar: "E",
    topic: "climate",
    canonicalUnit: "tCO2e",
    allowedUnits: ["tCO2e", "kgCO2e"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "E1-6",
      GRI: "305-3",
      GHG_Protocol: "Scope 3",
      CSDDD: "Environmental due diligence",
      SDG: "12,13",
    },
    materialityDefaultBySector: {
      meccatronica: "high", chimico_plastico: "high",
      agroalimentare: "high", gdo_retail: "high", default: "medium",
    },
    assuranceRelevance: "medium",
    vsmeDisclosureId: null,
  },
  {
    id: "total_energy_consumption",
    code: "E-E1-005",
    name: "Consumo energetico totale",
    description: "Energia totale consumata dall'organizzazione: combustibili fossili + elettricità + calore/vapore acquistati + rinnovabili autoprodotti. Espresso in kWh o MWh.",
    pillar: "E",
    topic: "climate",
    canonicalUnit: "kWh",
    allowedUnits: ["kWh", "MWh", "GJ", "TJ"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "E1-5",
      VSME: "B5",
      GRI: "302-1",
      SDG: "7,13",
      ISO: "ISO 50001",
    },
    materialityDefaultBySector: {
      meccatronica: "high", chimico_plastico: "high", utilities: "high",
      gdo_retail: "high", edilizia_impiantistica: "medium",
      agroalimentare: "medium", moda_tessile: "medium", default: "medium",
    },
    assuranceRelevance: "high",
    vsmeDisclosureId: "VSME-B5",
  },
  {
    id: "renewable_energy_share",
    code: "E-E1-006",
    name: "Quota energia rinnovabile",
    description: "Percentuale di energia da fonti rinnovabili sul totale consumato. Include autoproduzione (fotovoltaico, eolico) e acquisti verificati (GO, EAC, PPA).",
    pillar: "E",
    topic: "climate",
    canonicalUnit: "%",
    allowedUnits: ["%", "kWh_renewable"],
    metricType: "percentage",
    frameworkMappings: {
      ESRS: "E1-5",
      VSME: "B6",
      GRI: "302-1",
      SDG: "7",
      EU_Taxonomy: "Climate Mitigation",
    },
    materialityDefaultBySector: { default: "medium" },
    assuranceRelevance: "medium",
    vsmeDisclosureId: "VSME-B6",
  },

  // ─── E2: Pollution ───────────────────────────────────────────────────────────
  {
    id: "air_pollutants_nox_sox",
    code: "E-E2-001",
    name: "Emissioni inquinanti aria (NOx, SOx)",
    description: "Emissioni di ossidi di azoto (NOx) e ossidi di zolfo (SOx) in atmosfera. Prevalentemente rilevante per settori con combustione ad alta intensità e processi industriali.",
    pillar: "E",
    topic: "pollution",
    canonicalUnit: "ton",
    allowedUnits: ["ton", "kg"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "E2-4",
      GRI: "305-7",
      SDG: "3,11",
    },
    materialityDefaultBySector: {
      chimico_plastico: "high", utilities: "high",
      meccatronica: "medium", default: "low",
    },
    assuranceRelevance: "medium",
    vsmeDisclosureId: null,
  },
  {
    id: "hazardous_waste_generated",
    code: "E-E2-002",
    name: "Rifiuti pericolosi generati",
    description: "Quantità totale di rifiuti classificati come pericolosi secondo normativa UE. Include solventi, oli esausti, batterie, RAEE, rifiuti chimici.",
    pillar: "E",
    topic: "pollution",
    canonicalUnit: "ton",
    allowedUnits: ["ton", "kg"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "E2-4",
      VSME: "B9",
      GRI: "306-3",
      SDG: "12",
    },
    materialityDefaultBySector: {
      chimico_plastico: "high", meccatronica: "high",
      agroalimentare: "medium", default: "low",
    },
    assuranceRelevance: "medium",
    vsmeDisclosureId: "VSME-B9",
  },

  // ─── E3: Water ───────────────────────────────────────────────────────────────
  {
    id: "total_water_consumption",
    code: "E-E3-001",
    name: "Consumo idrico totale",
    description: "Acqua prelevata meno acqua restituita al corpo idrico di origine alla stessa qualità. Include prelievi da rete idrica, pozzi, acque superficiali.",
    pillar: "E",
    topic: "water",
    canonicalUnit: "m3",
    allowedUnits: ["m3", "liters", "megaliters"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "E3-4",
      VSME: "B8",
      GRI: "303-5",
      SDG: "6",
    },
    materialityDefaultBySector: {
      agroalimentare: "high", chimico_plastico: "high",
      meccatronica: "medium", moda_tessile: "medium",
      utilities: "medium", default: "low",
    },
    assuranceRelevance: "medium",
    vsmeDisclosureId: "VSME-B8",
  },
  {
    id: "water_stress_area_withdrawal",
    code: "E-E3-002",
    name: "Prelievo idrico in aree a stress idrico",
    description: "Prelievo idrico in zone ad alta o altissima scarsità idrica (WRI Aqueduct score >40%). Metrica critica per ESRS E3 e per doppia materialità.",
    pillar: "E",
    topic: "water",
    canonicalUnit: "m3",
    allowedUnits: ["m3", "megaliters"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "E3-4",
      GRI: "303-3",
      SASB: "varies_by_industry",
      SDG: "6",
    },
    materialityDefaultBySector: {
      agroalimentare: "high", chimico_plastico: "high", default: "low",
    },
    assuranceRelevance: "medium",
    vsmeDisclosureId: null,
  },

  // ─── E4: Biodiversity ────────────────────────────────────────────────────────
  {
    id: "sites_in_sensitive_areas",
    code: "E-E4-001",
    name: "Siti in aree sensibili (Natura 2000 / IUCN)",
    description: "Numero e superficie di siti operativi situati in o adiacenti ad aree protette (Natura 2000, IUCN I-IV, UNESCO, Key Biodiversity Areas). Utilizzato per valutare dipendenza e impatto sulla biodiversità.",
    pillar: "E",
    topic: "biodiversity",
    canonicalUnit: "count",
    allowedUnits: ["count", "hectares"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "E4-5",
      GRI: "304-1",
      SDG: "15",
      EU_Taxonomy: "Biodiversity protection",
    },
    materialityDefaultBySector: {
      agroalimentare: "high", edilizia_impiantistica: "high",
      utilities: "medium", default: "low",
    },
    assuranceRelevance: "low",
    vsmeDisclosureId: null,
  },

  // ─── E5: Resource Use & Circular Economy ────────────────────────────────────
  {
    id: "total_waste_generated",
    code: "E-E5-001",
    name: "Rifiuti totali generati",
    description: "Quantità totale di rifiuti (pericolosi + non pericolosi) generati nelle operazioni. Base per calcolare tasso di circolarità e deviazione da discarica.",
    pillar: "E",
    topic: "circularity",
    canonicalUnit: "ton",
    allowedUnits: ["ton", "kg"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "E5-5",
      VSME: "B9",
      GRI: "306-3",
      SDG: "12",
    },
    materialityDefaultBySector: {
      agroalimentare: "high", chimico_plastico: "high",
      moda_tessile: "medium", meccatronica: "medium", default: "medium",
    },
    assuranceRelevance: "medium",
    vsmeDisclosureId: "VSME-B9",
  },
  {
    id: "waste_recycled_recovered_rate",
    code: "E-E5-002",
    name: "Tasso di recupero rifiuti",
    description: "Percentuale di rifiuti avviati a recupero (riciclaggio, compostaggio, recupero energetico) rispetto al totale generato. Indica avanzamento verso economia circolare.",
    pillar: "E",
    topic: "circularity",
    canonicalUnit: "%",
    allowedUnits: ["%"],
    metricType: "percentage",
    frameworkMappings: {
      ESRS: "E5-5",
      VSME: "B9",
      GRI: "306-4,306-5",
      SDG: "12",
    },
    materialityDefaultBySector: { default: "medium" },
    assuranceRelevance: "low",
    vsmeDisclosureId: null,
  },

  // ─── S1: Own Workforce ───────────────────────────────────────────────────────
  {
    id: "total_fte",
    code: "E-S1-001",
    name: "Totale dipendenti (FTE)",
    description: "Numero di lavoratori equivalenti a tempo pieno al 31/12 (o media annua). Include dipendenti diretti, esclude lavoratori in somministrazione (che vanno in S2).",
    pillar: "S",
    topic: "own_workforce",
    canonicalUnit: "FTE",
    allowedUnits: ["FTE", "headcount"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "S1-6",
      VSME: "B10",
      GRI: "2-7",
      SDG: "8",
    },
    materialityDefaultBySector: { default: "high" },
    assuranceRelevance: "high",
    vsmeDisclosureId: "VSME-B10",
  },
  {
    id: "injury_rate_ltifr",
    code: "E-S1-002",
    name: "Tasso di infortuni (LTIFR)",
    description: "Lost Time Injury Frequency Rate: numero di infortuni con assenza ≥1 giorno per milione di ore lavorate. Principale KPI ESRS S1 per salute e sicurezza.",
    pillar: "S",
    topic: "own_workforce",
    canonicalUnit: "incidents/Mhours",
    allowedUnits: ["incidents/Mhours", "incidents/FTE"],
    metricType: "quantitative_intensity",
    frameworkMappings: {
      ESRS: "S1-14",
      VSME: "B12",
      GRI: "403-9",
      SASB: "varies_by_industry",
      SA8000: "SA8000:2014 §9.7",
      SDG: "8",
    },
    materialityDefaultBySector: {
      edilizia_impiantistica: "high", meccatronica: "high",
      chimico_plastico: "high", agroalimentare: "medium",
      default: "medium",
    },
    assuranceRelevance: "high",
    vsmeDisclosureId: "VSME-B12",
  },
  {
    id: "training_hours_per_fte",
    code: "E-S1-003",
    name: "Ore di formazione per addetto",
    description: "Ore totali di formazione erogate divise per FTE medio. Include formazione on-the-job, corsi, e-learning, sicurezza obbligatoria e sviluppo professionale.",
    pillar: "S",
    topic: "own_workforce",
    canonicalUnit: "hours/FTE",
    allowedUnits: ["hours/FTE", "days/FTE"],
    metricType: "quantitative_intensity",
    frameworkMappings: {
      ESRS: "S1-13",
      VSME: "B11",
      GRI: "404-1",
      SDG: "4,8",
    },
    materialityDefaultBySector: { default: "medium" },
    assuranceRelevance: "low",
    vsmeDisclosureId: "VSME-B11",
  },
  {
    id: "employee_turnover_rate",
    code: "E-S1-004",
    name: "Tasso di turnover volontario",
    description: "Uscite volontarie / FTE medio × 100. Indicatore di fidelizzazione e clima aziendale. Esclude licenziamenti, prepensionamenti, scadenze contrattuali.",
    pillar: "S",
    topic: "own_workforce",
    canonicalUnit: "%",
    allowedUnits: ["%"],
    metricType: "percentage",
    frameworkMappings: {
      ESRS: "S1-6",
      GRI: "401-1",
      SDG: "8",
    },
    materialityDefaultBySector: { default: "medium" },
    assuranceRelevance: "low",
    vsmeDisclosureId: null,
  },
  {
    id: "gender_pay_gap",
    code: "E-S1-005",
    name: "Divario retributivo di genere",
    description: "Differenza percentuale tra retribuzione media maschile e femminile sullo stesso livello/categoria. Formula: (retrib_M - retrib_F) / retrib_M × 100.",
    pillar: "S",
    topic: "own_workforce",
    canonicalUnit: "%",
    allowedUnits: ["%"],
    metricType: "percentage",
    frameworkMappings: {
      ESRS: "S1-16",
      GRI: "405-2",
      SDG: "5,8",
      EU_Taxonomy: "Social objectives",
    },
    materialityDefaultBySector: { default: "medium" },
    assuranceRelevance: "medium",
    vsmeDisclosureId: null,
  },
  {
    id: "collective_bargaining_coverage",
    code: "E-S1-006",
    name: "Copertura da contrattazione collettiva",
    description: "Percentuale di dipendenti coperti da contratto collettivo di lavoro (CCNL o equivalente). Indicatore di tutela lavorativa.",
    pillar: "S",
    topic: "own_workforce",
    canonicalUnit: "%",
    allowedUnits: ["%"],
    metricType: "percentage",
    frameworkMappings: {
      ESRS: "S1-8",
      GRI: "402-1,407-1",
      OECD: "Guidelines for MNEs, Ch.5",
      SDG: "8",
    },
    materialityDefaultBySector: { default: "medium" },
    assuranceRelevance: "low",
    vsmeDisclosureId: null,
  },
  {
    id: "gender_diversity_management",
    code: "E-S1-007",
    name: "Quota donne in posizioni manageriali",
    description: "Percentuale di donne nelle posizioni di senior management o middle management. Target UE parità ≥40% per società quotate (Direttiva Gender Balance Boards).",
    pillar: "S",
    topic: "own_workforce",
    canonicalUnit: "%",
    allowedUnits: ["%"],
    metricType: "percentage",
    frameworkMappings: {
      ESRS: "S1-11",
      GRI: "405-1",
      B_Corp: "Workers Impact Area",
      SDG: "5",
    },
    materialityDefaultBySector: { default: "medium" },
    assuranceRelevance: "low",
    vsmeDisclosureId: null,
  },
  {
    id: "ohs_management_system_certified",
    code: "E-S1-008",
    name: "Sistema di gestione OHS certificato (ISO 45001)",
    description: "L'organizzazione possiede certificazione ISO 45001 o equivalente per il sistema di gestione della salute e sicurezza sul lavoro. Indicatore di controllo/sistema, non di performance numerica.",
    pillar: "S",
    topic: "own_workforce",
    canonicalUnit: "boolean",
    allowedUnits: ["boolean"],
    metricType: "boolean_control",
    frameworkMappings: {
      ESRS: "S1-1",
      GRI: "403-1",
      ISO: "ISO 45001",
      SDG: "3,8",
    },
    materialityDefaultBySector: {
      edilizia_impiantistica: "high", meccatronica: "high",
      chimico_plastico: "high", default: "medium",
    },
    assuranceRelevance: "medium",
    vsmeDisclosureId: null,
  },

  // ─── S2: Workers in the value chain ─────────────────────────────────────────
  {
    id: "suppliers_social_audit_rate",
    code: "E-S2-001",
    name: "Fornitori critici soggetti ad audit sociale",
    description: "Percentuale di fornitori classificati come critici (per spesa, paese, settore) che hanno ricevuto audit sociale (SMETA, SA8000, questionari certificati) negli ultimi 2 anni.",
    pillar: "S",
    topic: "value_chain_workers",
    canonicalUnit: "%",
    allowedUnits: ["%", "count"],
    metricType: "percentage",
    frameworkMappings: {
      ESRS: "S2-1",
      GRI: "408-1,409-1",
      OECD: "Guidelines for MNEs, Ch.5",
      CSDDD: "Supply chain due diligence",
      SA8000: "SA8000:2014",
      SDG: "8",
    },
    materialityDefaultBySector: {
      moda_tessile: "high", agroalimentare: "high",
      gdo_retail: "high", default: "medium",
    },
    assuranceRelevance: "medium",
    vsmeDisclosureId: null,
  },
  {
    id: "high_risk_country_procurement_share",
    code: "E-S2-002",
    name: "Quota acquisti da paesi ad alto rischio",
    description: "Percentuale della spesa di approvvigionamento proveniente da paesi con alto rischio di lavoro forzato, minorile o violazione diritti umani (EU Supply Chain Act / OECD Country Risk Classifications).",
    pillar: "S",
    topic: "value_chain_workers",
    canonicalUnit: "%",
    allowedUnits: ["%"],
    metricType: "percentage",
    frameworkMappings: {
      ESRS: "S2-1",
      OECD: "Due Diligence Guidance, Country Risk",
      CSDDD: "Supply chain due diligence",
      GRI: "408-1,409-1",
      SDG: "8,16",
    },
    materialityDefaultBySector: {
      moda_tessile: "high", agroalimentare: "high",
      meccatronica: "medium", gdo_retail: "high", default: "low",
    },
    assuranceRelevance: "medium",
    vsmeDisclosureId: null,
  },
  {
    id: "human_rights_policy_in_place",
    code: "E-S2-003",
    name: "Policy diritti umani formalizzata",
    description: "L'organizzazione ha una policy diritti umani approvata dal board, pubblicamente disponibile, che include supply chain, lavoro forzato, lavoro minorile, libertà di associazione.",
    pillar: "S",
    topic: "value_chain_workers",
    canonicalUnit: "boolean",
    allowedUnits: ["boolean"],
    metricType: "boolean_control",
    frameworkMappings: {
      ESRS: "S2-1",
      GRI: "412-1",
      OECD: "Guidelines for MNEs, Ch.5",
      CSDDD: "Art.5",
      UN_GP: "UNGP Pillar 1",
      SDG: "8,16",
    },
    materialityDefaultBySector: { default: "medium" },
    assuranceRelevance: "medium",
    vsmeDisclosureId: null,
  },

  // ─── S3: Affected Communities ────────────────────────────────────────────────
  {
    id: "community_grievance_mechanism",
    code: "E-S3-001",
    name: "Meccanismo di reclamo per comunità locali",
    description: "Disponibilità di un canale accessibile alle comunità locali per presentare reclami relativi a impatti ambientali, sociali o economici delle operazioni aziendali.",
    pillar: "S",
    topic: "affected_communities",
    canonicalUnit: "boolean",
    allowedUnits: ["boolean"],
    metricType: "boolean_control",
    frameworkMappings: {
      ESRS: "S3-1",
      GRI: "2-25,413-1",
      OECD: "Guidelines for MNEs, Ch.2",
      CSDDD: "Stakeholder engagement",
      UN_GP: "UNGP Pillar 3",
      SDG: "16",
    },
    materialityDefaultBySector: {
      utilities: "high", edilizia_impiantistica: "high",
      agroalimentare: "medium", default: "low",
    },
    assuranceRelevance: "low",
    vsmeDisclosureId: null,
  },

  // ─── S4: Consumers and end-users ────────────────────────────────────────────
  {
    id: "product_safety_incidents",
    code: "E-S4-001",
    name: "Incidenti di sicurezza prodotto / richiami",
    description: "Numero di richiami di prodotto, incidenti di sicurezza notificati alle autorità, o reclami cliente legati a danni alla salute/sicurezza negli ultimi 12 mesi.",
    pillar: "S",
    topic: "consumers_end_users",
    canonicalUnit: "count",
    allowedUnits: ["count"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "S4-1",
      GRI: "416-1,416-2",
      SASB: "varies_by_industry",
      SDG: "3,12",
    },
    materialityDefaultBySector: {
      agroalimentare: "high", chimico_plastico: "high",
      gdo_retail: "medium", default: "low",
    },
    assuranceRelevance: "medium",
    vsmeDisclosureId: null,
  },

  // ─── G1: Business Conduct ────────────────────────────────────────────────────
  {
    id: "anti_corruption_training_rate",
    code: "E-G1-001",
    name: "Tasso di formazione anti-corruzione",
    description: "Percentuale di dipendenti in ruoli a rischio corruzione che hanno completato formazione anti-corruzione (ISO 37001, FCPA, D.Lgs. 231/01) nell'anno. Ruoli a rischio: procurement, commerciale, pubblici ufficiali/interfaces.",
    pillar: "G",
    topic: "business_conduct",
    canonicalUnit: "%",
    allowedUnits: ["%"],
    metricType: "percentage",
    frameworkMappings: {
      ESRS: "G1-4",
      GRI: "205-2",
      OECD: "Anti-Bribery Convention",
      ISO: "ISO 37001",
      B_Corp: "GOV-Q9",
      SDG: "16",
    },
    materialityDefaultBySector: { default: "medium" },
    assuranceRelevance: "medium",
    vsmeDisclosureId: null,
  },
  {
    id: "whistleblowing_channel_active",
    code: "E-G1-002",
    name: "Canale whistleblowing attivo",
    description: "L'organizzazione ha un canale di segnalazione interna (whistleblowing) anonimo, accessibile, protetto da ritorsioni, conforme al D.Lgs. 24/2023 (recepimento Direttiva UE 1937/2019). Obbligatorio per aziende >50 dipendenti in Italia.",
    pillar: "G",
    topic: "business_conduct",
    canonicalUnit: "boolean",
    allowedUnits: ["boolean"],
    metricType: "boolean_control",
    frameworkMappings: {
      ESRS: "G1-1",
      GRI: "2-26",
      ISO: "ISO 37002",
      EU_Whistleblowing: "Dir. 2019/1937",
      OECD: "Anti-Bribery Guidelines",
      SDG: "16",
    },
    materialityDefaultBySector: { default: "high" },
    assuranceRelevance: "medium",
    vsmeDisclosureId: null,
  },
  {
    id: "supplier_payment_days",
    code: "E-G1-003",
    name: "Giorni medi di pagamento fornitori (DPO)",
    description: "Days Payable Outstanding: tempo medio in giorni dal ricevimento fattura al pagamento. ESRS G1 e D.Lgs. 231/2002 impongono termini massimi (30 gg per PA, 60 gg per privati salvo accordo).",
    pillar: "G",
    topic: "business_conduct",
    canonicalUnit: "days",
    allowedUnits: ["days"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "G1-6",
      GRI: "2-6",
      EU_Payment: "Dir. 2011/7/EU",
      SDG: "8",
    },
    materialityDefaultBySector: { default: "medium" },
    assuranceRelevance: "low",
    vsmeDisclosureId: null,
  },
  {
    id: "fines_penalties_eur",
    code: "E-G1-004",
    name: "Sanzioni e ammende (€)",
    description: "Importo totale di sanzioni monetarie, ammende o penali significative ricevute per non conformità a leggi/regolamenti nell'anno. Include sanzioni ambientali, sociali, fiscali, antitrust.",
    pillar: "G",
    topic: "business_conduct",
    canonicalUnit: "EUR",
    allowedUnits: ["EUR", "kEUR"],
    metricType: "quantitative_absolute",
    frameworkMappings: {
      ESRS: "G1-4",
      GRI: "206-1,307-1,419-1",
      SDG: "16",
    },
    materialityDefaultBySector: { default: "medium" },
    assuranceRelevance: "medium",
    vsmeDisclosureId: null,
  },
  {
    id: "esg_governance_board_oversight",
    code: "E-G1-005",
    name: "Supervisione ESG da organo di governance",
    description: "Il consiglio di amministrazione (o organo equivalente) ha responsabilità formale e documentata sulla supervisione dei rischi e delle strategie ESG. Include almeno un punto OdG annuo su sostenibilità.",
    pillar: "G",
    topic: "business_conduct",
    canonicalUnit: "boolean",
    allowedUnits: ["boolean"],
    metricType: "boolean_control",
    frameworkMappings: {
      ESRS: "GOV-1",
      VSME: "B1",
      GRI: "2-9,2-12",
      B_Corp: "GOV-Q1",
      TCFD: "Governance Pillar",
      SDG: "16,17",
    },
    materialityDefaultBySector: { default: "high" },
    assuranceRelevance: "medium",
    vsmeDisclosureId: "VSME-B1",
  },
];

// ============================================================
// Driver map catalog
// ============================================================

const DRIVER_MAP: Array<{
  indicatorId: string;
  primaryDriver: string;
  secondaryDriver?: string;
  fallbackDriver: string;
  denominatorUnit: string;
  intensityFormula: string;
  fallbackFormula: string;
  driverRequiredness: "required" | "recommended" | "optional";
  driverQualityImpact: string;
  notes?: string;
}> = [
  // E ─────────────────────────────────────────────────────────
  {
    indicatorId: "scope_1_ghg_emissions",
    primaryDriver: "employees",
    secondaryDriver: "revenue_eur",
    fallbackDriver: "employees",
    denominatorUnit: "FTE",
    intensityFormula: "tCO2e / FTE",
    fallbackFormula: "tCO2e / FTE (preferred) OR tCO2e / MEUR (if employees unavailable)",
    driverRequiredness: "required",
    driverQualityImpact: "Employees missing → use revenue_eur, confidence drops to Bassa",
    notes: "Fleet-dependent sectors (logistics, construction) should use fleet_size as secondary",
  },
  {
    indicatorId: "scope_2_location_based",
    primaryDriver: "facility_area_sqm",
    secondaryDriver: "employees",
    fallbackDriver: "employees",
    denominatorUnit: "m2",
    intensityFormula: "tCO2e / m2",
    fallbackFormula: "tCO2e / FTE (if area unavailable)",
    driverRequiredness: "recommended",
    driverQualityImpact: "Area missing → employee fallback adds ~30% uncertainty to interval width",
  },
  {
    indicatorId: "scope_2_market_based",
    primaryDriver: "facility_area_sqm",
    secondaryDriver: "employees",
    fallbackDriver: "employees",
    denominatorUnit: "m2",
    intensityFormula: "tCO2e / m2",
    fallbackFormula: "tCO2e / FTE (if area unavailable)",
    driverRequiredness: "recommended",
    driverQualityImpact: "MB values are highly variable (depends on energy mix); interval inherently wider",
  },
  {
    indicatorId: "scope_3_total_ghg_emissions",
    primaryDriver: "revenue_eur",
    secondaryDriver: "employees",
    fallbackDriver: "employees",
    denominatorUnit: "MEUR",
    intensityFormula: "tCO2e / MEUR revenue",
    fallbackFormula: "tCO2e / FTE (revenue unavailable — very rough proxy)",
    driverRequiredness: "recommended",
    driverQualityImpact: "Revenue is best Scope 3 proxy; without it, interval width ratio likely >4x",
    notes: "GHG Protocol recommends spend-based method for Scope 3 Cat.1; MEUR revenue is macro proxy only",
  },
  {
    indicatorId: "total_energy_consumption",
    primaryDriver: "facility_area_sqm",
    secondaryDriver: "employees",
    fallbackDriver: "employees",
    denominatorUnit: "m2",
    intensityFormula: "kWh / m2",
    fallbackFormula: "kWh / FTE (if area unavailable)",
    driverRequiredness: "recommended",
    driverQualityImpact: "Energy highly correlated with facility area; FTE fallback less precise for process industries",
  },
  {
    indicatorId: "renewable_energy_share",
    primaryDriver: "employees",
    fallbackDriver: "employees",
    denominatorUnit: "FTE",
    intensityFormula: "% (no normalization needed)",
    fallbackFormula: "% (dimensionless)",
    driverRequiredness: "optional",
    driverQualityImpact: "Renewable share is dimensionless — driver not used for de-normalization",
  },
  {
    indicatorId: "total_water_consumption",
    primaryDriver: "employees",
    secondaryDriver: "revenue_eur",
    fallbackDriver: "employees",
    denominatorUnit: "FTE",
    intensityFormula: "m3 / FTE",
    fallbackFormula: "m3 / FTE",
    driverRequiredness: "required",
    driverQualityImpact: "Water highly sector-dependent; FTE is only rough proxy for process industries",
    notes: "For food/beverage, ton_production is better driver but rarely available at onboarding",
  },
  {
    indicatorId: "total_waste_generated",
    primaryDriver: "employees",
    secondaryDriver: "revenue_eur",
    fallbackDriver: "employees",
    denominatorUnit: "FTE",
    intensityFormula: "ton / FTE",
    fallbackFormula: "ton / FTE",
    driverRequiredness: "required",
    driverQualityImpact: "Production-intensive companies have much higher waste/FTE; sector cluster mitigates this",
  },
  {
    indicatorId: "hazardous_waste_generated",
    primaryDriver: "employees",
    fallbackDriver: "employees",
    denominatorUnit: "FTE",
    intensityFormula: "ton / FTE",
    fallbackFormula: "ton / FTE",
    driverRequiredness: "required",
    driverQualityImpact: "High sector variation; manufacturing/chemical > service by 10-100x",
  },
  // S ─────────────────────────────────────────────────────────
  {
    indicatorId: "injury_rate_ltifr",
    primaryDriver: "hours_worked",
    secondaryDriver: "employees",
    fallbackDriver: "employees",
    denominatorUnit: "Mhours",
    intensityFormula: "incidents / 1.000.000 hours worked",
    fallbackFormula: "incidents / FTE × 2.000 (estimated annual hours if hours_worked unavailable)",
    driverRequiredness: "recommended",
    driverQualityImpact: "Without hours_worked, assume 2000 h/FTE/year — introduces ~15% error",
  },
  {
    indicatorId: "training_hours_per_fte",
    primaryDriver: "employees",
    fallbackDriver: "employees",
    denominatorUnit: "FTE",
    intensityFormula: "hours / FTE (already an intensity — no further normalization)",
    fallbackFormula: "hours / FTE",
    driverRequiredness: "required",
    driverQualityImpact: "Denominator is definitional for this metric",
  },
  {
    indicatorId: "employee_turnover_rate",
    primaryDriver: "employees",
    fallbackDriver: "employees",
    denominatorUnit: "FTE",
    intensityFormula: "leavers / avg_FTE × 100 (%)",
    fallbackFormula: "% (dimensionless once computed)",
    driverRequiredness: "required",
    driverQualityImpact: "FTE average needed for denominator",
  },
  {
    indicatorId: "suppliers_social_audit_rate",
    primaryDriver: "procurement_spend_eur",
    secondaryDriver: "employees",
    fallbackDriver: "employees",
    denominatorUnit: "suppliers",
    intensityFormula: "% audited / total critical suppliers (dimensionless)",
    fallbackFormula: "% (no driver needed for rate)",
    driverRequiredness: "optional",
    driverQualityImpact: "Spend helps segment 'critical' suppliers; without it, count-based ratio",
  },
  // G ─────────────────────────────────────────────────────────
  {
    indicatorId: "anti_corruption_training_rate",
    primaryDriver: "employees",
    fallbackDriver: "employees",
    denominatorUnit: "at_risk_roles",
    intensityFormula: "% trained / at-risk-role employees",
    fallbackFormula: "% trained / total employees (if role segmentation unavailable)",
    driverRequiredness: "recommended",
    driverQualityImpact: "Without role mapping, % over total FTE underestimates real coverage",
  },
  {
    indicatorId: "supplier_payment_days",
    primaryDriver: "employees",
    fallbackDriver: "employees",
    denominatorUnit: "days",
    intensityFormula: "days (absolute — no normalization)",
    fallbackFormula: "days",
    driverRequiredness: "optional",
    driverQualityImpact: "DPO is company-level absolute metric; peer benchmark by sector/size",
  },
  {
    indicatorId: "fines_penalties_eur",
    primaryDriver: "revenue_eur",
    fallbackDriver: "employees",
    denominatorUnit: "MEUR_revenue",
    intensityFormula: "EUR fines / MEUR revenue",
    fallbackFormula: "EUR fines / FTE (if revenue unavailable)",
    driverRequiredness: "recommended",
    driverQualityImpact: "Revenue normalization needed to compare across company sizes",
  },
];

// ============================================================
// Framework disclosure map (top priority mappings only)
// Full cross-reference — extend with additional frameworks later
// ============================================================

const FRAMEWORK_MAPS: Array<{
  indicatorId: string;
  framework: string;
  frameworkVersion: string;
  externalId: string;
  externalName: string;
  mappingType: "direct" | "derived" | "proxy" | "related";
  disclosureObligation: "mandatory" | "voluntary" | "conditional" | "sector_specific";
  validFrom?: Date | null;
  validTo?: Date | null;
  sourceReference?: string | null;
  notes?: string;
}> = [
  // ESRS
  { indicatorId: "scope_1_ghg_emissions", framework: "ESRS",
  frameworkVersion: "ESRS Set 1 (2023/2026)", externalId: "E1-6", externalName: "GHG emission reduction targets and GHG emissions", mappingType: "direct", disclosureObligation: "mandatory" },
  { indicatorId: "scope_2_location_based", framework: "ESRS",
  frameworkVersion: "ESRS Set 1 (2023/2026)", externalId: "E1-6", externalName: "Scope 2 GHG emissions (location-based)", mappingType: "direct", disclosureObligation: "mandatory" },
  { indicatorId: "scope_2_market_based", framework: "ESRS",
  frameworkVersion: "ESRS Set 1 (2023/2026)", externalId: "E1-6", externalName: "Scope 2 GHG emissions (market-based)", mappingType: "direct", disclosureObligation: "mandatory" },
  { indicatorId: "scope_3_total_ghg_emissions", framework: "ESRS",
  frameworkVersion: "ESRS Set 1 (2023/2026)", externalId: "E1-6", externalName: "Scope 3 GHG emissions", mappingType: "direct", disclosureObligation: "conditional", notes: "Mandatory for CSRD in-scope entities; material if significant" },
  { indicatorId: "total_energy_consumption", framework: "ESRS",
  frameworkVersion: "ESRS Set 1 (2023/2026)", externalId: "E1-5", externalName: "Energy consumption and mix", mappingType: "direct", disclosureObligation: "mandatory" },
  { indicatorId: "total_water_consumption", framework: "ESRS",
  frameworkVersion: "ESRS Set 1 (2023/2026)", externalId: "E3-4", externalName: "Water consumption", mappingType: "direct", disclosureObligation: "conditional" },
  { indicatorId: "total_waste_generated", framework: "ESRS",
  frameworkVersion: "ESRS Set 1 (2023/2026)", externalId: "E5-5", externalName: "Resource outflows", mappingType: "direct", disclosureObligation: "conditional" },
  { indicatorId: "injury_rate_ltifr", framework: "ESRS",
  frameworkVersion: "ESRS Set 1 (2023/2026)", externalId: "S1-14", externalName: "Work-related injuries and fatalities", mappingType: "direct", disclosureObligation: "mandatory" },
  { indicatorId: "training_hours_per_fte", framework: "ESRS",
  frameworkVersion: "ESRS Set 1 (2023/2026)", externalId: "S1-13", externalName: "Training and skills development", mappingType: "direct", disclosureObligation: "conditional" },
  { indicatorId: "anti_corruption_training_rate", framework: "ESRS",
  frameworkVersion: "ESRS Set 1 (2023/2026)", externalId: "G1-4", externalName: "Incidents of corruption or bribery", mappingType: "related", disclosureObligation: "conditional" },
  { indicatorId: "whistleblowing_channel_active", framework: "ESRS",
  frameworkVersion: "ESRS Set 1 (2023/2026)", externalId: "G1-1", externalName: "Business conduct policies", mappingType: "direct", disclosureObligation: "mandatory" },
  { indicatorId: "esg_governance_board_oversight", framework: "ESRS",
  frameworkVersion: "ESRS Set 1 (2023/2026)", externalId: "GOV-1", externalName: "Governance, risk management and internal control", mappingType: "direct", disclosureObligation: "mandatory" },

  // VSME
  { indicatorId: "scope_1_ghg_emissions", framework: "VSME",
  frameworkVersion: "VSME EFRAG ED (2023)", externalId: "B7", externalName: "GHG emissions (Scope 1 & 2)", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "scope_2_location_based", framework: "VSME",
  frameworkVersion: "VSME EFRAG ED (2023)", externalId: "B7", externalName: "GHG emissions (Scope 2)", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "total_energy_consumption", framework: "VSME",
  frameworkVersion: "VSME EFRAG ED (2023)", externalId: "B5", externalName: "Energy consumption", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "renewable_energy_share", framework: "VSME",
  frameworkVersion: "VSME EFRAG ED (2023)", externalId: "B6", externalName: "Energy from renewable sources", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "total_water_consumption", framework: "VSME",
  frameworkVersion: "VSME EFRAG ED (2023)", externalId: "B8", externalName: "Water usage", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "total_waste_generated", framework: "VSME",
  frameworkVersion: "VSME EFRAG ED (2023)", externalId: "B9", externalName: "Waste", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "total_fte", framework: "VSME",
  frameworkVersion: "VSME EFRAG ED (2023)", externalId: "B10", externalName: "Workforce data", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "training_hours_per_fte", framework: "VSME",
  frameworkVersion: "VSME EFRAG ED (2023)", externalId: "B11", externalName: "Training hours", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "injury_rate_ltifr", framework: "VSME",
  frameworkVersion: "VSME EFRAG ED (2023)", externalId: "B12", externalName: "Work-related injuries", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "esg_governance_board_oversight", framework: "VSME",
  frameworkVersion: "VSME EFRAG ED (2023)", externalId: "B1", externalName: "General basis for preparation", mappingType: "related", disclosureObligation: "voluntary" },

  // GRI (key mappings)
  { indicatorId: "scope_1_ghg_emissions", framework: "GRI",
  frameworkVersion: "GRI Standards 2021", externalId: "GRI 305-1", externalName: "Direct (Scope 1) GHG emissions", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "scope_2_location_based", framework: "GRI",
  frameworkVersion: "GRI Standards 2021", externalId: "GRI 305-2", externalName: "Energy indirect (Scope 2) GHG emissions", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "scope_3_total_ghg_emissions", framework: "GRI",
  frameworkVersion: "GRI Standards 2021", externalId: "GRI 305-3", externalName: "Other indirect (Scope 3) GHG emissions", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "total_energy_consumption", framework: "GRI",
  frameworkVersion: "GRI Standards 2021", externalId: "GRI 302-1", externalName: "Energy consumption within the organization", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "total_water_consumption", framework: "GRI",
  frameworkVersion: "GRI Standards 2021", externalId: "GRI 303-5", externalName: "Water consumption", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "total_waste_generated", framework: "GRI",
  frameworkVersion: "GRI Standards 2021", externalId: "GRI 306-3", externalName: "Waste generated", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "injury_rate_ltifr", framework: "GRI",
  frameworkVersion: "GRI Standards 2021", externalId: "GRI 403-9", externalName: "Work-related injuries", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "anti_corruption_training_rate", framework: "GRI",
  frameworkVersion: "GRI Standards 2021", externalId: "GRI 205-2", externalName: "Communication and training on anti-corruption policies", mappingType: "direct", disclosureObligation: "voluntary" },
  { indicatorId: "whistleblowing_channel_active", framework: "GRI",
  frameworkVersion: "GRI Standards 2021", externalId: "GRI 2-26", externalName: "Mechanisms for seeking advice and raising concerns", mappingType: "direct", disclosureObligation: "voluntary" },
];

// ============================================================
// Seed function
// ============================================================

export async function seedEsgIndicators(dryRun = false) {
  console.log(`\n=== Seed esg_indicators (dryRun=${dryRun}) ===`);

  const existing = await db.select({ id: esgIndicators.id }).from(esgIndicators);
  const existingIds = new Set(existing.map(e => e.id));

  let insInd = 0, skipInd = 0, insDrv = 0, insFmw = 0;

  // 1. esg_indicators
  for (const ind of INDICATORS) {
    if (existingIds.has(ind.id)) { skipInd++; continue; }
    if (!dryRun) {
      await db.insert(esgIndicators).values({
        id: ind.id,
        code: ind.code,
        name: ind.name,
        description: ind.description ?? null,
        pillar: ind.pillar,
        topic: ind.topic,
        canonicalUnit: ind.canonicalUnit ?? null,
        allowedUnits: ind.allowedUnits as any,
        metricType: ind.metricType,
        frameworkMappings: ind.frameworkMappings as any,
        materialityDefaultBySector: ind.materialityDefaultBySector as any,
        assuranceRelevance: ind.assuranceRelevance,
        vsmeDisclosureId: ind.vsmeDisclosureId ?? null,
        isActive: true,
      });
    }
    console.log(`  ${dryRun ? "DRY" : "INS"} [${ind.pillar}/${ind.topic}] ${ind.id}`);
    insInd++;
  }

  // 2. indicator_driver_map (delete + re-insert for idempotence)
  if (!dryRun) {
    await db.delete(indicatorDriverMap);
  }
  for (const d of DRIVER_MAP) {
    if (!dryRun) {
      await db.insert(indicatorDriverMap).values({
        indicatorId: d.indicatorId,
        primaryDriver: d.primaryDriver,
        secondaryDriver: d.secondaryDriver ?? null,
        fallbackDriver: d.fallbackDriver,
        denominatorUnit: d.denominatorUnit,
        intensityFormula: d.intensityFormula,
        fallbackFormula: d.fallbackFormula,
        driverRequiredness: d.driverRequiredness,
        driverQualityImpact: d.driverQualityImpact,
        notes: d.notes ?? null,
      });
    }
    insDrv++;
  }

  // 3. framework_disclosure_map (delete + re-insert for idempotence)
  if (!dryRun) {
    await db.delete(frameworkDisclosureMap);
  }
  for (const f of FRAMEWORK_MAPS) {
    if (!dryRun) {
      await db.insert(frameworkDisclosureMap).values({
        indicatorId: f.indicatorId,
        framework: f.framework,
        frameworkVersion: f.frameworkVersion ?? `${f.framework} (version TBD)`,
        externalId: f.externalId,
        externalName: f.externalName,
        mappingType: f.mappingType,
        disclosureObligation: f.disclosureObligation,
        validFrom: f.validFrom ?? null,
        validTo: f.validTo ?? null,
        sourceReference: f.sourceReference ?? null,
        notes: f.notes ?? null,
      });
    }
    insFmw++;
  }

  console.log(`\nDone:`);
  console.log(`  indicators: ${insInd} inserted, ${skipInd} skipped (${INDICATORS.length} total: E=${INDICATORS.filter(i=>i.pillar==="E").length}, S=${INDICATORS.filter(i=>i.pillar==="S").length}, G=${INDICATORS.filter(i=>i.pillar==="G").length})`);
  console.log(`  driver_map: ${insDrv} rows`);
  console.log(`  framework_map: ${insFmw} rows`);

  return { insInd, skipInd, insDrv, insFmw };
}

if (require.main === module) {
  const dryRun = process.argv.includes("--dry");
  seedEsgIndicators(dryRun)
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
}
