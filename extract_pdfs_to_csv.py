import os
import fitz  # PyMuPDF
import pdfplumber
import pandas as pd
import re

# Configurazione cartelle
BASE_DIR = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità"
PDF_DIR = os.path.join(BASE_DIR, "bilanci_sostenibilita")
OUTPUT_CSV = os.path.join(BASE_DIR, "bilanci_extract.csv")

# Dizionario dei pattern regex strutturati per l'estrazione
# Ogni chiave corrisponde a una colonna del CSV. 
# Il valore è una tupla: (lista_di_regex_per_catturare_valore, lista_di_keyword_per_isolare_contesto)
EXTRACTION_PATTERNS = {
    'dipendenti': (
        [r'(?i)(?:numero\s+di\s+dipendenti|totale\s+dipendenti|headcount|organico).*?(\d{1,3}(?:\.\d{3})*)'],
        ['dipendenti', 'organico', 'headcount', 'personale']
    ),
    'fatturato_eur': (
        [r'(?i)(?:fatturato|ricavi|valore\s+economico\s+generato).*?€?\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:milioni|mln|mila|€)'],
        ['fatturato', 'ricavi', 'valore economico']
    ),
    'mq_facility': (
        [r'(?i)(?:superficie|area|stabilimento|metri\s+quadrati|mq|m2).*?(\d{1,3}(?:\.\d{3})*)'],
        ['superficie', 'area', 'stabilimento', 'mq', 'm2']
    ),
    'scope1_tco2e': (
        [r'(?i)(?:scope\s*1|emissioni\s+dirette).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:tco2e|tonnellate|t\s*co2)'],
        ['scope 1', 'emissioni dirette']
    ),
    'scope2_market_based': (
        [r'(?i)(?:scope\s*2).*?(?:market[-\s]based).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:tco2e|tonnellate|t\s*co2)'],
        ['scope 2', 'market based', 'market-based']
    ),
    'scope2_location_based': (
        [r'(?i)(?:scope\s*2).*?(?:location[-\s]based).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:tco2e|tonnellate|t\s*co2)'],
        ['scope 2', 'location based', 'location-based']
    ),
    'scope3_tco2e': (
        [r'(?i)(?:scope\s*3|emissioni\s+indirette).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:tco2e|tonnellate|t\s*co2)'],
        ['scope 3', 'emissioni indirette']
    ),
    'energia_totale_mwh': (
        [r'(?i)(?:consumo\s+energetico\s+totale|energia\s+totale).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:mwh|gj|kwh)'],
        ['consumo energetico', 'energia totale']
    ),
    'energia_rinnovabile_pct': (
        [r'(?i)(?:energia\s+rinnovabile|fonti\s+rinnovabili).*?(\d{1,3}(?:,\d+)?)\s*%'],
        ['rinnovabile', 'fonti rinnovabili']
    ),
    'acqua_m3': (
        [r'(?i)(?:prelievo\s+idrico|consumo\s+di\s+acqua|acqua).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:m3|metri\s+cubi|mc|megalitri|ml)'],
        ['acqua', 'prelievo idrico', 'consumo idrico']
    ),
    'rifiuti_pericolosi_t': (
        [r'(?i)(?:rifiuti\s+pericolosi).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:t|tonnellate)'],
        ['rifiuti pericolosi']
    ),
    'rifiuti_non_pericolosi_t': (
        [r'(?i)(?:rifiuti\s+non\s+pericolosi).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:t|tonnellate)'],
        ['rifiuti non pericolosi']
    ),
    'anno_riferimento': (
        [r'(?i)(?:anno\s+di\s+riferimento|bilancio.*?)(202[0-9])'],
        ['anno', '2023', '2024']
    )
}

def clean_value(val):
    if not val:
        return ""
    # Pulisce la stringa estratta mantenendo solo numeri e virgole
    val = val.replace('.', '')
    return val.strip()

def process_pdf(pdf_path):
    print(f"Processando: {os.path.basename(pdf_path)}...")
    
    # Identifica il nome dell'azienda (approssimazione dal nome file)
    azienda = os.path.basename(pdf_path).split('_')[0].split('-')[0].replace('Bilancio', '').strip()
    
    extracted_data = {
        'azienda': azienda,
        'ateco': "", # Richiede integrazione esterna o AI complessa per dedurlo dal testo
        'fonte_pdf': os.path.basename(pdf_path)
    }
    
    # Inizializza i campi come vuoti
    for key in EXTRACTION_PATTERNS.keys():
        extracted_data[key] = ""
        extracted_data[f"{key}_snippet"] = ""
        extracted_data[f"{key}_pagina"] = ""

    try:
        # Usa sia fitz che pdfplumber per massima affidabilità
        # Qui usiamo fitz per la ricerca veloce
        doc = fitz.open(pdf_path)
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            
            if not text:
                continue
                
            text_lower = text.lower()
            lines = text.split('\n')
            
            for key, (regex_list, keywords) in EXTRACTION_PATTERNS.items():
                # Se abbiamo già trovato il dato, potremmo saltare, ma potremmo voler trovare l'ultimo (spesso nei KPI finali)
                # Per semplicità, teniamo il primo trovato per ora, o se vogliamo il "migliore"
                if extracted_data[key]:
                    continue
                    
                # Controlla se la pagina contiene le keyword per questo KPI
                if any(kw in text_lower for kw in keywords):
                    for regex in regex_list:
                        match = re.search(regex, text)
                        if match:
                            # Cerca di estrarre la linea (snippet)
                            snippet = ""
                            for line in lines:
                                if match.group(0) in line or match.group(1) in line:
                                    snippet = line.strip()
                                    break
                            if not snippet:
                                # Fallback snippet
                                start_idx = max(0, match.start() - 50)
                                end_idx = min(len(text), match.end() + 50)
                                snippet = text[start_idx:end_idx].replace('\n', ' ').strip()
                                
                            extracted_data[key] = clean_value(match.group(1))
                            extracted_data[f"{key}_snippet"] = snippet
                            extracted_data[f"{key}_pagina"] = page_num + 1
                            break # Found for this key
                            
        doc.close()
    except Exception as e:
        print(f"Errore nella lettura di {pdf_path}: {e}")
        
    return extracted_data

def main():
    if not os.path.exists(PDF_DIR):
        print(f"Errore: la cartella {PDF_DIR} non esiste.")
        return

    results = []
    
    for filename in os.listdir(PDF_DIR):
        if filename.lower().endswith('.pdf'):
            pdf_path = os.path.join(PDF_DIR, filename)
            data = process_pdf(pdf_path)
            results.append(data)
            
    if results:
        df = pd.DataFrame(results)
        
        # Riordina le colonne come richiesto
        base_columns = [
            'azienda', 'ateco', 'dipendenti', 'fatturato_eur', 'mq_facility', 
            'scope1_tco2e', 'scope2_market_based', 'scope2_location_based', 
            'scope3_tco2e', 'energia_totale_mwh', 'energia_rinnovabile_pct', 
            'acqua_m3', 'rifiuti_pericolosi_t', 'rifiuti_non_pericolosi_t', 
            'anno_riferimento', 'fonte_pdf'
        ]
        
        # Aggiungi le colonne snippet e pagina
        all_columns = []
        for col in base_columns:
            all_columns.append(col)
            if col not in ['azienda', 'ateco', 'fonte_pdf']:
                all_columns.append(f"{col}_snippet")
                all_columns.append(f"{col}_pagina")
                
        # Assicurati che le colonne esistano (potrebbero mancare se nessun match)
        for col in all_columns:
            if col not in df.columns:
                df[col] = ""
                
        df = df[all_columns]
        
        df.to_csv(OUTPUT_CSV, index=False, sep=';', encoding='utf-8-sig')
        print(f"\nEstrazione completata! Dati salvati in: {OUTPUT_CSV}")
        print(f"Aziende processate: {len(results)}")
    else:
        print("Nessun PDF trovato o processato.")

if __name__ == "__main__":
    main()
