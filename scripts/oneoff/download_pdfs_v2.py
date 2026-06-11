import os
import requests
from googlesearch import search
from urllib.parse import urlparse
import time

pdf_dir = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\bilanci_sostenibilita"
os.makedirs(pdf_dir, exist_ok=True)

queries = [
    '"bilancio di sostenibilità" 2023 filetype:pdf "manifattura"',
    '"bilancio di sostenibilità" 2023 filetype:pdf "alimentare"',
    '"bilancio di sostenibilità" 2023 filetype:pdf "servizi"',
    '"bilancio di sostenibilità" 2023 filetype:pdf "srl"',
    '"bilancio di sostenibilità" 2023 filetype:pdf "logistica"',
    '"bilancio di sostenibilità" 2023 filetype:pdf "chimica"',
    '"bilancio di sostenibilità" 2023 filetype:pdf "tessile"',
    '"bilancio di sostenibilità" 2023 filetype:pdf "agricola"',
    '"bilancio di sostenibilità" 2023 filetype:pdf "spa" "benefit"',
    '"sustainability report" 2023 filetype:pdf "italy"'
]

downloaded = 0
target = 50
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

for query in queries:
    if downloaded >= target:
        break
    print(f"Searching for: {query}")
    try:
        results = search(query, num_results=10, sleep_interval=2)
        for url in results:
            if downloaded >= target:
                break
            if url.endswith('.pdf'):
                filename = os.path.basename(urlparse(url).path)
                if not filename.endswith('.pdf'):
                    filename = f"report_{downloaded}.pdf"
                filepath = os.path.join(pdf_dir, filename)
                
                if not os.path.exists(filepath):
                    try:
                        print(f"Downloading {filename}...")
                        response = requests.get(url, headers=headers, timeout=10)
                        if response.status_code == 200:
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
                else:
                    print(f"Already exists: {filename}")
    except Exception as e:
        print(f"Search failed for {query}: {e}")

print(f"Finished downloading {downloaded} reports.")
