import os
import requests
from duckduckgo_search import DDGS
from urllib.parse import urlparse
import time

pdf_dir = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\bilanci_sostenibilita"
os.makedirs(pdf_dir, exist_ok=True)

queries = [
    '"bilancio di sostenibilità" 2023 filetype:pdf manifattura',
    '"bilancio di sostenibilità" 2023 filetype:pdf alimentare',
    '"bilancio di sostenibilità" 2023 filetype:pdf servizi',
    '"bilancio di sostenibilità" 2023 filetype:pdf edilizia',
    '"bilancio di sostenibilità" 2023 filetype:pdf moda',
    '"bilancio di sostenibilità" 2023 filetype:pdf logistica',
    '"bilancio di sostenibilità" 2023 filetype:pdf energia',
    '"bilancio di sostenibilità" 2023 filetype:pdf "spa"',
    '"bilancio di sostenibilità" 2023 filetype:pdf "srl"',
    '"sustainability report" 2023 filetype:pdf italy'
]

downloaded = 0
target = 50
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

with DDGS() as ddgs:
    for query in queries:
        if downloaded >= target:
            break
        print(f"Searching for: {query}")
        try:
            results = ddgs.text(query, max_results=30)
            for r in results:
                if downloaded >= target:
                    break
                url = r.get('href')
                if url and url.endswith('.pdf'):
                    filename = os.path.basename(urlparse(url).path)
                    if not filename.endswith('.pdf'):
                        filename = f"report_{downloaded}.pdf"
                    filepath = os.path.join(pdf_dir, filename)
                    
                    if not os.path.exists(filepath):
                        try:
                            print(f"Downloading {filename}...")
                            response = requests.get(url, headers=headers, timeout=15)
                            if response.status_code == 200:
                                # Ensure we only save actual PDFs (magic number check)
                                if response.content.startswith(b'%PDF'):
                                    with open(filepath, 'wb') as f:
                                        f.write(response.content)
                                    downloaded += 1
                                    print(f"Success! Total downloaded: {downloaded}/{target}")
                                else:
                                    print(f"Not a valid PDF: {url}")
                            else:
                                print(f"Failed with status {response.status_code}: {url}")
                        except Exception as e:
                            print(f"Failed to download {url}: {e}")
                        time.sleep(1) # Be polite
        except Exception as e:
            print(f"Search failed for {query}: {e}")
        time.sleep(2)

print(f"Finished downloading {downloaded} reports.")
