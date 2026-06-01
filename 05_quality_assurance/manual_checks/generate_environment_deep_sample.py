import pandas as pd
import numpy as np
import os

# Paths
INPUT_CSV = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\sustainchain-knowledge\04_extraction_pipeline\outputs_validated\esg_dataset_candidate_clean_v2_2.csv"
OUTPUT_CSV = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\sustainchain-knowledge\05_quality_assurance\manual_checks\manual_validation_environment_deep_sample_v1.csv"

def generate_environment_deep_sample():
    print("🎯 Generating Environment-Only Deep-Dive Sample (v1)...")
    
    df = pd.read_csv(INPUT_CSV)
    
    # Filter for Environment candidates
    df_e = df[df['pillar'] == 'E'].copy()
    
    if len(df_e) == 0:
        # Fallback check for ESRS_E or GRI_30
        df_e = df[df['disclosure_id'].astype(str).str.contains('E1|E2|E3|E4|E5|302|305')].copy()
        df_e['pillar'] = 'E'
        
    print(f"Environment pool size: {len(df_e)}")
    
    # Define Sub-categories for sampling
    def get_e_category(row):
        did = str(row['disclosure_id'])
        metric = str(row['metric_name']).lower()
        
        if 'scope' in metric or 'emission' in metric or 'ghg' in metric or 'scope' in did:
            return 'GHG'
        if 'energy' in metric or 'energia' in metric or 'renewable' in metric or 'rinnovabile' in metric:
            return 'Energy'
        if 'water' in metric or 'acqua' in metric:
            return 'Water'
        if 'waste' in metric or 'rifiuti' in metric:
            return 'Waste'
        if 'iso' in metric or 'iso' in did or 'cert' in did:
            return 'Certifications'
        return 'Other_E'

    df_e['e_category'] = df_e.apply(get_e_category, axis=1)
    
    print("\n📊 Environment sub-category distribution:")
    print(df_e['e_category'].value_counts())
    
    # Target distribution
    targets = {
        'GHG': 30,
        'Energy': 20,
        'Water': 15,
        'Waste': 20,
        'Certifications': 15
    }
    
    sample_list = []
    for cat, count in targets.items():
        pool = df_e[df_e['e_category'] == cat]
        if len(pool) > 0:
            n = min(count, len(pool))
            sample_list.append(pool.sample(n=n, random_state=42))
            print(f"✅ Sampled {n} from {cat}")
        else:
            print(f"⚠️ Warning: No records found for category {cat}")

    if not sample_list:
        print("❌ ERROR: No records sampled.")
        return

    sample_df = pd.concat(sample_list).reset_index(drop=True)
    
    # QA Split: 70 Calibration / 30 Holdout
    sample_df = sample_df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    n_total = len(sample_df)
    n_holdout = int(n_total * 0.3)
    
    sample_df['qa_split'] = 'calibration'
    sample_df.loc[sample_df.index[:n_holdout], 'qa_split'] = 'holdout'
    
    # Add Review Columns
    review_cols = ['manual_value', 'manual_unit', 'manual_status', 'error_type', 'notes']
    for col in review_cols:
        sample_df[col] = ""
        
    # Reorder for clarity
    display_cols = [
        'company_id', 'year', 'disclosure_id', 'metric_name', 'e_category', 
        'value', 'unit', 'confidence', 'page_number', 'source_snippet', 'qa_split'
    ] + review_cols
    
    # Ensure all columns exist
    for col in display_cols:
        if col not in sample_df.columns:
            sample_df[col] = ""
            
    final_sample = sample_df[display_cols].copy()
    
    final_sample.to_csv(OUTPUT_CSV, index=False, encoding='utf-8-sig')
    print(f"\n✅ Environment Deep Sample v1 created with {len(final_sample)} records at: {OUTPUT_CSV}")
    
    # Verification
    print("\n📊 Metrics Summary:")
    print(pd.crosstab(final_sample['qa_split'], final_sample['e_category']))

if __name__ == "__main__":
    generate_environment_deep_sample()
