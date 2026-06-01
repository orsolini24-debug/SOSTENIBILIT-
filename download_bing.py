import os
import requests
from bs4 import BeautifulSoup
import time

pdf_dir = r"C:\Users\g.orsolini\Desktop\Giorgio\Privata\Personale\Nuova-cartella\Progetti\Sostenibilità\bilanci_sostenibilita"
os.makedirs(pdf_dir, exist_ok=True)

queries = [
    'bilancio di sostenibilità 2023 pdf manifattura',
    'bilancio di sostenibilità 2023 pdf alimentare',
    'bilancio di sostenibilità 2023 pdf servizi',
    'bilancio di sostenibilità 2023 pdf edilizia',
    'bilancio di sostenibilità 2023 pdf moda',
    'bilancio di sostenibilità 2023 pdf logistica',
    'bilancio di sostenibilità 2023 pdf energia',
    'bilancio di sostenibilità 2023 pdf trasporti',
    'bilancio di sostenibilità 2023 pdf PMI'
]

downloaded = 0
target = 50
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

for query in queries:
    if downloaded >= target:
        break
    print(f"Searching Bing for: {query}")
    try:
        search_url = f"https://www.bing.com/search?q={requests.utils.quote(query)}"
        resp = requests.get(search_url, headers=headers)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        for a in soup.find_all('a', href=True):
            if downloaded >= target:
                break
            url = a['href']
            if url.endswith('.pdf') and 'http' in url:
                filename = url.split('/')[-1].split('?')[0]
                if not filename.endswith('.pdf'):
                    filename = f"report_{downloaded}.pdf"
                filepath = os.path.join(pdf_dir, filename)
                
                if not os.path.exists(filepath):
                    try:
                        print(f"Downloading {filename} from {url}...")
                        r = requests.get(url, headers=headers, timeout=10)
                        if r.status_code == 200 and r.content.startswith(b'%PDF'):
                            with open(filepath, 'wb') as f:
                                f.write(r.content)
                            downloaded += 1
                            print(f"Success! Total downloaded: {downloaded}/{target}")
                    except Exception as e:
                        pass
    except Exception as e:
        print(f"Failed to scrape Bing: {e}")
    time.sleep(2)

print(f"Finished downloading {downloaded} reports.")
