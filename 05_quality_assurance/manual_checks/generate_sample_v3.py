import pandas as pd
import numpy as np
import os

# Paths
INPUT_CSV = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\sustainchain-knowledge\04_extraction_pipeline\outputs_validated\esg_dataset_candidate_clean_v2_2.csv"
OUTPUT_CSV = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\sustainchain-knowledge\05_quality_assurance\manual_checks\manual_validation_sample_v3.csv"

def generate_sample_v3():
    print("🎯 Generating Stratified Manual Validation Sample (v3)...")
    
    df = pd.read_csv(INPUT_CSV)
    
    # Mapping logic for sampling (ensure we have E, S, G)
    def get_pillar(row):
        p = str(row['pillar'])
        if p == 'E': return 'E'
        if p == 'G': return 'G'
        if p == 'VSME' or p == 'S': return 'S' # VSME currently mostly headcount
        if p == 'ESRS': # Check disclosure_id
            did = str(row['disclosure_id'])
            if '_E' in did: return 'E'
            if '_S' in did: return 'S'
            if '_G' in did: return 'G'
        return 'Other'

    df['sampling_pillar'] = df.apply(get_pillar, axis=1)
    
    print("\n📊 Pool distribution for sampling:")
    print(df['sampling_pillar'].value_counts())
    
    # Target counts: 45 E, 45 S, 30 G
    targets = {'E': 45, 'S': 45, 'G': 30}
    sample_list = []
    
    for pillar, count in targets.items():
        pool = df[df['sampling_pillar'] == pillar]
        if len(pool) == 0:
            print(f"❌ ERROR: No candidates for pillar {pillar}")
            return
        
        # Take min of count or pool size
        n = min(count, len(pool))
        sample_list.append(pool.sample(n=n, random_state=42))
        print(f"✅ Sampled {n} from {pillar}")
        
    sample_df = pd.concat(sample_list).reset_index(drop=True)
    
    # Add QA Split: 2/3 Calibration, 1/3 Holdout
    # Shuffle first
    sample_df = sample_df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    def assign_split(idx):
        return 'holdout' if idx % 3 == 0 else 'calibration'
    
    sample_df['qa_split'] = [assign_split(i) for i in range(len(sample_df))]
    
    # Clean up and add manual review columns
    final_cols = [
        'company_id', 'year', 'disclosure_id', 'metric_name', 'pillar', 
        'value', 'unit', 'confidence', 'source_snippet', 'qa_split'
    ]
    
    # Ensure all columns exist
    for col in final_cols:
        if col not in sample_df.columns:
            sample_df[col] = ""
            
    sample_v3 = sample_df[final_cols].copy()
    
    # Add empty validation columns
    review_cols = ['manual_value', 'manual_unit', 'manual_status', 'error_type', 'notes']
    for col in review_cols:
        sample_v3[col] = ""
        
    sample_v3.to_csv(OUTPUT_CSV, index=False, encoding='utf-8-sig')
    print(f"\n✅ Sample v3 created at: {OUTPUT_CSV}")
    
    # Final check on split
    print("\n📊 Split distribution by Pillar:")
    print(pd.crosstab(sample_v3['qa_split'], sample_v3['pillar']))

if __name__ == "__main__":
    generate_sample_v3()
