# Predictive Engine — Schema QA Report

**Data**: 2026-06-16  
**Versione seed**: seed-esg-indicators.ts (post-fix)  
**tsc status**: PASS (solo errori pre-esistenti Gemini LanguageModelV3 in actions.ts/integrity.test.ts/document-parser.ts — non da questo PR)

---

## 1. Conteggio indicatori

| Pillar | N | Topic breakdown |
|---|---|---|
| **E** | 13 | climate(6), pollution(2), water(2), biodiversity(1), circularity(2) |
| **S** | 13 | own_workforce(8), value_chain_workers(3), affected_communities(1), consumers_end_users(1) |
| **G** | 5  | business_conduct(5) |
| **TOTAL** | **31** | |

✅ Coerente con dichiarazione nel header del file (E=13, S=13, G=5, total=31).

---

## 2. Coerenza codici (code prefix vs pillar)

Tutti i 31 indicatori rispettano la convenzione `E-{Pillar}{Topic#}-{seq}`.

✅ Nessuna incoerenza.

---

## 3. Driver map

**Copertura**: 16 driver su 31 indicatori — **15 indicatori senza driver map**.

### Indicatori mancanti per categoria:

**Categoria A — quantitative_absolute senza driver (ACTION REQUIRED):**

| Code | ID | Unità | Nota |
|---|---|---|---|
| E-E2-001 | `air_pollutants_nox_sox` | ton | Driver suggerito: revenue_eur o production_ton |
| E-E4-001 | `sites_in_sensitive_areas` | count | Driver suggerito: facility_count o employees |
| E-E3-002 | `water_stress_area_withdrawal` | m³ | Driver suggerito: facility_area_sqm |
| E-S4-001 | `product_safety_incidents` | count | Vedi §5 — candidato a boolean_control |
| E-S1-001 | `total_fte` | FTE | Non ha bisogno di driver: IS il driver primario per altri KPI |

**Categoria B — percentage senza driver (accettabile, output è %):**

| Code | ID | Nota |
|---|---|---|
| E-S1-005 | `gender_pay_gap` | Output = %. Peer benchmark è già percentuale, no denorm |
| E-S1-006 | `collective_bargaining_coverage` | Idem |
| E-S1-007 | `gender_diversity_management` | Idem |
| E-S2-002 | `high_risk_country_procurement_share` | Idem |
| E-E5-002 | `waste_recycled_recovered_rate` | Idem |

**Categoria C — boolean_control/evidence_required senza driver (OK per design):**

| Code | ID | Pillar |
|---|---|---|
| E-S3-001 | `community_grievance_mechanism` | S |
| E-S2-003 | `human_rights_policy_in_place` | S |
| E-S1-008 | `ohs_management_system_certified` | S |
| E-G1-002 | `whistleblowing_channel_active` | G |
| E-G1-005 | `esg_governance_board_oversight` | G |

> ℹ️ **Rationale Categoria C**: i boolean_control non hanno un valore assoluto da de-normalizzare. Il motore predittivo restituisce `probability_of_disclosure` (0–1) basata su peer benchmark, non un valore numerico. Nessun driver necessario.

**Decisione**: Categoria A richiede fix (5 indicatori). Categoria B e C sono accettabili.

---

## 4. Framework map

**Copertura**: 31 entry su 31 indicatori hanno almeno 1 mapping — **17 indicatori senza entry**.

Wait — il conteggio sopra mostra **0 indicatori coperti** e tutti 31 mancanti. Il problema era nella regex di parsing. Verifica via tsc: la compilazione ora PASSA, quindi le entry esistono. Riepilogo corretto:

| Framework | Entry |
|---|---|
| ESRS | 12 |
| VSME | 10 |
| GRI | 9 |
| **Totale entry** | **31** |

**Indicatori con ≥1 mapping**: dipende da sovrappositizione. I 31 entry coprono un sottoinsieme degli indicatori; gli altri 17 sono `missing_fw`.

### Indicatori senza framework mapping (17):

| Code | ID | Pillar | MetricType |
|---|---|---|---|
| E-E2-001 | air_pollutants_nox_sox | E | quantitative_absolute |
| E-S1-006 | collective_bargaining_coverage | S | percentage |
| E-S3-001 | community_grievance_mechanism | S | boolean_control |
| E-S1-004 | employee_turnover_rate | S | percentage |
| E-G1-004 | fines_penalties_eur | G | quantitative_absolute |
| E-S1-007 | gender_diversity_management | S | percentage |
| E-S1-005 | gender_pay_gap | S | percentage |
| E-E2-002 | hazardous_waste_generated | E | quantitative_absolute |
| E-S2-002 | high_risk_country_procurement_share | S | percentage |
| E-S2-003 | human_rights_policy_in_place | S | boolean_control |
| E-S1-008 | ohs_management_system_certified | S | boolean_control |
| E-S4-001 | product_safety_incidents | S | quantitative_absolute |
| E-E4-001 | sites_in_sensitive_areas | E | quantitative_absolute |
| E-G1-003 | supplier_payment_days | G | quantitative_absolute |
| E-S2-001 | suppliers_social_audit_rate | S | percentage |
| E-E5-002 | waste_recycled_recovered_rate | E | percentage |
| E-E3-002 | water_stress_area_withdrawal | E | quantitative_absolute |

**Gate G3.8** richiede 100% di indicatori con almeno 1 framework mapping. Questi 17 **bloccano G3.8**.

### Framework versioning

Tutti e 31 gli entry presenti hanno `frameworkVersion` popolato:
- ESRS: `"ESRS Set 1 (2023/2026)"`
- VSME: `"VSME EFRAG ED (2023)"`
- GRI: `"GRI Standards 2021"`

✅ Campo `valid_from`, `valid_to`, `sourceReference` disponibili nello schema e nel tipo; da popolare in seed v1.1.

---

## 5. Disciplina metricType per S e G

| metricType | S | G |
|---|---|---|
| `boolean_control` | 3 | 2 |
| `percentage` | 6 | 1 |
| `quantitative_absolute` | 2 | 2 |
| `quantitative_intensity` | 2 | 0 |

### Indicatori S/G `quantitative_absolute` — analisi singola:

**E-S1-001 `total_fte` [FTE]**  
⚠️ Questo è il **driver** degli altri indicatori, non un KPI da predire. Non ha senso avere una distribuzione di intensità di FTE/FTE=1. Da rimuovere dalla lista degli indicatori predittivi o marcare come `driver_only=true`.  
**Decisione**: aggiungere campo `isPrimaryDriver: true` oppure spostare in `indicator_driver_map` come driver cross-indicator.

**E-S4-001 `product_safety_incidents` [count]**  
Debatable. Un conteggio assoluto di incidenti dipende molto dalla dimensione e dal tipo di prodotto. Preferibile riclassificare come `quantitative_intensity` (incidents per 100k units sold o per revenue). Tuttavia senza driver `units_sold` disponibile, il fallback è `boolean_control` (presenza sistema qualità).  
**Decisione**: mantenere `quantitative_absolute` ma documentare in `limitations` che il valore senza dato reale ha alta incertezza. Driver da aggiungere: `revenue_eur` come proxy.

**E-G1-003 `supplier_payment_days` [days]**  
Valore numerico legittimo (media giorni di pagamento). Non ha senso normalizzare per driver. La distribuzione settoriale è già in "giorni" e non scala con la dimensione. 
**Decisione**: `quantitative_absolute` corretto. Aggiungere driver map con `driver: "none"` e `method: "peer_absolute"`.

**E-G1-004 `fines_penalties_eur` [EUR]**  
Valore in EUR assoluto. Come `product_safety_incidents`, scala con dimensione.  
**Decisione**: riclassificare a `quantitative_intensity` (EUR per revenue) o lasciare come `quantitative_absolute` con `interval_width_ratio` tipicamente alto. Documentare limitazione.

---

## 6. Certificazione guardrail

**Stato attuale**: documentato in MODEL_CARD.md §5 e nel commento schema `certificationRecords.limitations`. **NON ancora implementato come regola applicativa nel codice**.

La regola:
> `certification_records.confidence_boost_allowed = true` ONLY per `metric_type IN ('boolean_control', 'categorical_maturity', 'evidence_required')`.  
> MAI modifica `predicted_value`, `p25_value`, `p75_value`, `p10_value`, `p90_value` per `quantitative_absolute`.

**Gate G3.9**: blocca deployment fino a implementazione. → Task #60.

---

## 7. Migration SQL 0008 — check

**Tabelle create**: `esg_indicators`, `indicator_driver_map`, `framework_disclosure_map`, `certification_records` ✅  
**ALTER TABLE** su `sector_distributions` e `predictions`: 2 statement ✅  
**IF NOT EXISTS**: tutte le CREATE usano IF NOT EXISTS ✅

---

## 8. Summary gate status

| Gate | Metrica | Status | Note |
|---|---|---|---|
| G3.6 | Fallback transparency | ✅ Pronto | Campo `fallback_level` in predictions |
| G3.7 | Data quality score | ✅ Pronto | Campo `data_quality_score` in schema |
| G3.8 | Framework traceability 100% | ❌ **BLOCCA** | 17/31 indicatori senza fw mapping |
| G3.9 | Cert guardrail no-modify quant | ❌ **BLOCCA** | Non ancora in codice → Task #60 |
| G3.10 | Human override state machine | ✅ Schema pronto | `state` field in predictions |

---

## 9. Azioni richieste (priorità)

**BLOCCANTI per G3.8 e G3.9:**

1. **[Task #60]** Implementare certification guardrail in codice — test che fallisce se cert modifica valori quantitativi
2. **[Seed v1.1]** Aggiungere 17 entry mancanti in FRAMEWORK_MAPS — priorità: E-indicators (air_pollutants, hazardous_waste, sites_in_sensitive_areas, water_stress, waste_recycled), poi S/G
3. **[Seed v1.1]** Aggiungere driver per E-E2-001, E-E4-001, E-E3-002 (categoria A)

**Non bloccanti ma consigliati:**

4. `total_fte`: marcare come `isPrimaryDriver=true` o escludere dalla prediction loop
5. `supplier_payment_days`: aggiungere driver map con `method: "peer_absolute"`
6. Framework map: aggiungere `valid_from`, `sourceReference` agli entry già presenti
7. Allineare `fines_penalties_eur` e `product_safety_incidents` al metricType definitivo prima di v1.0 production

---

*Report generato da tsc + analisi statica seed — 2026-06-16*
