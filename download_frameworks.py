import os
import requests
import time

pdf_dir = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\bilanci_sostenibilita"
os.makedirs(pdf_dir, exist_ok=True)

# Link a documenti ufficiali sui framework ESG (EFRAG, UN, GRI)
framework_urls = {
    "EFRAG_VSME_Standard_ED.pdf": "https://www.efrag.org/sites/default/files/sites/webpublishing/SiteAssets/VSME%20Standard.pdf",
    "UN_Agenda_2030_SDGs.pdf": "https://sdgs.un.org/sites/default/files/publications/21252030%20Agenda%20for%20Sustainable%20Development%20web.pdf",
    "GRI_1_Foundation_2021.pdf": "https://www.globalreporting.org/pdf.ashx?id=12368", # Proxy for GRI 1
    "EFRAG_ESRS_Set1.pdf": "https://finance.ec.europa.eu/system/files/2023-07/230731-delegated-act-european-sustainability-reporting-standards-annex-1_en.pdf"
}

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'}

for filename, url in framework_urls.items():
    filepath = os.path.join(pdf_dir, filename)
    if not os.path.exists(filepath):
        try:
            print(f"Downloading {filename}...")
            r = requests.get(url, headers=headers, timeout=20)
            if r.status_code == 200 and r.content.startswith(b'%PDF'):
                with open(filepath, 'wb') as f:
                    f.write(r.content)
                print(f"Success: {filename}")
            else:
                print(f"Failed {filename} - Status: {r.status_code}")
        except Exception as e:
            print(f"Error downloading {filename}: {e}")
        time.sleep(2)
    else:
        print(f"Already exists: {filename}")
