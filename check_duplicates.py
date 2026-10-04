import json

old_db_file = '/Users/henry/fengyuqing/data/poems.json'

with open(old_db_file, 'r', encoding='utf-8') as f:
    old_poems = json.load(f)

def check_poem(title, author):
    matches = [p for p in old_poems if p.get('t') == title and p.get('a') == author]
    print(f"\\n--- Found {len(matches)} entries for {title}:{author} ---")
    for i, p in enumerate(matches):
        print(f"[{i+1}] Rank: {p.get('r', 'N/A')}, Content preview: {p.get('content', [])[:2]}")

check_poem('琵琶', '白居易')
check_poem('独坐敬亭山', '李白')
check_poem('独酌', '李白')
