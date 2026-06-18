#!/usr/bin/env python3
"""
生成 Meilisearch 批量上传格式的 poems 索引数据（去标题变体版）。

读取 data/poems_content.json（{key: {lines}}），
对标题变体（青玉案·元夕 vs 青玉案 元夕）去重，
只索引内容最长的那个版本。

输出到 data/meilisearch_poems.json。
"""
import json
import math
import hashlib
import gzip

MIDDLE_DOT = '\u00b7'

def normalize_title(title: str) -> str:
    """去掉标题中的·和空格，得到规范标题用于去重"""
    return title.replace(MIDDLE_DOT, '').replace(' ', '')

def make_canonical_key(title: str, author: str) -> str:
    return f"{normalize_title(title)}:{author}"

def estimate_gzip_mb(ndjson_bytes: bytes) -> float:
    return len(gzip.compress(ndjson_bytes, compresslevel=6)) / 1024 / 1024

def main():
    print("读取 poems_content.json...")
    pc = json.load(open("data/poems_content.json", encoding="utf-8"))
    print(f"  共 {len(pc)} 条记录")

    # ── 1. 去重：按规范 key 分组，保留内容最长的版本 ──
    print("去重标题变体...")
    groups: dict[str, list[tuple]] = {}

    for key, val in pc.items():
        parts = key.rsplit(":", 1)
        if len(parts) == 2:
            title, author = parts
        else:
            title = key
            author = ""

        lines = val.get("lines", []) or []
        content = [l.strip() for l in lines if l and l.strip()]

        canonical = make_canonical_key(title, author)
        if canonical not in groups:
            groups[canonical] = []
        groups[canonical].append((title, author, content, len(content), key))

    # 优先保留有 · 的标题（标准格式），内容更长则覆盖
    def group_sort_key(entry):
        title, _, _, content_len, _ = entry
        prefer_dot = 1 if MIDDLE_DOT in title else 0
        return (prefer_dot, content_len)

    documents = []
    dupes_dropped = 0
    for canonical, entries in groups.items():
        entries.sort(key=group_sort_key, reverse=True)
        title, author, content, _, original_key = entries[0]
        dupes_dropped += len(entries) - 1

        documents.append({
            "id": hashlib.md5(canonical.encode()).hexdigest(),  # hash 作为 doc ID
            "key": canonical,       # 规范 key 保留在字段中（方便调试/查找）
            "title": title.strip(),
            "author": author.strip(),
            "titleAuthor": f"{title.strip()} {author.strip()}",
            "lines": content,
            "inLibrary": False,
        })

    print(f"  去重后: {len(documents)} 条（丢弃 {dupes_dropped} 条标题变体）")

    # ── 2. 写出 NDJSON ──
    output_path = "data/meilisearch_poems.json"
    print(f"写入 {output_path}...")

    with open(output_path, "w", encoding="utf-8") as f:
        for doc in documents:
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")

    raw_bytes = sum(len(json.dumps(d, ensure_ascii=False).encode()) for d in documents)
    print(f"\n生成完成：{len(documents)} 条记录")
    print(f"  raw size:   {raw_bytes / 1024 / 1024:.1f} MB")

    with open(output_path, "rb") as f:
        gz_mb = estimate_gzip_mb(f.read())
    print(f"  est. gzip:  ~{gz_mb:.1f} MB")

    print("\n" + "=" * 60)
    print("上传命令：")
    print("=" * 60)
    print()
    print("curl -X POST 'http://127.0.0.1:7700/indexes/poems/documents' \\")
    print("  -H 'Authorization: Bearer fengyuqing_dev' \\")
    print("  -H 'Content-Type: application/x-ndjson' \\")
    print("  --data-binary @data/meilisearch_poems.json")
    print()
    print("然后重建索引设置：")
    print("curl -X PATCH 'http://127.0.0.1:7700/indexes/poems/settings' \\")
    print("  -H 'Authorization: Bearer fengyuqing_dev' \\")
    print("  -H 'Content-Type: application/json' \\")
    print("  --data '{\"searchableAttributes\":[\"titleAuthor\",\"lines\"],\"filterableAttributes\":[\"dynasty\",\"author\",\"inLibrary\"]}'")

if __name__ == "__main__":
    main()
