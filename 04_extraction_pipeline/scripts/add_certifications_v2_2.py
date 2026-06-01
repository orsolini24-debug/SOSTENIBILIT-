import pandas as pd
import os

# Paths
CANDIDATE_V2_1 = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\sustainchain-knowledge\04_extraction_pipeline\outputs_validated\esg_dataset_candidate_clean_v2_1.csv"
HOLISTIC_CSV = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\bilanci_esg_completo.csv"
OUTPUT_V2_2 = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\sustainchain-knowledge\04_extraction_pipeline\outputs_validated\esg_dataset_candidate_clean_v2_2.csv"

def add_certifications():
    print("🎓 Adding Certifications to Candidate Dataset (v2.2)...")
    
    df_cand = pd.read_csv(CANDIDATE_V2_1)
    df_hol = pd.read_csv(HOLISTIC_CSV, sep=';')
    
    cert_cols = [
        'ISO 14001', 'ISO 45001', 'ISO 9001', 'SA8000', 'ISO 37001', 
        'ISO 50001', 'ISO 27001', 'B Corp', 'Società Benefit', 'EMAS', 
        'Ecolabel', 'UNI/PdR 125'
    ]
    
    cert_records = []
    for _, row in df_hol.iterrows():
        company_name = str(row['azienda'])
        # Map company name to company_id (approximation)
        company_id = str(row['fonte_pdf']).replace('.pdf', '')
        
        for cert in cert_cols:
            if col := row.get(cert):
                if str(col).lower() == 'sì':
                    # Determine Pillar
                    pillar = 'E' if cert in ['ISO 14001', 'ISO 50001', 'EMAS', 'Ecolabel'] else 'G'
                    if cert in ['ISO 45001', 'SA8000', 'UNI/PdR 125']: pillar = 'S'
                    
                    cert_records.append({
                        'company_id': company_id,
                        'year': '2024',
                        'disclosure_id': f"CERT_{cert.replace(' ', '_')}",
                        'metric_name': cert,
                        'pillar': pillar,
                        'value': 'Yes',
                        'unit': 'boolean',
                        'confidence': 0.8,
                        'source_snippet': f"Trovata menzione di {cert} nel report.",
                        'validation_status': 'auto_extracted_candidate'
                    })
    
    df_certs = pd.DataFrame(cert_records)
    print(f"Extracted {len(df_certs)} certification records.")
    
    # Merge and Deduplicate
    df_merged = pd.concat([df_cand, df_certs], ignore_index=True)
    df_merged = df_merged.drop_duplicates(subset=['company_id', 'disclosure_id', 'value'])
    
    df_merged.to_csv(OUTPUT_V2_2, index=False, encoding='utf-8-sig')
    print(f"✅ Updated dataset v2.2 saved. Total records: {len(df_merged)}")
    print("\n📊 Final Distribution:")
    print(df_merged['pillar'].value_counts())

if __name__ == "__main__":
    add_certifications()
