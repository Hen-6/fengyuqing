#!/usr/bin/env python3
"""
build_poems_index.py — 构建本地诗词索引

从 rank.json 读取 47K 首诗的优先级列表，
在 yxcs poems1-4.json 中查找对应诗句内容，
生成 poems_content.json（47K 条 title:author → content 映射）
和 poems.json（扩展 rank.json，加上 lines/content 字段）

输出：
  data/poems.json       — rank.json + content（供搜索和显示）
  data/poems_content.json — title:author → lines 映射（供在线搜索）

yxcs 字段映射：
  name   → title
  author → author
  content → lines（含标点）
  note   → note
"""

import json
import re
import hashlib
import sqlite3
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
YXCS_DIR = DATA_DIR / "yxcs"
OUTPUT_POEMS = DATA_DIR / "poems.json"
OUTPUT_CONTENT = DATA_DIR / "poems_content.json"

PUNCT_RE = re.compile(
    r"[，。？！、；：""''【】「」()（）·—–…\s.,?!'\":;\[\]]+"
)


def normalize_key(title: str, author: str) -> str:
    """生成规范化的 poem key"""
    return f"{title.strip()}:{author.strip()}"


def clean_html(text) -> str:
    if not isinstance(text, str):
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()


def strip_punct(s: str) -> str:
    return PUNCT_RE.sub("", s)


def load_rank_list() -> list[dict]:
    """加载 rank.json"""
    with open(DATA_DIR / "rank.json", encoding="utf-8") as f:
        return json.load(f)


def build_yxcs_index() -> dict[str, dict]:
    """
    扫描本地 yxcs poems1-4.json，构建 title:author → poem 映射。
    yxcs 用 name/author 字段。处理重名诗（不同作者）。
    """
    index: dict[str, dict] = {}
    for fname in ["poems1.json", "poems2.json", "poems3.json", "poems4.json"]:
        fpath = YXCS_DIR / fname
        if not fpath.exists():
            print(f"  [WARN] {fname} not found, skipping")
            continue
        print(f"  Indexing {fname}...")
        with open(fpath, encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line or line in ("[", "]", ","):
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                name = clean_html(obj.get("name") or obj.get("title") or "")
                author = (obj.get("author") or "佚名").strip()
                if not name:
                    continue

                # 取第一份内容即可（yxcs 中同名诗通常只有一份内容）
                key = normalize_key(name, author)
                if key in index:
                    continue  # 已有，跳过

                raw_content = obj.get("content") or []
                content = [clean_html(c) for c in raw_content if clean_html(c)]
                if not content:
                    continue

                index[key] = {
                    "name": name,
                    "author": author,
                    "dynasty": obj.get("dynasty") or "",
                    "content": content,
                    "note": clean_html(
                    "".join(
                        t if isinstance(t, str) else ""
                        for t in (obj.get("note") or obj.get("notes") or [])
                    )
                ),
                }

                if line_num % 100000 == 0:
                    print(f"    {fname}: {line_num} lines scanned, {len(index)} poems indexed")

    print(f"  Total indexed: {len(index)} poems")
    return index


def generate_poems_json(rank_list: list[dict], yxcs_index: dict[str, dict]) -> list[dict]:
    """
    合并 rank.json + yxcs 内容，生成 poems.json。
    rank.json 中每首诗按 r（rank）排序，保持优先级顺序。
    """
    poems = []
    matched = 0
    unmatched = 0

    for entry in rank_list:
        title = entry.get("t", "").strip()
        author = entry.get("a", "").strip()
        key = normalize_key(title, author)

        poem = dict(entry)
        poem["id"] = hashlib.md5(key.encode()).hexdigest()[:12]

        if key in yxcs_index:
            src = yxcs_index[key]
            poem["content"] = src["content"]
            poem["note"] = src["note"]
            # 推断诗体
            if src["content"]:
                clean0 = strip_punct(src["content"][0])
                if len(clean0) == 5:
                    poem["type"] = "五言绝句" if len(src["content"]) <= 4 else "五言律诗"
                elif len(clean0) == 7:
                    poem["type"] = "七言绝句" if len(src["content"]) <= 4 else "七言律诗"
            matched += 1
        else:
            poem["content"] = []
            poem["note"] = ""
            unmatched += 1

        poems.append(poem)

    print(f"  Matched: {matched}, unmatched: {unmatched}")
    return poems


def generate_content_json(yxcs_index: dict[str, dict]) -> dict[str, dict]:
    """
    生成 poems_content.json: title:author → lines 映射，
    用于客户端搜索（只含 lines 数组，最小体积）。
    """
    content_map: dict[str, dict] = {}
    for key, poem in yxcs_index.items():
        content_map[key] = {
            "lines": poem["content"],
        }
    return content_map


def main():
    print("=" * 60)
    print("Building poems index from local yxcs files")
    print("=" * 60)

    # 1. 加载 rank 列表
    print("\n[1/3] Loading rank.json...")
    rank_list = load_rank_list()
    print(f"  Loaded {len(rank_list)} ranked poems")

    # 2. 构建 yxcs 索引
    print("\n[2/3] Indexing yxcs poems1-4.json...")
    yxcs_index = build_yxcs_index()

    # 3. 生成 poems.json（rank + content 合并）
    print("\n[3/3] Generating poems.json...")
    poems = generate_poems_json(rank_list, yxcs_index)
    with open(OUTPUT_POEMS, "w", encoding="utf-8") as f:
        json.dump(poems, f, ensure_ascii=False)
    print(f"  Wrote {len(poems)} poems to {OUTPUT_POEMS}")

    # 4. 生成 poems_content.json（搜索用）
    print("\n[Bonus] Generating poems_content.json...")
    content_map = generate_content_json(yxcs_index)
    with open(OUTPUT_CONTENT, "w", encoding="utf-8") as f:
        json.dump(content_map, f, ensure_ascii=False)
    print(f"  Wrote {len(content_map)} entries to {OUTPUT_CONTENT}")

    # 打印统计
    total_size = OUTPUT_POEMS.stat().st_size
    content_size = OUTPUT_CONTENT.stat().st_size
    print(f"\n  poems.json:       {total_size / 1024 / 1024:.1f} MB")
    print(f"  poems_content.json: {content_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
