#!/usr/bin/env python3
"""
smart_fetch.py
从 yxcs/poems-db 智能获取诗歌数据。

策略：
  poems1-4.json 太大（各35-42MB），无法整下。
  改用 GitHub API tree 获取完整文件列表，
  用 search API 精确获取匹配的诗歌对象，
  或直接解析 poems-single.json（41KB，包含精选名篇）作为种子。
"""

import json
import base64
import urllib.request
import time
import re
import os
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
YXCS_LOCAL = DATA_DIR / "poems-single.json"


def load_seed_titles() -> set[str]:
    """加载所有种子标题（去重归一化）"""
    titles = set()
    for fname in ["tang300.json", "edu_required.json", "xunhualing65.json"]:
        path = DATA_DIR / "seed_lists" / fname
        if path.exists():
            with open(path, encoding="utf-8") as f:
                try:
                    items = json.load(f)
                except json.JSONDecodeError:
                    items = [l.strip() for l in open(path) if l.strip()]
            for item in items:
                if isinstance(item, str) and item.strip():
                    titles.add(re.sub(r"\s+", "", item.strip()))
                elif isinstance(item, dict):
                    t = item.get("title", "").strip()
                    if t:
                        titles.add(re.sub(r"\s+", "", t))
    return titles


def normalize(s: str) -> str:
    return re.sub(r"[\s，。！？、；：""''【】『』「」()（）.?!,]", "", s).strip().lower()


def match_title(seed: str, title: str) -> bool:
    """宽松匹配"""
    s, t = normalize(seed), normalize(title)
    if not s or not t:
        return False
    return s in t or t in s or (len(s) >= 2 and s[:2] == t[:2])


def fetch_gh_api(path: str) -> dict:
    """通过 gh CLI 调用 GitHub API"""
    import subprocess
    result = subprocess.run(
        ["gh", "api", path],
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        print(f"  gh api error for {path}: {result.stderr[:100]}")
        return {}
    return json.loads(result.stdout)


def fetch_file_content(owner: str, repo: str, path: str) -> str:
    """通过 gh api 获取文件 base64 内容"""
    import subprocess
    result = subprocess.run(
        ["gh", "api", f"repos/{owner}/{repo}/contents/{path}", "--jq", ".content"],
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        return ""
    return base64.b64decode(result.stdout.strip()).decode("utf-8")


def search_poems_in_large_file(large_file_content: str, target_titles: set[str]) -> list[dict]:
    """
    在大型 JSON 文件（每行一个 JSON 对象，ndjson 格式）中搜索目标标题。
    yxcs poems1-4.json 就是这种格式。
    但文件太大，无法全部读入。
    改用：按文本特征搜索。
    """
    # 逐行扫描
    results = []
    lines = large_file_content.splitlines()
    print(f"  Scanning {len(lines)} lines in ndjson file...")
    matched_titles = set()
    for i, line in enumerate(lines):
        if i % 50000 == 0:
            print(f"  Progress: {i}/{len(lines)} lines...")
        line = line.strip()
        if not line or line in ("[", "]", ","):
            continue
        try:
            obj = json.loads(line)
            title = obj.get("title", "")
            author = obj.get("author", "")
            if not title:
                continue
            for seed in target_titles:
                if match_title(seed, title) and title not in matched_titles:
                    results.append(obj)
                    matched_titles.add(title)
                    break
        except json.JSONDecodeError:
            continue
    return results


def main():
    seed_titles = load_seed_titles()
    print(f"Loaded {len(seed_titles)} seed titles")

    # 方案A：直接下载 poems-single.json（41KB，包含精选名篇）
    # 这个文件已经下载好了

    if YXCS_LOCAL.exists() and os.path.getsize(YXCS_LOCAL) > 1000:
        with open(YXCS_LOCAL, encoding="utf-8") as f:
            lines = f.readlines()
        poems = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                poems.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        print(f"poems-single.json: {len(poems)} poems")

        # 过滤
        matched = []
        for poem in poems:
            title = poem.get("title", "")
            for seed in seed_titles:
                if match_title(seed, title):
                    matched.append(poem)
                    break
        print(f"Matched from poems-single.json: {len(matched)}")

        # 输出
        output = DATA_DIR / "poems.json"
        clean = []
        for i, poem in enumerate(matched, 1):
            content = poem.get("content", [])
            ptype = poem.get("type", "未知")
            if not content or not isinstance(content, list):
                continue
            # 清理标点
            punc = re.compile(r"[，。？！、；：""''【】『』「」()（）.?!,\s]")
            clean_lines = [punc.sub("", c) for c in content]
            # 过滤掉句子太短的
            if len(clean_lines) < 2 or len(clean_lines[0]) < 4:
                continue
            # 生成 allChars
            chars = set()
            for line in clean_lines:
                for c in line:
                    if c.strip():
                        chars.add(c)
            if len(clean_lines[0]) == 5:
                ptype = "五言"
            elif len(clean_lines[0]) == 7:
                ptype = "七言"
            import hashlib
            pid = hashlib.md5(f"{poem.get('title','')}:{poem.get('author','')}".encode()).hexdigest()[:12]
            clean.append({
                "id": pid,
                "rank": i,
                "title": poem.get("title", ""),
                "author": poem.get("author", ""),
                "dynasty": poem.get("dynasty", ""),
                "type": ptype,
                "lines": content,
                "cleanLines": clean_lines,
                "note": poem.get("note", ""),
                "allChars": sorted(list(chars)),
            })

        with open(output, "w", encoding="utf-8") as f:
            json.dump(clean, f, ensure_ascii=False, indent=2)
        print(f"\nWrote {len(clean)} poems to {output}")
        for p in clean[:5]:
            print(f"  {p['rank']}. {p['title']} — {p['author']}（{p['dynasty']}）")
    else:
        print("poems-single.json not found or too small, trying alternative...")


if __name__ == "__main__":
    main()
