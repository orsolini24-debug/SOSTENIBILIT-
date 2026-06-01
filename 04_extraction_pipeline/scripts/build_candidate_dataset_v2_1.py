import pandas as pd
import os

# Paths
CANDIDATE_SG = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\sustainchain-knowledge\04_extraction_pipeline\outputs_validated\esg_dataset_candidate_clean_v2.csv"
CANDIDATE_E = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\sustainchain-knowledge\04_extraction_pipeline\outputs_raw\environment_datapoints_raw_v2.csv"
OUTPUT_MERGED = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\sustainchain-knowledge\04_extraction_pipeline\outputs_validated\esg_dataset_candidate_clean_v2_1.csv"

def build_dataset():
    print("🔄 Building merged candidate dataset (v2.1)...")
    
    # 1. Load S/G candidates
    df_sg = pd.read_csv(CANDIDATE_SG)
    # Ensure no duplicates in index or columns
    df_sg = df_sg.loc[:, ~df_sg.columns.duplicated()].reset_index(drop=True)
    
    # 2. Load E candidates
    df_e = pd.read_csv(CANDIDATE_E)
    # Ensure no duplicates in index or columns
    df_e = df_e.loc[:, ~df_e.columns.duplicated()].reset_index(drop=True)
    
    # Rename columns to match SG
    df_e = df_e.rename(columns={'value_norm': 'value', 'snippet': 'source_snippet'})
    if 'source_page' in df_e.columns:
        df_e = df_e.rename(columns={'source_page': 'page_number'})
    
    # Ensure columns match SG exactly
    target_cols = df_sg.columns.tolist()
    for col in target_cols:
        if col not in df_e.columns:
            df_e[col] = ""
            
    df_e_aligned = df_e[target_cols].copy()
    
    # 3. Merge as pure lists of dicts to avoid pandas indexing issues
    data_sg = df_sg.to_dict('records')
    data_e = df_e_aligned.to_dict('records')
    
    combined_data = data_sg + data_e
    df_merged = pd.DataFrame(combined_data)
    
    # 4. Deduplicate
    initial_count = len(df_merged)
    df_merged = df_merged.drop_duplicates(subset=['company_id', 'disclosure_id', 'value', 'source_snippet'])
    print(f"Deduplication: {initial_count} -> {len(df_merged)}")
    
    # 5. Save
    df_merged.to_csv(OUTPUT_MERGED, index=False, encoding='utf-8-sig')
    print(f"✅ Merged dataset saved to: {OUTPUT_MERGED}")
    
    # 6. Final check
    print("\n📊 Final Distribution:")
    print(df_merged['pillar'].value_counts())

if __name__ == "__main__":
    build_dataset()
