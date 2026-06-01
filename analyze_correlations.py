import pandas as pd
import numpy as np
import re
import os

# Configurazione
BASE_DIR = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità"
CSV_PATH = os.path.join(BASE_DIR, "bilanci_extract.csv")
OUTPUT_MD = os.path.join(BASE_DIR, "analisi_correlazioni.md")

def clean_numeric(val):
    if pd.isna(val) or val == "":
        return np.nan
    val = str(val).strip()
    # Rimuove tutto tranne numeri e virgole/punti
    val = re.sub(r'[^\d,.]', '', val)
    # Gestione formati italiani (es. 1.234,56 -> 1234.56)
    if ',' in val and '.' in val:
        val = val.replace('.', '').replace(',', '.')
    elif ',' in val:
        # Se ha solo la virgola, assumiamo sia decimale se ci sono 1-2 cifre dopo, 
        # altrimenti se ci sono 3 cifre potrebbe essere separatore migliaia.
        # Per sicurezza la trattiamo come decimale.
        val = val.replace(',', '.')
    
    try:
        return float(val)
    except:
        return np.nan

print("Caricamento dati...")
try:
    df = pd.read_csv(CSV_PATH, sep=';', encoding='utf-8-sig')
except Exception as e:
    print(f"Errore lettura CSV: {e}")
    exit(1)

# Colonne numeriche da analizzare
numeric_cols = [
    'dipendenti', 'fatturato_eur', 'mq_facility', 
    'scope1_tco2e', 'scope2_market_based', 'scope2_location_based', 
    'scope3_tco2e', 'energia_totale_mwh', 'energia_rinnovabile_pct', 
    'acqua_m3', 'rifiuti_pericolosi_t', 'rifiuti_non_pericolosi_t'
]

print("Pulizia dati numerici...")
for col in numeric_cols:
    if col in df.columns:
        df[col] = df[col].apply(clean_numeric)

# Filtriamo solo le righe che hanno almeno i dipendenti e lo Scope 1 o Energia
df_clean = df.dropna(subset=['dipendenti'], how='all')

print("Calcolo metriche derivate (Indici di Intensità)...")
# Calcoliamo i rapporti per trovare il "filo conduttore"
if 'scope1_tco2e' in df.columns and 'dipendenti' in df.columns:
    df['scope1_per_dipendente'] = df['scope1_tco2e'] / df['dipendenti']

if 'scope2_market_based' in df.columns and 'dipendenti' in df.columns:
    df['scope2_per_dipendente'] = df['scope2_market_based'] / df['dipendenti']

if 'energia_totale_mwh' in df.columns and 'dipendenti' in df.columns:
    df['energia_per_dipendente_mwh'] = df['energia_totale_mwh'] / df['dipendenti']

if 'energia_totale_mwh' in df.columns and 'mq_facility' in df.columns:
    df['energia_per_mq_mwh'] = df['energia_totale_mwh'] / df['mq_facility']

if 'fatturato_eur' in df.columns and 'scope1_tco2e' in df.columns:
    df['carbon_intensity_fatturato'] = df['scope1_tco2e'] / (df['fatturato_eur'] / 1e6) # tCO2e per milione di euro

# Calcolo Matrice di Correlazione
print("Generazione matrice di correlazione...")
correlation_matrix = df[numeric_cols].corr(method='spearman') # Usiamo Spearman perché i dati ESG non sono distribuiti normalmente

# Statistiche descrittive di base
stats = df[numeric_cols].describe()

# Creazione del Report Markdown
with open(OUTPUT_MD, 'w', encoding='utf-8') as f:
    f.write("# Analisi Statistica e Correlazioni Bilanci di Sostenibilità\n\n")
    f.write(f"**Campione analizzato:** {len(df)} documenti.\n")
    f.write("Questo documento esplora le correlazioni matematiche per fondare l'algoritmo predittivo.\n\n")

    f.write("## 1. Matrice di Correlazione (Indice di Spearman)\n")
    f.write("Valori vicini a 1 indicano una forte correlazione positiva. Valori vicini a 0 indicano assenza di correlazione.\n\n")
    f.write(correlation_matrix.round(2).to_markdown())
    f.write("\n\n")

    f.write("## 2. Analisi degli Indici di Intensità (Medie)\n")
    f.write("Questi moltiplicatori sono la base empirica per il motore di calcolo.\n\n")
    
    if 'scope1_per_dipendente' in df.columns:
        valid_s1 = df['scope1_per_dipendente'].dropna()
        if not valid_s1.empty:
            f.write(f"- **Scope 1 per Dipendente:** Media = {valid_s1.mean():.2f} tCO2e | Mediana = {valid_s1.median():.2f} tCO2e (su {len(valid_s1)} aziende valide)\n")
            
    if 'scope2_per_dipendente' in df.columns:
        valid_s2 = df['scope2_per_dipendente'].dropna()
        if not valid_s2.empty:
            f.write(f"- **Scope 2 (Market-based) per Dipendente:** Media = {valid_s2.mean():.2f} tCO2e | Mediana = {valid_s2.median():.2f} tCO2e\n")
            
    if 'energia_per_dipendente_mwh' in df.columns:
        valid_en = df['energia_per_dipendente_mwh'].dropna()
        if not valid_en.empty:
            f.write(f"- **Energia Totale per Dipendente:** Media = {valid_en.mean():.2f} MWh | Mediana = {valid_en.median():.2f} MWh\n")

    if 'energia_per_mq_mwh' in df.columns:
        valid_en_mq = df['energia_per_mq_mwh'].dropna()
        if not valid_en_mq.empty:
            f.write(f"- **Energia Totale per MQ:** Media = {valid_en_mq.mean():.4f} MWh/mq | Mediana = {valid_en_mq.median():.4f} MWh/mq\n")

    f.write("\n## 3. Statistiche Descrittive del Campione (Dati Assoluti)\n\n")
    f.write(stats.round(2).to_markdown())
    f.write("\n\n")
    
    f.write("## 4. Deduzioni per l'Algoritmo Predittivo\n")
    f.write("1. **Outliers:** Le medie pure sono spesso distorte dalle multinazionali ad alta intensità energetica. La **Mediana** è un indicatore più robusto per le PMI.\n")
    f.write("2. **Correlazione Dipendenti vs Emissioni:** Osservando la matrice, valutiamo se il numero di dipendenti scala linearmente con lo Scope 1 o con l'Energia Totale.\n")
    f.write("3. **Scope 3:** Se c'è correlazione con Scope 1+2, possiamo dedurre un moltiplicatore standard (es. Scope 3 = Scope 1+2 * 4.5).\n")

print(f"\nAnalisi completata! Risultati salvati in: {OUTPUT_MD}")
