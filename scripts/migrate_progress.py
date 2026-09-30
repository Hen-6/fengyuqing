import json

progress_file = "/Users/henry/Downloads/fengyuqing-progress (5).json"
new_db_file = "data/meilisearch_poems.json"
output_file = "/Users/henry/Downloads/fengyuqing-progress-migrated.json"

print(f"Loading new database from {new_db_file}...")
with open(new_db_file, 'r', encoding='utf-8') as f:
    new_poems = [json.loads(line) for line in f]

# Create a lookup dictionary for fast matching
new_lookup = {}
for p in new_poems:
    t = p['title']
    a = p['author']
    new_lookup[f"{t}:{a}"] = p

def find_new_key(old_key):
    # Try exact match first
    if old_key in new_lookup:
        return old_key
        
    parts = old_key.split(':')
    if len(parts) == 2:
        old_title, old_author = parts
        
        # Handle ' / ' aliases
        if ' / ' in old_title:
            titles_to_try = old_title.split(' / ')
        else:
            titles_to_try = [old_title]
            
        for t in titles_to_try:
            t = t.strip()
            test_key = f"{t}:{old_author}"
            if test_key in new_lookup:
                return test_key
                
            # Try finding substring titles in the new database
            for np in new_poems:
                if np['author'] == old_author and (t in np['title'] or np['title'] in t):
                    return f"{np['title']}:{np['author']}"
                    
    # If still not found, return None
    return None

print(f"Loading user progress from {progress_file}...")
with open(progress_file, 'r', encoding='utf-8') as f:
    progress = json.load(f)

old_poems = progress.get('poems', {})
new_poems_dict = {}

matched = 0
unmatched = []

for old_key, data in old_poems.items():
    new_key = find_new_key(old_key)
    if new_key:
        data['poemId'] = new_key
        new_poems_dict[new_key] = data
        matched += 1
    else:
        unmatched.append(old_key)

progress['poems'] = new_poems_dict

print(f"Writing migrated progress to {output_file}...")
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(progress, f, ensure_ascii=False, indent=2)

print(f"Successfully migrated {matched} / {len(old_poems)} poems.")
if unmatched:
    print("Could not find matches for the following poems (they will be dropped from progress):")
    for u in unmatched:
        print(f"  - {u}")
