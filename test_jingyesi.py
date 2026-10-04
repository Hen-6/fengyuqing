import os
import json

def search_json_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    title = item.get('title', item.get('rhythmic', 'Unknown'))
                    if '静夜思' in title:
                        print(f"File: {filepath}")
                        print(f"Title: {title}, Author: {item.get('author', 'Unknown')}")
                        if 'paragraphs' in item:
                            print(f"Content: {item['paragraphs']}")
    except Exception as e:
        pass

base_dir = "/Users/henry/fengyuqing/chinese-poetry"
for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith(".json"):
            search_json_file(os.path.join(root, file))
