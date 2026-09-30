import json
import glob
import os
import hashlib
from pathlib import Path

def make_id(title, author):
    return hashlib.md5(f"{title}:{author}".encode()).hexdigest()

documents = []

# Tang & Song Shi
shi_files = list(Path("chinese-poetry").rglob("poet.tang.*.json")) + list(Path("chinese-poetry").rglob("poet.song.*.json"))
for file in shi_files:
    with open(file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for item in data:
            title = item.get("title", "").strip()
            author = item.get("author", "佚名").strip()
            lines = item.get("paragraphs", [])
            dynasty = "唐" if "tang" in file.name else "宋"
            if title and lines:
                documents.append({
                    "id": make_id(title, author),
                    "title": title,
                    "author": author,
                    "dynasty": dynasty,
                    "lines": lines
                })

# Song Ci
ci_files = list(Path("chinese-poetry").rglob("ci.song.*.json"))
for file in ci_files:
    with open(file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for item in data:
            title = item.get("rhythmic", "").strip()
            author = item.get("author", "佚名").strip()
            lines = item.get("paragraphs", [])
            if title and lines:
                documents.append({
                    "id": make_id(title, author),
                    "title": title,
                    "author": author,
                    "dynasty": "宋",
                    "lines": lines
                })

# Shi Jing
shijing_files = list(Path("chinese-poetry").rglob("shijing.json"))
for file in shijing_files:
    with open(file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for item in data:
            title = item.get("title", "").strip()
            lines = item.get("content", [])
            if title and lines:
                documents.append({
                    "id": make_id(title, "佚名"),
                    "title": title,
                    "author": "佚名",
                    "dynasty": "先秦",
                    "lines": lines
                })

# Deduplicate based on id
seen = set()
deduped_docs = []
for doc in documents:
    if doc['id'] not in seen:
        seen.add(doc['id'])
        deduped_docs.append(doc)

print(f"Parsed {len(deduped_docs)} unique poems.")

output_path = "data/meilisearch_poems.json"
with open(output_path, "w", encoding="utf-8") as f:
    for doc in deduped_docs:
        f.write(json.dumps(doc, ensure_ascii=False) + "\n")

print(f"Saved to {output_path}")
