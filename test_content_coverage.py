import json
import os
import re
import random

progress_file = '/Users/henry/Downloads/fengyuqing-progress.json'
old_db_file = '/Users/henry/fengyuqing/data/poems.json'
gushiwen_dir = '/tmp/poetry-test/gushiwen2/guwen'

# 1. Load user's tracked poems
with open(progress_file, 'r', encoding='utf-8') as f:
    progress_data = json.load(f)

tracked_ids = progress_data.get('poems', {}).keys()
target_poems = []
for pid in tracked_ids:
    if ":" in pid:
        title, author = pid.split(":", 1)
        target_poems.append({
            "id": pid,
            "title": title.strip(),
            "author": author.strip(),
            "content_sentence": None,
            "found_in_new": False
        })

# 2. Load old DB to get the content
with open(old_db_file, 'r', encoding='utf-8') as f:
    old_poems = json.load(f)

# Create lookup
for tp in target_poems:
    # Fuzzy match in old DB since user's names are exactly from old DB or very close
    for old_p in old_poems:
        old_title = old_p.get('t', '')
        old_author = old_p.get('a', '')
        
        # Simple match
        if tp['title'] == old_title and tp['author'] == old_author:
            content_list = old_p.get('content', [])
            if content_list:
                # pick a random line
                random_line = random.choice(content_list)
                # clean punctuation and notes like (倾耳听 一作：侧)
                clean_line = re.sub(r'\(.*?\)|（.*?）|[，。？！、；：“”‘’【】「」《》\s]', '', random_line)
                if len(clean_line) >= 4:
                    # just take the first 5-7 chars (a typical sentence half) for flexible matching
                    tp['content_sentence'] = clean_line[:7] 
                else:
                    tp['content_sentence'] = clean_line
            break

# Count how many we successfully extracted content for
extracted_count = sum(1 for tp in target_poems if tp['content_sentence'])
print(f"Extracted sentences for {extracted_count} out of {len(target_poems)} tracked poems from old DB.")

# 3. Search the extracted sentences in the new Gushiwen DB
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
                # clean new content
                clean_new = re.sub(r'[，。？！、；：“”‘’【】「」《》\s]', '', new_content)
                
                for tp in target_poems:
                    if not tp['found_in_new'] and tp['content_sentence']:
                        if tp['content_sentence'] in clean_new:
                            tp['found_in_new'] = True
    except Exception as e:
        pass

# 4. Report
found_count = sum(1 for tp in target_poems if tp['found_in_new'])
print(f"\nContent-based Coverage in Gushiwen: {found_count}/{extracted_count} ({(found_count/extracted_count)*100:.2f}% if we only count ones we had text for)")

print("\nStill Missing poems (based on content search):")
for tp in target_poems:
    if tp['content_sentence'] and not tp['found_in_new']:
        print(f"  - [{tp['id']}] -> Searched text: '{tp['content_sentence']}'")

