# SustainChain Predictive Engine — MODEL CARD v1.0

> **"Build a calibrated ESG baseline engine, not an ESG guessing engine."**
>
> Il sistema non indovina la verità. Genera un **prior informativo difendibile**: profilo ESG
> probabile per un'azienda con quel settore, dimensione e driver operativi — con intervallo,
> metodo, fonte, qualità dati e possibilità di sostituzione tramite dato reale.
> **Il dato reale validato vince sempre.**

---

## 1. Scopo e limiti d'uso

Il motore predittivo SustainChain genera **stime baseline ESG** a partire da profili aziendali
minimi (settore ATECO, dipendenti, eventualmente revenue/area/flotta). Le stime sono pensate per:

- **Rompere il "foglio bianco"** della raccolta dati ESG per PMI
- **Pre-compilare** la reportistica VSME/ESRS con un punto di partenza verificabile
- **Identificare hotspot** prioritari su cui raccogliere dato reale
- **Calibrare le aspettative** del consulente e dell'azienda prima della diagnosi

### Non è appropriato per:

- Comunicazione esterna come "dato ESG reale" senza disclosure del metodo
- Sostituzione della misurazione primaria per KPI materiali obbligatori CSRD
- Compliance audit (le stime non sostituiscono evidenza verificata/assurance)
- Confronto competitivo pubblico senza benchmarking indipendente

---

## 2. Architettura a tre livelli

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3 — Normative & Certification                        │
│  esgIndicators, frameworkDisclosureMap, certificationRecords│
│  (cosa misurare, quale obbligazione, quale evidenza)        │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — Evidence                                         │
│  datapointValues, evidenceLinks, userConfirmations          │
│  (dato stimato vs estratto vs validato vs certificato)      │
├─────────────────────────────────────────────────────────────┤
│  Layer 1 — Estimation                                       │
│  sectorDistributions, predictionRuns, predictions           │
│  (distribuzioni empiriche + Bayes shrinkage + fallback)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Pipeline di stima

### 3.1 Normalizzazione a intensità

I valori osservati nel corpus (sustainability reports) sono normalizzati per driver prima
di calcolare distribuzioni settoriali. Questo elimina il bias dimensionale (grandi vs piccole).

```
intensity = KPI_absolute / driver_value
```

Driver per indicatore (vedi `indicator_driver_map`):

| Indicatore | Driver primario | Driver secondario | Fallback |
|---|---|---|---|
| Scope 1 GHG | employees (FTE) | revenue_eur | employees |
| Scope 2 LB/MB | facility_area_sqm | employees | employees |
| Scope 3 totale | revenue_eur | employees | employees |
| Energia totale | facility_area_sqm | employees | employees |
| Acqua | employees | revenue_eur | employees |
| Rifiuti | employees | revenue_eur | employees |
| LTIFR | hours_worked | employees (×2000h) | employees |
| Formazione h/FTE | employees | — | employees |

De-normalizzazione per la predizione:
```
predicted_absolute = intensity_median × company_driver_value
p25_absolute = intensity_p25 × company_driver_value
p75_absolute = intensity_p75 × company_driver_value
```

### 3.2 Clustering

Cluster = `{settore_ATECO, size_class}` — 7 settori × 3 classi dimensionali = 21 cluster.

Settori: meccatronica (25-30), agroalimentare (01-12), moda_tessile (13-15),
chimico_plastico (20-22), edilizia_impiantistica (41-43), utilities (35-53), gdo_retail (45-47).

Size class: micro (1-9 FTE), small (10-49 FTE), medium (50-249 FTE).
> ⚠️ **Nota bias corpus**: il corpus iniziale contiene 20 grandi aziende italiane quotate. I valori
> assoluti sono normalizzati in intensità per mitigare il bias, ma le distribuzioni settoriali per
> PMI saranno più precise solo quando i dati flywheel (clienti reali) arricchiranno il corpus.

### 3.3 Fallback gerarchico (tre tier)

```
Tier 1: cluster specifico (ATECO + size)   → se N ≥ 5
         ↓ se no
Tier 2: macro-settore (es. manifattura_leggera) → media cluster omologhi
         ↓ se no
Tier 3: generateBaseline() rule-based nazionale → coefficienti settoriali fissi
```

### 3.4 Empirical Bayes shrinkage

Per N bassi (N < 15), la distribuzione cluster viene "shrunk" verso il prior macro-settore:

```
θ̂ = w × θ_cluster + (1-w) × θ_macro_sector
w = N / (N + K),  K = 15 (prior equivalent sample size)
```

Con K=15: se N=5 → w=0.25 (75% macro-sector); se N=15 → w=0.50; se N=30 → w=0.67.

---

## 4. Output obbligatorio per ogni predizione

Ogni `prediction` deve contenere:

| Campo | Tipo | Descrizione |
|---|---|---|
| `indicator_id` | text | Slug canonico (da `esg_indicators.id`) |
| `predicted_value` | numeric | Stima centrale (de-normalizzata) |
| `p25_value` | numeric | Primo quartile |
| `p75_value` | numeric | Terzo quartile |
| `p10_value` | numeric | Decile inferiore (incertezza ampia) |
| `p90_value` | numeric | Decile superiore |
| `unit` | text | Unità canonica (tCO2e, kWh, %) |
| `confidence` | Alta/Media/Bassa | Vedi regole §5 |
| `fallback_level` | cluster/macro_sector/national | Tier usato |
| `n_sample_used` | integer | N osservazioni nella distribuzione |
| `shrinkage_weight_used` | numeric | w ∈ [0,1] |
| `interval_width_ratio` | numeric | (p90-p10)/p50 — flag se >3.0 |
| `data_quality_score` | numeric 0-1 | Qualità composita |
| `method` | text | peer_median / hierarchical_shrinkage / rule_based_proxy |
| `driver_used` | text | Driver effettivo usato |
| `denominator_value` | numeric | Valore del driver del profilo azienda |
| `evidence_to_request` | jsonb | Lista evidenze da chiedere all'utente |
| `assumptions` | text | Assunzioni esplicite della stima |
| `limitations` | text | Limiti e contesto di applicabilità |
| `requires_human_validation` | boolean | Sempre true per quantitative_absolute |
| `rationale` | text | Spiegazione narrativa per l'utente |
| `state` | proposed/confirmed/corrected/rejected | Stato flywheel |

---

## 5. Regole di confidence

```
Alta:  N_cluster ≥ 30  AND  shrinkage_weight ≥ 0.8  AND  sharpness < 3.0
Media: N_cluster ≥ 10  AND  sharpness < 5.0
Bassa: altrimenti (N < 10, fallback macro, sharpness > 5, Tier 3 nazionale)
```

> ⚠️ **Cap attuale: max "Media"**. Finché il corpus è composto da sole aziende quotate
> (non PMI target), la confidence viene capped a "Media" indipendentemente da N e sharpness.
> Il cap si rimuove quando >30% del corpus è costituito da dati primari di PMI clienti.

### Certificazioni e confidence

Una certificazione ISO/SA8000/B Corp può aumentare la confidence sulla **presenza di un sistema
di gestione o controllo**. NON modifica automaticamente la stima quantitativa di emissioni,
energia, acqua, rifiuti o infortuni.

Regola: `certification_records.confidence_boost_allowed = true` consente un upgrade di confidence
solo per `metric_type IN ('boolean_control', 'categorical_maturity', 'evidence_required')`.
Mai per `quantitative_absolute`.

---

## 6. Trattamento differenziato E, S, G

### Pillar E — Environmental

- Driver fisici/economici (FTE, area, revenue, flotta)
- Output: valori assoluti de-normalizzati da intensità
- Copertura attuale: Scope 1, Scope 2 LB/MB, Scope 3, energia, acqua, rifiuti, biodiversità
- Metodo: peer_median / hierarchical_shrinkage

### Pillar S — Social

- Per KPI quantitativi (LTIFR, turnover, formazione): peer_median su intensità
- Per controlli/policy (ISO 45001, policy diritti umani, meccanismo reclamo):
  output = probabilità di disclosure + maturity_score + evidence_to_request
- **Non inventare** dati sensibili (salari, incidenti) senza evidenza: fornire range + richiesta dato
- Copertura: S1 propria forza lavoro, S2 catena valore, S3 comunità, S4 consumatori

### Pillar G — Governance

- Modello control-based: stima presenza controllo, probabilità disclosure, gap normativo
- **Non inventare** composizione CdA o policy non osservate: fornire benchmark peer + richiesta
- Output primario: boolean_control (whistleblowing, governance ESG, policy AC) + percentuali
- Copertura: G1 business conduct, anti-corruzione, pagamenti fornitori, sanzioni

---

## 7. Gate di validazione (G3.x)

| Gate | Metrica | Target | Metodo |
|---|---|---|---|
| G3.1 | Hit rate: actual ∈ [p25, p75] | ≥ 70% | Backtest held-out 5 aziende |
| G3.2 | Coverage: actual ∈ [p10, p90] | ≥ 80% | Backtest held-out |
| G3.3 | Interval width ratio (p90-p10)/p50 ≤ 3 | ≥ 60% celle | Per distribuzione |
| G3.4 | Point estimate MAPE | ≤ 50% | Backtest held-out |
| G3.5 | Hotspot ranking: top-3 impatti identificati | ≥ 70% | Qualitative check |
| G3.6 | Fallback transparency: ogni stima con fallback_level dichiarato | 100% | Automatico |
| G3.7 | Data quality score: ogni stima con data_quality_score | 100% | Automatico |
| G3.8 | Framework traceability: ogni KPI mappato ad almeno 1 framework | 100% | Via framework_disclosure_map |
| G3.9 | Certification evidence: certs non modificano quantitative_absolute | 100% | Rule enforcement |
| G3.10 | Human override: dato reale validato > stima | 100% | State machine enforcement |

---

## 8. Bias e limitazioni dichiarate

1. **Source bias (corpus)**: il corpus v1.0 contiene 20 grandi aziende italiane quotate. Le PMI
   target hanno tipicamente profili di intensità diversi, specialmente per Scope 3 (supply chain
   meno strutturata) e S (minor formalizzazione). Questo bias è **dichiarato nel campo
   `limitations` di ogni prediction** e nel rationale.

2. **Driver mancanti al primo onboarding**: revenue e area spesso non sono disponibili al primo
   accesso. Il sistema usa FTE come fallback, il che aumenta `interval_width_ratio` specialmente
   per Scope 3 e energia. `evidence_to_request` elenca i driver mancanti da raccogliere.

3. **N basso per cluster rari**: micro-aziende (1-9 FTE) in settori chimici o utilities hanno
   N < 5 nel corpus iniziale → Tier 2 fallback quasi certo → confidence "Bassa" automatica.

4. **Scope 3 alta incertezza strutturale**: anche con N elevato, `interval_width_ratio` per
   Scope 3 è tipicamente > 4x a causa dell'eterogeneità dei modelli di business e delle
   catene di fornitura. Questo è **atteso e non un difetto**: riflette l'incertezza reale.

5. **S e G: corpus limitato**: le metriche sociali e di governance non hanno ancora distribuzioni
   empiriche (corpus attuale = solo E). Le stime S/G in v1.0 sono basate su rule_based_proxy
   (generateBaseline) con confidence "Bassa". Migliorerà con flywheel.

---

## 9. Versionamento

| Campo | Tabella | Scopo |
|---|---|---|
| `version` | sector_distributions | Versione del corpus/metodo usato |
| `distribution_version` | prediction_runs | Versione distribuzioni al momento della prediction |
| `model_version` | (da aggiungere a prediction_runs v1.1) | Versione algoritmo predittivo |
| `state` | predictions | proposed→confirmed→corrected→rejected |
| `used_in_recompute` | user_confirmations | Flywheel: il dato cliente entra nel corpus |

Le stime `proposed` vengono archiviate. Se l'utente corregge (`corrected`), il valore finale
è `final_value`. Il dato originale rimane in `predicted_value` per audit.

---

## 10. Compliance e trasparenza AI (AI Act)

SustainChain usa modelli AI per:
- Estrazione da documenti (extraction pipeline — Fase 8)
- Sintesi narrativa (rationale, comunicazione) — LLM frozen, non per stima statistica

Le stime quantitative del predictive engine **non usano LLM**: sono calcoli deterministici
su distribuzioni empiriche. Questo è dichiarato nell'output (`method != 'llm_generated'`).

Ogni prediction include:
- `model_version`: versione algoritmo
- `method`: metodo statistico usato
- `source_distribution_id`: FK alla distribuzione usata
- `rationale`: spiegazione human-readable (non generata da LLM per quantitative)

Conformità AI Act: il sistema è classificato come **low-risk** (decision support, human-in-the-loop
obbligatorio per tutti i valori quantitative_absolute). L'utente può sempre visualizzare
il metodo, rifiutare e sovrascrivere ogni stima.

---

## 11. Roadmap

| Fase | Priorità | Dipendenza |
|---|---|---|
| v1.0 — E baseline da 20 report | Completata in sviluppo | — |
| v1.1 — p10/p90 + data_quality_score | In sviluppo | computeDistributions update |
| v1.2 — S/G rule-based proxy | In sviluppo | seed-esg-indicators + backtest S/G |
| v2.0 — Flywheel: clienti reali PMI | Post-primo cliente | user_confirmations + recompute |
| v2.1 — Corpus stratificato 100-150 report | Sprint P-A | Canonical extraction layer |
| v3.0 — Quantile regression ML | Post 500+ osservazioni pulite | Gate G3.x PASS |

---

*Generato: 2026-06-16 | Versione: 1.0 | Autore: SustainChain Engineering*
*Checkpoint revisione: 2026-07-15 (gate Fase 0 + P-A → decisione apertura P-B e canale commerciale)*
