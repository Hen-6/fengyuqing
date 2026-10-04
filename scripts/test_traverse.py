import json

def extract_poems(obj):
    poems = []
    
    if isinstance(obj, list):
        for item in obj:
            poems.extend(extract_poems(item))
    elif isinstance(obj, dict):
        # Is this node a poem?
        # It's a poem if it has paragraphs (list of strings)
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
            poems.append({"t": title, "a": author, "content": lines})
        else:
            # Not a poem, recurse into all values
            for k, v in obj.items():
                if isinstance(v, (dict, list)):
                    poems.extend(extract_poems(v))
    return poems

with open('chinese-poetry/蒙学/tangshisanbaishou.json') as f:
    data = json.load(f)
    extracted = extract_poems(data)
    print("Extracted from tangshisanbaishou:", len(extracted))
    print(extracted[0])

with open('chinese-poetry/全唐诗/唐诗三百首.json') as f:
    data = json.load(f)
    extracted = extract_poems(data)
    print("Extracted from normal 唐诗三百首:", len(extracted))
    print(extracted[0])
