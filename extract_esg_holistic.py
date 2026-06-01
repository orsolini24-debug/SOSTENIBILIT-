import os
import fitz  # PyMuPDF
import pandas as pd
import re

# Configurazione cartelle
BASE_DIR = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità"
PDF_DIR = os.path.join(BASE_DIR, "bilanci_sostenibilita")
OUTPUT_CSV = os.path.join(BASE_DIR, "bilanci_esg_completo.csv")

# Nuovi pattern olistici E-S-G basati sullo studio di GRI, ESRS e VSME
EXTRACTION_PATTERNS = {
    # --- ENVIRONMENT (Ambiente) ---
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
    
    # --- SOCIAL (Sociale - GRI 400 / VSME B5-B7) ---
    'donne_manager_pct': (
        [r'(?i)(?:donne\s+in\s+posizioni\s+manageriali|donne\s+dirigenti|female\s+managers).*?(\d{1,3}(?:,\d+)?)\s*%'],
        ['donne', 'manager', 'dirigenti', 'female']
    ),
    'gender_pay_gap_pct': (
        [r'(?i)(?:gender\s+pay\s+gap|differenza\s+salariale|divario\s+retributivo).*?(\d{1,3}(?:,\d+)?)\s*%'],
        ['gender pay gap', 'divario retributivo', 'differenza salariale']
    ),
    'ore_formazione_procapite': (
        [r'(?i)(?:ore\s+di\s+formazione\s+pro\s*capite|media\s+ore\s+di\s+formazione).*?(\d{1,3}(?:,\d+)?)'],
        ['formazione pro capite', 'media ore di formazione', 'training hours']
    ),
    'infortuni_lavoro': (
        [r'(?i)(?:numero\s+di\s+infortuni|infortuni\s+sul\s+lavoro|recordable\s+injuries).*?(\d{1,3})'],
        ['infortuni', 'injuries']
    ),
    
    # --- GOVERNANCE (Governo Societario - GRI 200 / VSME B8-B9) ---
    'incidenti_corruzione': (
        [r'(?i)(?:incidenti\s+di\s+corruzione|episodi\s+di\s+corruzione).*?(\d{1,3})'],
        ['corruzione', 'corruption']
    ),
    'fornitori_valutati_esg_pct': (
        [r'(?i)(?:fornitori\s+valutati\s+secondo\s+criteri|screening\s+fornitori).*?(\d{1,3}(?:,\d+)?)\s*%'],
        ['fornitori', 'screening', 'criteri ambientali']
    )
}

# Ricerca di certificazioni (boolean: trovata o non trovata)
CERTIFICATIONS = [
    'ISO 14001', 'ISO 45001', 'ISO 9001', 'SA8000', 'ISO 37001', 'ISO 50001', 
    'ISO 27001', 'B Corp', 'Società Benefit', 'EMAS', 'Ecolabel', 'UNI/PdR 125'
]

def clean_value(val):
    if not val: return ""
    val = val.replace('.', '')
    return val.strip()

def process_pdf(pdf_path):
    print(f"Estraendo E-S-G da: {os.path.basename(pdf_path)}...")
    azienda = os.path.basename(pdf_path).split('_')[0].split('-')[0].replace('Bilancio', '').strip()
    
    extracted_data = {'azienda': azienda, 'fonte_pdf': os.path.basename(pdf_path)}
    
    for key in EXTRACTION_PATTERNS.keys():
        extracted_data[key] = ""
    for cert in CERTIFICATIONS:
        extracted_data[cert] = "No"

    try:
        doc = fitz.open(pdf_path)
        for page_num in range(len(doc)):
            text = doc[page_num].get_text("text").lower()
            if not text: continue
            
            # 1. Estrazione metriche quantitative
            for key, (regex_list, keywords) in EXTRACTION_PATTERNS.items():
                if extracted_data[key]: continue
                if any(kw in text for kw in keywords):
                    for regex in regex_list:
                        match = re.search(regex, doc[page_num].get_text("text"))
                        if match:
                            extracted_data[key] = clean_value(match.group(1))
                            break
            
            # 2. Ricerca Certificazioni / Status
            for cert in CERTIFICATIONS:
                if extracted_data[cert] == "No" and cert.lower() in text:
                    extracted_data[cert] = "Sì"
                    
        doc.close()
    except Exception as e:
        print(f"Errore su {pdf_path}: {e}")
        
    return extracted_data

def main():
    if not os.path.exists(PDF_DIR):
        return

    results = []
    for filename in os.listdir(PDF_DIR):
        if filename.lower().endswith('.pdf'):
            data = process_pdf(os.path.join(PDF_DIR, filename))
            results.append(data)
            
    if results:
        df = pd.DataFrame(results)
        df.to_csv(OUTPUT_CSV, index=False, sep=';', encoding='utf-8-sig')
        print(f"\nEstrazione Olistica (E-S-G) completata! {len(results)} report analizzati.")
        print(f"File salvato in: {OUTPUT_CSV}")

if __name__ == "__main__":
    main()
