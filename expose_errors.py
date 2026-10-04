import json

old_db_file = '/Users/henry/fengyuqing/data/poems.json'

with open(old_db_file, 'r', encoding='utf-8') as f:
    old_poems = json.load(f)

print("Exposing critical errors in your CURRENT database:\\n")

for old_p in old_poems:
    title = old_p.get('t', '')
    author = old_p.get('a', '')
    if title == '独坐敬亭山' and author == '李白':
        print(f"Current DB -> Title: {title}, Author: {author}")
        print(f"Content in your DB: {old_p.get('content')[:2]}")
    if title == '静夜思' and author == '李白':
        print(f"Current DB -> Title: {title}, Author: {author}")
        print(f"Content in your DB: {old_p.get('content')[:2]}")
