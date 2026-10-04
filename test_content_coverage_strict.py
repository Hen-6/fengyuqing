import json
import os
import re
import random

progress_file = '/Users/henry/Downloads/fengyuqing-progress.json'
content_db_file = '/Users/henry/fengyuqing/data/poems_content.json'
gushiwen_dir = '/tmp/poetry-test/gushiwen2/guwen'

with open(progress_file, 'r', encoding='utf-8') as f:
    progress_data = json.load(f)

with open(content_db_file, 'r', encoding='utf-8') as f:
    content_data = json.load(f)

tracked_ids = progress_data.get('poems', {}).keys()
target_poems = []

for pid in tracked_ids:
    content_obj = content_data.get(pid)
    if content_obj and 'lines' in content_obj and len(content_obj['lines']) > 0:
        lines = content_obj['lines']
        random_line = lines[0] # Pick the first line for deterministic testing
        clean_line = re.sub(r'\(.*?\)|（.*?）|[，。？！、；：“”‘’【】「」《》\s]', '', random_line)
        search_sentence = clean_line[:7] if len(clean_line) >= 4 else clean_line
        
        target_poems.append({
            "id": pid,
            "sentence": search_sentence,
            "found": False,
            "matched_title": None
        })

print(f"Extracted sentences for {len(target_poems)} tracked poems from your local database.")

# Search in new DB
for file in os.listdir(gushiwen_dir):
    if not file.endswith('.json'): continue
    filepath = os.path.join(gushiwen_dir, file)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip(): continue
                item = json.loads(line)
                new_content = item.get('content', '')
                if not new_content: continue
                clean_new = re.sub(r'[，。？！、；：“”‘’【】「」《》\s]', '', new_content)
                
                for tp in target_poems:
                    if not tp['found']:
                        if tp['sentence'] in clean_new:
                            tp['found'] = True
                            tp['matched_title'] = item.get('name', item.get('title', 'Unknown'))
    except: pass

found_count = sum(1 for tp in target_poems if tp['found'])
print(f"Coverage by EXACT CONTENT: {found_count}/{len(target_poems)} ({(found_count/len(target_poems))*100:.2f}%)")

print("\nMissing poems (Sentence not found in gushiwen):")
for tp in target_poems:
    if not tp['found']:
        print(f"  - {tp['id']} -> 提取并搜索的句子: '{tp['sentence']}'")
