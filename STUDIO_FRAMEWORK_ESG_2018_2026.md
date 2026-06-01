# Studio dell'Ecosistema ESG: Evoluzione Framework, Normative e Certificazioni (2018-2026)

Questo documento sintetizza lo studio massivo condotto sui framework internazionali, le normative europee, le leggi italiane, le certificazioni e le pratiche delle società di consulenza, allo scopo di ridefinire l'algoritmo predittivo e architetturale di **SustainChain**.

---

## 1. L'Evoluzione dei Framework: Da Volontario a Obbligatorio (2018 - Oggi)

Il panorama del reporting è passato da un'era di frammentazione (la cosiddetta "alphabet soup") a un'era di consolidamento e obblighi normativi.

### A. L'Era NFRD (2014-2023)
*   **Contesto:** La *Non-Financial Reporting Directive* (recepita in Italia col D.Lgs 254/2016) obbligava solo le grandissime aziende (EIP - Enti di Interesse Pubblico con >500 dipendenti).
*   **Problema:** L'approccio era "comply or explain". Le aziende usavano framework diversi (GRI, SASB, IIRC, TCFD), rendendo impossibile la comparabilità per gli investitori. L'enfasi era sul termine "Non-Finanziario", spesso relegato al marketing (CSR).

### B. Il "Big Move" e il consolidamento globale (2020-2022)
*   Sotto la spinta degli investitori (BlackRock, ecc.), i principali standard-setter hanno unito le forze.
*   Nasce l'**ISSB (International Sustainability Standards Board)** sotto l'egida dell'IFRS (chi fa le regole contabili globali). L'ISSB ha inglobato SASB e CDSB.
*   **Risultato:** IFRS S1 e IFRS S2 (pubblicati nel 2023) creano la *global baseline* basata sulla **Materialità Finanziaria** (come il clima impatta il bilancio dell'azienda).

### C. La Rivoluzione Europea: CSRD ed ESRS (2024-Oggi)
*   La **CSRD (Corporate Sustainability Reporting Directive)** sostituisce la NFRD, estendendo l'obbligo a ~50.000 imprese (incluse le grandi non quotate e, in futuro, le PMI quotate).
*   **La regola:** Niente più "comply or explain". Le aziende devono usare un unico standard obbligatorio: gli **ESRS (European Sustainability Reporting Standards)** stilati dall'EFRAG.
*   **Il Principio Cardine - La Doppia Materialità:** A differenza dell'ISSB, l'Europa obbliga a misurare l'impatto "Inside-Out" (impatto dell'azienda su persone/ambiente) E l'impatto "Outside-In" (rischi ESG sul conto economico).
*   **Assurance Obbligatoria:** I dati ESG devono essere certificati da revisori esterni (limited assurance), parificandoli ai dati finanziari.

### D. Il VSME (Voluntary SME Standard)
*   Creato dall'EFRAG per le **PMI non quotate** che sono fuori dall'obbligo CSRD ma fanno parte della catena di fornitura (Scope 3) delle grandi aziende.
*   È un set semplificato di indicatori (Basic Module) che protegge le PMI dal cosiddetto *trickle-down effect* (le grandi aziende che scaricano obblighi documentali asfissianti sui piccoli fornitori). **È il vero target market di SustainChain**.

---

## 2. Architettura dei Report: I Pilastri E, S, G

La sostenibilità non è solo "Carbon Footprint". Un report fallisce se non bilancia i tre pilastri.

### Environment (Ambiente)
*   **Metriche:** GHG Scope 1, 2, 3; Energia, Acqua, Rifiuti, Biodiversità (ESRS E1-E5).
*   **Certificazioni Rilevanti:**
    *   **ISO 14001 / EMAS:** Sistemi di gestione ambientale. L'EMAS richiede una dichiarazione pubblica.
    *   **Zero Waste:** Certifica che un'alta percentuale (es. >90%) dei rifiuti viene deviata dalla discarica (riciclo/recupero).
    *   **Carbon Trust / SBTi:** Certificano la validità dei target di decarbonizzazione aziendali basati sulla scienza.

### Social (Sociale)
*   **Metriche:** Forza lavoro, Salute e Sicurezza, Formazione, Gender Pay Gap, Lavoro minorile nella catena di fornitura (ESRS S1-S4).
*   **Certificazioni Rilevanti:**
    *   **SA8000:** Lo standard etico per eccellenza sulle condizioni di lavoro.
    *   **ISO 45001:** Salute e sicurezza sul lavoro (previene infortuni/morti).
    *   **UNI/PdR 125:2022 (Italia):** Certificazione per la Parità di Genere (porta sgravi contributivi).
    *   **Great Place to Work:** Basato sul "Trust Index", certifica il clima aziendale e il benessere dei dipendenti.

### Governance (Governo Societario)
*   **Metriche:** Etica aziendale, Anticorruzione, Sicurezza dei Dati, Gestione dei Rischi, Screening ESG dei fornitori (ESRS G1).
*   **Certificazioni / Forme Giuridiche Rilevanti:**
    *   **ISO 37001:** Sistema di gestione Anticorruzione.
    *   **Società Benefit (Legge Italiana 208/2015):** Forma giuridica. L'azienda inserisce nello Statuto il "beneficio comune". Obbligo di Relazione d'Impatto annuale.
    *   **B Corp:** Certificazione privata (B Lab) estremamente rigorosa (BIA - B Impact Assessment). Valuta l'azienda a 360° con un punteggio (pass mark >80).

---

## 3. Pratiche delle Società di Consulenza (Big 4 & Boutique)

*   **PwC / Deloitte / EY / KPMG:** Dominano l'auditing (Assurance). I loro report spingono molto sulla "Digitalizzazione ESG" e sulla raccolta dati tracciabile. Esempi: *PwC* usa casi studio avanzati come l'uso dei droni per calcolare i KPI ambientali; *Deloitte* promuove il ruolo del Sustainability Manager.
*   **TEHA (The European House - Ambrosetti):** Approccio strategico di alto livello. Creano "Position Paper" e Piani di Sostenibilità Pluriennali per guidare i CdA, focalizzandosi sulle opportunità di mercato della transizione.
*   **Altis Università Cattolica:** Approccio accademico e metodologico. Creano indici e rating specifici per le PMI, puntando molto sul concetto di "impatto territoriale" e formazione.

---

## 4. Ripercussioni sull'Algoritmo di SustainChain

Alla luce di questo studio, la logica di calcolo matematico pura ("quante tonnellate produce 1 dipendente") è insufficiente. 

L'algoritmo di **SustainChain** deve evolversi in un **Motore di Materialità e Assessment Normativo**:

1.  **Dinamicità basata sul SASB/ESRS Sector:** A seconda dell'ATECO, il motore deve attivare o disattivare interi blocchi del report.
    *   *Azienda IT (Servizi):* Il motore non deve chiedere consumi idrici industriali, ma attivare subito moduli su **ISO 27001 (Data Privacy)**, **UNI/PdR 125 (Gender Gap)** e smart working.
    *   *Azienda Chimica:* Il motore attiva immediatamente il modulo **EMAS**, i controlli sui rifiuti pericolosi (Scope 1/3) e la ISO 45001 per la sicurezza impianti.
2.  **La Checklist Documentale "E-S-G":** Il *Preparation Layer* non deve generare solo stime di kWh, ma una **To-Do List di Governance**.
    *   "Hai un Modello 231?"
    *   "Hai una Policy Anticorruzione?"
    *   "Quante ore di formazione hai erogato?"
3.  **Il Valore delle Certificazioni:** Il sistema deve dedurre dati dalle certificazioni. Se un'azienda dichiara di avere la **SA8000**, il sistema può automaticamente impostare "Confidence: Alta" per i datapoint relativi ai diritti dei lavoratori (VSME Social).

La sostenibilità è compliance, strategia e rischio, non solo un contatore energetico.
