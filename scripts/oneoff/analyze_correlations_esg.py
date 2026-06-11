import pandas as pd
import numpy as np
import re
import os

# Configurazione
BASE_DIR = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità"
CSV_PATH = os.path.join(BASE_DIR, "bilanci_esg_completo.csv")
OUTPUT_MD = os.path.join(BASE_DIR, "analisi_correlazioni_esg.md")

def clean_numeric(val):
    if pd.isna(val) or val == "":
        return np.nan
    val = str(val).strip()
    val = re.sub(r'[^\d,.]', '', val)
    if ',' in val and '.' in val:
        val = val.replace('.', '').replace(',', '.')
    elif ',' in val:
        val = val.replace(',', '.')
    try:
        return float(val)
    except:
        return np.nan

print("Caricamento dati E-S-G...")
try:
    df = pd.read_csv(CSV_PATH, sep=';', encoding='utf-8-sig')
except Exception as e:
    print(f"Errore lettura CSV: {e}")
    exit(1)

# Tutte le colonne numeriche estratte (Ambiente + Sociale + Governance)
numeric_cols = [
    'dipendenti', 'fatturato_eur', 'mq_facility', 
    'scope1_tco2e', 'scope2_market_based', 'scope3_tco2e', 
    'energia_totale_mwh', 'energia_rinnovabile_pct', 'acqua_m3', 
    'rifiuti_pericolosi_t', 
    'donne_manager_pct', 'gender_pay_gap_pct', 'ore_formazione_procapite', 'infortuni_lavoro',
    'incidenti_corruzione', 'fornitori_valutati_esg_pct'
]

print("Pulizia dati numerici...")
for col in numeric_cols:
    if col in df.columns:
        df[col] = df[col].apply(clean_numeric)

# Rimuovi file pdf irrilevanti (es. framework stessi) che non hanno dipendenti
df_clean = df.dropna(subset=['dipendenti'], how='all').copy()

print("Calcolo metriche derivate (Indici di Intensità)...")
if 'scope1_tco2e' in df_clean.columns and 'dipendenti' in df_clean.columns:
    df_clean['scope1_per_dipendente'] = df_clean['scope1_tco2e'] / df_clean['dipendenti']

if 'infortuni_lavoro' in df_clean.columns and 'dipendenti' in df_clean.columns:
    # Proxy per TRIR (Total Recordable Incident Rate), normalizzato su 100 dipendenti
    df_clean['infortuni_per_100_dipendenti'] = (df_clean['infortuni_lavoro'] / df_clean['dipendenti']) * 100

print("Generazione matrice di correlazione Olistica...")
# Matrice di Spearman (non parametrica) per vedere i legami non lineari
correlation_matrix = df_clean[numeric_cols].corr(method='spearman')

stats = df_clean[numeric_cols].describe()

with open(OUTPUT_MD, 'w', encoding='utf-8') as f:
    f.write("# Analisi Correlazioni E-S-G (Approccio Olistico CSRD)\n\n")
    f.write(f"**Campione analizzato:** {len(df_clean)} bilanci validi.\n")
    f.write("L'analisi include ora i pilastri Social e Governance, riflettendo la Doppia Materialità.\n\n")

    f.write("## 1. Matrice di Correlazione Completa\n")
    f.write(correlation_matrix.round(2).to_markdown())
    f.write("\n\n")

    f.write("## 2. Statistiche di Riferimento (Mediane per Baseline)\n")
    
    # ENVIRONMENT
    f.write("### Environment (E)\n")
    if 'scope1_per_dipendente' in df_clean.columns:
        f.write(f"- **Scope 1 per Dipendente (Mediana):** {df_clean['scope1_per_dipendente'].median():.2f} tCO2e\n")
    if 'energia_rinnovabile_pct' in df_clean.columns:
        f.write(f"- **Uso Energia Rinnovabile (Mediana):** {df_clean['energia_rinnovabile_pct'].median():.1f} %\n")
    
    # SOCIAL
    f.write("\n### Social (S)\n")
    if 'donne_manager_pct' in df_clean.columns:
        f.write(f"- **Donne in Posizioni Manageriali (Mediana):** {df_clean['donne_manager_pct'].median():.1f} %\n")
    if 'ore_formazione_procapite' in df_clean.columns:
        f.write(f"- **Ore Formazione pro-capite (Mediana):** {df_clean['ore_formazione_procapite'].median():.1f} ore/anno\n")
    if 'infortuni_per_100_dipendenti' in df_clean.columns:
        f.write(f"- **Infortuni per 100 dipendenti (Mediana):** {df_clean['infortuni_per_100_dipendenti'].median():.2f}\n")
    if 'gender_pay_gap_pct' in df_clean.columns:
        f.write(f"- **Gender Pay Gap (Mediana):** {df_clean['gender_pay_gap_pct'].median():.1f} %\n")

    # GOVERNANCE
    f.write("\n### Governance (G)\n")
    if 'incidenti_corruzione' in df_clean.columns:
        f.write(f"- **Incidenti di Corruzione (Mediana):** {df_clean['incidenti_corruzione'].median():.0f}\n")
    if 'fornitori_valutati_esg_pct' in df_clean.columns:
        f.write(f"- **Fornitori valutati su criteri ESG (Mediana):** {df_clean['fornitori_valutati_esg_pct'].median():.1f} %\n")

    f.write("\n## 3. Deduzioni per l'Algoritmo di SustainChain\n")
    f.write("1. **Oltre il Carbon Footprint:** L'azienda non inquina solo l'ambiente. Parametri come il *Gender Pay Gap* e le *Ore di Formazione* sono KPI critici del framework VSME (Modulo Basic B6 e Modulo PAT) che possiamo ora pre-compilare con benchmark realistici italiani.\n")
    f.write("2. **Correlazione Dimensionale:** Il tasso di infortuni e la % di donne manager spesso correlano con le dimensioni dell'azienda (dipendenti) o col settore, indicando che la baseline Sociale deve adattarsi all'ATECO proprio come quella Ambientale.\n")
    f.write("3. **Governance Binaria vs Continua:** Molti KPI di governance (es. Corruzione) non si stimano: la *Baseline deve essere 0*, e ogni valore diverso da 0 richiede documentazione legale obbligatoria.\n")

print(f"\nAnalisi Olistica completata! Risultati salvati in: {OUTPUT_MD}")
