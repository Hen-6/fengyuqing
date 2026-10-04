import json
import os
import re

progress_file = '/Users/henry/Downloads/fengyuqing-progress.json'
gushiwen_dir = '/tmp/poetry-test/gushiwen2/guwen'

with open(progress_file, 'r', encoding='utf-8') as f:
    progress_data = json.load(f)

poem_ids = progress_data.get('poems', {}).keys()
target_poems = []
for pid in poem_ids:
    if ":" in pid:
        title, author = pid.split(":", 1)
        # Normalize: remove "二首", "其一", spaces, and common prefixes
        title_clean = re.sub(r'([一二三四五六七八九十]+首|其[一二三四五六七八九十]+|横吹曲辞|拟古十三首|清平调词|越调・|双调・)', '', title).strip()
        title_clean = re.sub(r'[·・ ]', '', title_clean)
        
        # Normalize author
        author_clean = author.replace('后主煜', '李煜').strip()
        
        target_poems.append({"id": pid, "title": title, "title_clean": title_clean, "author": author, "author_clean": author_clean, "found": False, "matched_as": ""})

for file in os.listdir(gushiwen_dir):
    if not file.endswith('.json'): continue
    filepath = os.path.join(gushiwen_dir, file)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip(): continue
                item = json.loads(line)
                name = item.get('name', item.get('title', ''))
                writer = item.get('writer', item.get('author', ''))
                
                name_clean = re.sub(r'[·・ ]', '', name)
                
                for tp in target_poems:
                    if not tp['found']:
                        # Match author first
                        if tp['author_clean'] in writer or writer in tp['author_clean'] or tp['author_clean'] == '无名氏' and writer == '佚名':
                            # Match title
                            if tp['title_clean'] in name_clean or name_clean in tp['title_clean'] or ('望江南' in tp['title_clean'] and '忆江南' in name_clean):
                                tp['found'] = True
                                tp['matched_as'] = f"{name} : {writer}"
    except Exception as e:
        pass

found_count = sum(1 for tp in target_poems if tp['found'])
print(f"Fuzzy Coverage: {found_count}/{len(target_poems)} ({(found_count/len(target_poems))*100:.2f}%)")

print("\nStill Missing poems:")
for tp in target_poems:
    if not tp['found']:
        print(f"  - {tp['id']}")
