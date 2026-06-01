import os
import re
import pandas as pd
import fitz  # PyMuPDF

# Paths
BASE_DIR = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità"
PDF_DIR = os.path.join(BASE_DIR, "company_reports")
DICTIONARY_PATH = os.path.join(BASE_DIR, "esg_disclosure_dictionary.csv")
OUTPUT_RAW = os.path.join(BASE_DIR, "sustainchain-knowledge", "04_extraction_pipeline", "outputs_raw", "environment_datapoints_raw_v2.csv")
LOG_FILE = os.path.join(BASE_DIR, "sustainchain-knowledge", "05_quality_assurance", "error_analysis", "environment_extraction_log_v2.csv")

# Load Dictionary for mapping
dict_df = pd.read_csv(DICTIONARY_PATH, sep=';')
e_dict = dict_df[dict_df['pillar'] == 'E'].to_dict('records')

# Extraction Patterns (Targeting specific disclosure IDs from dictionary)
# Mapping internal keys to disclosure_ids
ENV_KPI_CONFIG = {
    'total_energy': {
        'id': 'ESRS_E1_5_ENERGY',
        'regex': [r'(?i)(?:consumo\s+totale\s+di\s+energia|energia\s+totale\s+consumata|energy\s+consumption).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)'],
        'keywords': ['energia', 'energy', 'mwh', 'gj', 'consumo']
    },
    'renewable_pct': {
        'id': 'ESRS_E1_5_RENEWABLE_PCT',
        'regex': [r'(?i)(?:quota\s+fonti\s+rinnovabili|energia\s+rinnovabile|renewable\s+share).*?(\d{1,3}(?:,\d+)?)\s*%'],
        'keywords': ['rinnovabile', 'renewable', 'quota']
    },
    'scope1': {
        'id': 'ESRS_E1_6_SCOPE1',
        'regex': [r'(?i)(?:scope\s*1|emissioni\s+dirette).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)'],
        'keywords': ['scope 1', 'tco2e', 'dirette']
    },
    'scope2_mb': {
        'id': 'ESRS_E1_6_SCOPE2_MB',
        'regex': [r'(?i)(?:scope\s*2).*?(?:market[-\s]based).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)'],
        'keywords': ['scope 2', 'market based', 'market-based']
    },
    'scope3': {
        'id': 'ESRS_E1_6_SCOPE3',
        'regex': [r'(?i)(?:scope\s*3|emissioni\s+indirette).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)'],
        'keywords': ['scope 3', 'tco2e', 'indirette']
    },
    'water': {
        'id': 'ESRS_E3_4_WATER',
        'regex': [r'(?i)(?:prelievo\s+idrico|consumo\s+acqua|water\s+withdrawal).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)'],
        'keywords': ['acqua', 'water', 'm3', 'prelievo']
    },
    'waste': {
        'id': 'ESRS_E5_5_WASTE',
        'regex': [r'(?i)(?:rifiuti\s+prodotti|totale\s+rifiuti|waste\s+generated).*?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)'],
        'keywords': ['rifiuti', 'waste', 'tonnellate', 'prodotti']
    }
}

def normalize_value(val):
    if not val: return ""
    return val.replace('.', '').replace(',', '.')

def process_pdf(pdf_path):
    print(f"🔍 Analyzing: {os.path.basename(pdf_path)}")
    filename = os.path.basename(pdf_path)
    # Simple extraction of company name from filename
    company_id = filename.replace('.pdf', '')
    
    results = []
    try:
        doc = fitz.open(pdf_path)
        for page_num in range(len(doc)):
            text = doc[page_num].get_text("text")
            text_lower = text.lower()
            
            for kpi_key, config in ENV_KPI_CONFIG.items():
                if any(kw in text_lower for kw in config['keywords']):
                    for pattern in config['regex']:
                        matches = re.finditer(pattern, text)
                        for match in matches:
                            val_raw = match.group(1)
                            val_norm = normalize_value(val_raw)
                            
                            # Find surrounding context for snippet
                            start = max(0, match.start() - 100)
                            end = min(len(text), match.end() + 100)
                            snippet = text[start:end].replace('\n', ' ').strip()
                            
                            results.append({
                                'company_id': company_id,
                                'year': '2024',
                                'disclosure_id': config['id'],
                                'pillar': 'E',
                                'metric_name': kpi_key,
                                'value': val_raw,
                                'value_norm': val_norm,
                                'unit': 'mixed', # Will need mapping
                                'confidence': 0.7,
                                'source_page': page_num + 1,
                                'snippet': f"Snippet: {snippet}",
                                'validation_status': 'auto_extracted_candidate'
                            })
        doc.close()
    except Exception as e:
        print(f"❌ Error processing {filename}: {e}")
    
    return results

def main():
    if not os.path.exists(PDF_DIR):
        print("PDF directory not found.")
        return

    all_results = []
    for fn in os.listdir(PDF_DIR):
        if fn.lower().endswith('.pdf'):
            res = process_pdf(os.path.join(PDF_DIR, fn))
            all_results.extend(res)
    
    if all_results:
        df = pd.DataFrame(all_results)
        # Deduplicate same value on same page for same company/KPI
        df = df.drop_duplicates(subset=['company_id', 'disclosure_id', 'value_norm', 'source_page'])
        
        df.to_csv(OUTPUT_RAW, index=False, encoding='utf-8-sig')
        print(f"\n✅ Environment extraction complete. Records: {len(df)}")
        
        # Simple log
        log_df = df.groupby('metric_name').size().reset_index(name='count')
        log_df.to_csv(LOG_FILE, index=False)
    else:
        print("No Environment records extracted.")

if __name__ == "__main__":
    main()
