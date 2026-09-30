import json
import opencc
import hashlib

cc = opencc.OpenCC('t2s')

def make_id(title, author):
    return hashlib.md5(f"{title}:{author}".encode()).hexdigest()

input_file = "data/meilisearch_poems.json"
output_file = "data/meilisearch_poems_simplified.json"

print(f"Reading {input_file}...")
with open(input_file, 'r', encoding='utf-8') as f:
    poems = [json.loads(line) for line in f]

print("Converting to Simplified Chinese...")
for p in poems:
    title_sim = cc.convert(p['title'])
    author_sim = cc.convert(p['author'])
    lines_sim = [cc.convert(line) for line in p['lines']]
    
    p['title'] = title_sim
    p['author'] = author_sim
    p['lines'] = lines_sim
    p['id'] = make_id(title_sim, author_sim)

seen = set()
deduped_docs = []
for doc in poems:
    if doc['id'] not in seen:
        seen.add(doc['id'])
        deduped_docs.append(doc)

print(f"Writing {output_file}...")
with open(output_file, 'w', encoding='utf-8') as f:
    for doc in deduped_docs:
        f.write(json.dumps(doc, ensure_ascii=False) + "\n")

import os
os.replace(output_file, input_file)

print(f"Done! 314k simplified poems saved. Original size {len(poems)}, deduped size {len(deduped_docs)}")
