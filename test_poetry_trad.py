import os
import json

queries = [
    ("羽衣常带烟霞色", "羽衣常帶煙霞色"),
    ("还似旧时游上苑", "還似舊時游上苑", "還似舊時遊上苑", "车如流水马如龙", "車如流水馬如龍"),
    ("举头望明月", "舉頭望明月", "低头思故乡", "低頭思故鄉", "举头望山月", "舉頭望山月", "静夜思", "靜夜思"),
    ("白云来往青山在", "白雲來往青山在")
]

def search_json_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    text_content = ""
                    if 'paragraphs' in item:
                        text_content += "".join(item['paragraphs'])
                    if 'content' in item:
                        if isinstance(item['content'], list):
                            text_content += "".join(item['content'])
                        else:
                            text_content += str(item['content'])
                    title = item.get('title', item.get('rhythmic', 'Unknown'))
                    text_content += title
                    
                    for idx, group in enumerate(queries):
                        for q in group:
                            if q in text_content:
                                author = item.get('author', 'Unknown')
                                print(f"Query Group {idx+1} Match: '{q}' in {filepath}")
                                print(f"  -> Title: {title}, Author: {author}")
                                if 'paragraphs' in item:
                                    print(f"  -> Text: {''.join(item['paragraphs'])}")
                                break # match one per group is enough
    except Exception as e:
        pass

base_dir = "/Users/henry/fengyuqing/chinese-poetry"
for root, dirs, files in os.walk(base_dir):
    if root.endswith(".git"): continue
    for file in files:
        if file.endswith(".json"):
            search_json_file(os.path.join(root, file))
