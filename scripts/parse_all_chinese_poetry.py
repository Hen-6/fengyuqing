import json
import glob
import os
import hashlib
from pathlib import Path
import opencc

cc = opencc.OpenCC('t2s')

def make_id(title, author, lines):
    return hashlib.md5(f"{title}:{author}:{lines}".encode()).hexdigest()

documents = []
seen = set()

def clean_lines(lines):
    return [cc.convert(str(l).strip()) for l in lines if str(l).strip()]

def extract_poems(obj, file_path_str, dynasty_hint):
    poems = []
    
    if isinstance(obj, list):
        for item in obj:
            poems.extend(extract_poems(item, file_path_str, dynasty_hint))
    elif isinstance(obj, dict):
        lines = []
        if "paragraphs" in obj and isinstance(obj["paragraphs"], list) and len(obj["paragraphs"]) > 0 and isinstance(obj["paragraphs"][0], str):
            lines = obj["paragraphs"]
        elif "content" in obj and isinstance(obj["content"], list) and len(obj["content"]) > 0 and isinstance(obj["content"][0], str):
            lines = obj["content"]
        elif "sections" in obj and isinstance(obj["sections"], list) and len(obj["sections"]) > 0 and isinstance(obj["sections"][0], str):
            lines = obj["sections"]
            
        if lines:
            title = obj.get("title") or obj.get("rhythmic") or obj.get("chapter") or ""
            author = obj.get("author") or "佚名"
            
            # Use cc.convert only when appending to save redundant operations
            c_title = cc.convert(str(title).strip())
            c_author = cc.convert(str(author).strip())
            c_lines = clean_lines(lines)
            
            if c_title and c_lines:
                pid = make_id(c_title, c_author, "".join(c_lines))
                if pid not in seen:
                    seen.add(pid)
                    poems.append({
                        "t": c_title,
                        "a": c_author,
                        "d": dynasty_hint,
                        "content": c_lines
                    })
        else:
            # Not a poem, recurse
            for k, v in obj.items():
                if isinstance(v, (dict, list)):
                    poems.extend(extract_poems(v, file_path_str, dynasty_hint))
    return poems

all_files = list(Path("chinese-poetry").rglob("*.json"))

for file in all_files:
    # Skip non-poem structural files
    if "node_modules" in str(file) or file.name in ("package.json", "package-lock.json", "strains.json"):
        continue

    try:
        with open(file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            dynasty = "未知"
            path_str = str(file)
            if "tang" in file.name or "全唐诗" in path_str or "水墨唐诗" in path_str: dynasty = "唐"
            elif "song" in file.name or "宋词" in path_str: dynasty = "宋"
            elif "楚辞" in path_str or "shijing" in file.name or "论语" in path_str or "四书五经" in path_str: dynasty = "先秦"
            elif "五代" in path_str: dynasty = "五代"
            elif "元曲" in path_str: dynasty = "元代"
            elif "曹操" in path_str: dynasty = "汉魏"
            elif "纳兰" in path_str: dynasty = "清代"
            
            documents.extend(extract_poems(data, path_str, dynasty))
    except Exception as e:
        pass # silently skip bad files

# Append Daoqing
daoqing_pid = make_id("道情", "白玉蟾", "白云黄鹤道人家，一琴一剑一杯茶。羽衣常带烟霞色，不染人间桃李花。")
if daoqing_pid not in seen:
    documents.append({
        "t": "道情",
        "a": "白玉蟾",
        "d": "宋",
        "content": ["白云黄鹤道人家，一琴一剑一杯茶。", "羽衣常带烟霞色，不染人间桃李花。"]
    })

print(f"Parsed {len(documents)} unique simplified poems.")

import zlib
finalJsonStr = json.dumps({"poems": documents}, ensure_ascii=False)
print(f"Uncompressed JSON size: {(len(finalJsonStr.encode('utf-8'))/1024/1024):.1f} MB")

print("Compressing with zlib (unzipSync compatible)...")
gzipped = zlib.compress(finalJsonStr.encode('utf-8'))
print(f"Gzipped size: {(len(gzipped)/1024/1024):.1f} MB")

with open('public/data/SUPER_DATASET_DEDUPED.bin', 'wb') as f:
    f.write(gzipped)

print("Done packaging.")
