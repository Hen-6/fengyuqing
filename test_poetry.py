import os
import json
import glob

# The four verses to search
queries = [
    "羽衣常带烟霞色，不染人间桃李花",
    "还似旧时游上苑，车如流水马如龙",
    "举头望明月，低头思故乡",
    "白云来往青山在，对酒开怀"
]

def search_json_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            # handle array of objects
            if isinstance(data, list):
                for item in data:
                    # check all values in the dict
                    text_content = ""
                    if 'paragraphs' in item:
                        text_content += "".join(item['paragraphs'])
                    if 'content' in item:
                        if isinstance(item['content'], list):
                            text_content += "".join(item['content'])
                        else:
                            text_content += str(item['content'])
                    
                    for q in queries:
                        # strip punctuation for flexible matching
                        q_clean = q.replace("，", "").replace("。", "")
                        if q_clean in text_content.replace("，", "").replace("。", ""):
                            print(f"Found '{q}' in {filepath}")
                            title = item.get('title', item.get('rhythmic', 'Unknown'))
                            author = item.get('author', 'Unknown')
                            print(f"  -> Title: {title}, Author: {author}")
    except Exception as e:
        pass

if __name__ == "__main__":
    base_dir = "/Users/henry/fengyuqing/chinese-poetry"
    print("Searching in chinese-poetry...")
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.endswith(".json"):
                search_json_file(os.path.join(root, file))
    print("Done.")
