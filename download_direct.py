import os
import requests
import time

pdf_dir = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\bilanci_sostenibilita"
os.makedirs(pdf_dir, exist_ok=True)

urls = [
    "https://www.lagranda.it/wp-content/uploads/2024/07/La-Granda-Bilancio-di-Sostenibilita-2023.pdf",
    "https://www.visindustrie.com/wp-content/uploads/2024/07/VIS-INDUSTRIE-ALIMENTARI-BILANCIO-DI-SOSTENIBILITA-2023.pdf",
    "https://www.montanari-gruzza.it/wp-content/uploads/2024/07/Rapporto-di-Sostenibilita-2023.pdf",
    "https://www.unioneitalianafood.it/wp-content/uploads/2023/11/Bilancio-di-Sostenibilita-Aggregato-Unione-Italiana-Food-2023.pdf",
    "https://www.linificio.it/wp-content/uploads/2024/09/Marzotto-Group-Sustainability-Report-2023.pdf",
    "https://sg-company.it/wp-content/uploads/2024/04/SG-Company-Bilancio-di-Sostenibilita-2023.pdf",
    "https://www.opem.it/wp-content/uploads/2024/07/OPEM-Bilancio-di-Sostenibilita-2023.pdf",
    "https://www.zordan1965.com/wp-content/uploads/2024/05/Zordan-Bilancio-di-Sostenibilita-2023.pdf",
    "https://www.lavitawiz.it/wp-content/uploads/2024/09/WIZ-Chemicals-Bilancio-di-Sostenibilita-2023-2024.pdf",
    "https://www.sammontanaitalia.com/sostenibilita/bilancio-di-sostenibilita/"
]

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

for url in urls:
    if not url.endswith('.pdf'):
        continue
    filename = url.split('/')[-1]
    filepath = os.path.join(pdf_dir, filename)
    if not os.path.exists(filepath):
        try:
            print(f"Downloading {filename}...")
            r = requests.get(url, headers=headers, timeout=15)
            if r.status_code == 200 and r.content.startswith(b'%PDF'):
                with open(filepath, 'wb') as f:
                    f.write(r.content)
                print("Success.")
            else:
                print(f"Failed. Status: {r.status_code}")
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(1)
