import json
import os

progress_file = '/Users/henry/Downloads/fengyuqing-progress.json'
gushiwen_dir = '/tmp/poetry-test/gushiwen2/guwen'

with open(progress_file, 'r', encoding='utf-8') as f:
    progress_data = json.load(f)

poem_ids = progress_data.get('poems', {}).keys()
target_poems = []
for pid in poem_ids:
    if ":" in pid:
        title, author = pid.split(":", 1)
        # Handle some edge cases in titles if necessary
        target_poems.append({"id": pid, "title": title, "author": author, "found": False})

print(f"Total poems to find: {len(target_poems)}")

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
                
                for tp in target_poems:
                    if not tp['found']:
                        # Exact or partial match on title and author
                        # e.g. title in name or name in title
                        if (tp['title'] in name or name in tp['title']) and (tp['author'] in writer or writer in tp['author']):
                            tp['found'] = True
    except Exception as e:
        pass

found_count = sum(1 for tp in target_poems if tp['found'])
print(f"Coverage: {found_count}/{len(target_poems)} ({(found_count/len(target_poems))*100:.2f}%)")

print("\nMissing poems:")
for tp in target_poems:
    if not tp['found']:
        print(f"  - {tp['title']} : {tp['author']}")
