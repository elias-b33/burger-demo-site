"""Download the chosen editorial demo images and self-hosted Google fonts."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen, Request
import re

root = Path(__file__).resolve().parents[1] / 'dist' / 'assets'
images = {
    'original.jpg': 'photo-1568901346375-23c9450c58cd',
    'hot.jpg': 'photo-1550547660-d9450f859349',
    'green.jpg': 'photo-1520072959219-c595dc870360',
    'fries.jpg': 'photo-1639024471283-03518883512d',
    'shake.jpg': 'photo-1572490122747-3968b75cc699',
    'restaurant-soder.jpg': 'photo-1517248135467-4c7edcad34c4',
    'restaurant-vasa.jpg': 'photo-1552566626-52f8b828add9',
}

def download_image(entry):
    name, identifier = entry
    url = f'https://images.unsplash.com/{identifier}?auto=format&fit=crop&w=1100&q=85&fm=jpg'
    data = urlopen(url, timeout=40).read()
    (root / name).write_bytes(data)
    return f'{name}: {len(data)} bytes'

def download_font():
    url = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Bree+Serif&family=Caveat:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap'
    css = urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read().decode()
    for i, url in enumerate(dict.fromkeys(re.findall(r'url\((https://[^)]+)\)', css))):
        extension = 'woff2' if '.woff2' in url else 'ttf'
        name = f'font-{i}.{extension}'
        (root / name).write_bytes(urlopen(url, timeout=30).read())
        css = css.replace(url, f'./{name}')
    (root / 'fonts.css').write_text(css, encoding='utf-8')
    return 'Self-hosted fonts downloaded'

with ThreadPoolExecutor(max_workers=7) as pool:
    for result in pool.map(download_image, images.items()):
        print(result)
print(download_font())
