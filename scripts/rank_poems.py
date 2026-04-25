#!/usr/bin/env python3
"""
rank_poems.py — 生成按知名度排序的 poems.json

数据来源（优先级从高到低）：
  1. 唐诗三百首（蘅塘退士编）— 从 yxcs poems1.json 过滤
  2. 教育部义务教育必背古诗词 — 补充
  3. XunHuaLing 73首精选 — 兜底

poems1.json 是 ndjson 格式，每行一个 JSON 对象，约 40MB。
通过流式下载+逐行处理，避免内存溢出。
"""

import json
import re
import hashlib
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
XUNHUA_SOURCE = DATA_DIR / "xunhualing_source.json"
OUTPUT_FILE = DATA_DIR / "poems.json"
POEMS1_URL = "https://raw.githubusercontent.com/yxcs/poems-db/master/poems1.json"

# ─── 工具函数 ───────────────────────────────────────────────────────────────

def normalize(s: str) -> str:
    return re.sub(r"[\s，。！？、；：""''【】『』「」()（）.?!,]", "", s).lower()

def punct_strip(text: str) -> str:
    return re.sub(r"[，。？！、；：""''【】『』「」()（）.?!,\s]", "", text)

def make_id(title: str, author: str) -> str:
    key = f"{title}:{author}"
    return hashlib.md5(key.encode()).hexdigest()[:12]

# ─── 加载种子列表 ────────────────────────────────────────────────────────────

def load_seed_titles() -> tuple[set[str], list[tuple[str, str]]]:
    """
    加载所有种子标题。
    返回 (normalized_set, [(normalized, original)] 按优先级排序)
    """
    seen = {}
    priority_order = [
        DATA_DIR / "seed_lists" / "tang300.json",
        DATA_DIR / "seed_lists" / "edu_required.json",
    ]
    for fpath in priority_order:
        if not fpath.exists():
            print(f"  ⚠ Seed file not found: {fpath}")
            continue
        with open(fpath, encoding="utf-8") as f:
            raw = f.read().strip()
        try:
            items = json.loads(raw)
        except json.JSONDecodeError:
            items = [l.strip() for l in raw.splitlines() if l.strip()]
        for item in items:
            title = ""
            if isinstance(item, str):
                title = item.strip()
            elif isinstance(item, dict):
                title = (item.get("title") or item.get("name", "")).strip()
            if title:
                norm = normalize(title)
                if norm not in seen:
                    seen[norm] = title
    return set(seen.keys()), [(norm, orig) for norm, orig in seen.items()]

# ─── 匹配函数 ────────────────────────────────────────────────────────────────

def match_title(seed_norm: str, title: str) -> bool:
    title_norm = normalize(title)
    if not seed_norm or not title_norm:
        return False
    return (seed_norm in title_norm or title_norm in seed_norm or
            (len(seed_norm) >= 2 and seed_norm[:2] == title_norm[:2]))

# ─── 处理 yxcs poems1.json ─────────────────────────────────────────────────

def stream_poems1(seed_set: set[str]) -> list[dict]:
    """
    流式下载并处理 poems1.json，只保留匹配种子的诗歌。
    poems1.json 是 ndjson 格式（每行一个 JSON 对象）。
    """
    import urllib.request

    print("下载 poems1.json（流式处理）...")
    poems = []
    matched_norm = set()
    total = 0

    try:
        with urllib.request.urlopen(POEMS1_URL, timeout=120) as resp:
            buffer = []
            for line in resp:
                total += 1
                line = line.decode("utf-8").strip()
                if not line or line in ("[", "]", ","):
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                name = obj.get("name", "")
                if not name:
                    continue

                name_norm = normalize(name)
                if not name_norm:
                    continue

                # 检查是否匹配任意种子标题
                is_match = False
                for seed in seed_set:
                    if match_title(seed, name):
                        is_match = True
                        break

                if not is_match:
                    continue

                if name_norm in matched_norm:
                    continue
                matched_norm.add(name_norm)

                poems.append(obj)

                if len(poems) % 20 == 0:
                    print(f"    已匹配 {len(poems)} 首（扫描 {total} 行）...")

    except Exception as e:
        print(f"  ⚠ 下载 poems1.json 失败: {e}")
        print("  继续使用 XunHuaLing 数据...")

    print(f"  poems1.json 扫描完成：匹配 {len(poems)} 首（扫描 {total} 行）")
    return poems

# ─── 转换 yxcs 格式 ────────────────────────────────────────────────────────

def convert_yxcs(poems: list[dict]) -> list[dict]:
    """将 yxcs 格式转换为标准格式"""
    result = []
    for poem in poems:
        content = poem.get("content", [])
        if not content or not isinstance(content, list) or len(content) < 2:
            continue

        clean_lines = [punct_strip(c) for c in content]
        if len(clean_lines[0]) < 4:
            continue

        chars_set = set()
        for line in clean_lines:
            for c in line:
                if c.strip():
                    chars_set.add(c)

        first_len = len(clean_lines[0])
        if first_len == 5:
            ptype = poem.get("type", "") or "五言"
        elif first_len == 7:
            ptype = poem.get("type", "") or "七言"
        else:
            ptype = poem.get("type", "未知")

        pid = poem.get("_id", {}).get("$oid", "") or poem.get("_id", "")
        if not pid or len(pid) < 6:
            pid = make_id(poem.get("name", ""), poem.get("author", ""))

        result.append({
            "id": pid,
            "title": poem.get("name", ""),
            "author": poem.get("author", ""),
            "dynasty": poem.get("dynasty", ""),
            "type": ptype,
            "lines": content,
            "cleanLines": clean_lines,
            "note": poem.get("note", ""),
            "allChars": sorted(list(chars_set)),
            "_yxcs": True,
        })
    return result

# ─── 加载 XunHuaLing 73首 ─────────────────────────────────────────────────

def load_xunhua() -> list[dict]:
    """加载 XunHuaLing 73首（兜底）"""
    if not XUNHUA_SOURCE.exists():
        print(f"  ⚠ XunHuaLing source not found: {XUNHUA_SOURCE}")
        return []
    with open(XUNHUA_SOURCE, encoding="utf-8") as f:
        poems = json.load(f)
    result = []
    for p in poems:
        lines = p.get("lines", [])
        clean_lines = [punct_strip(l) for l in lines]
        chars_set = list(dict.fromkeys(c for l in clean_lines for c in l if c.strip()))
        ptype = p.get("type", "")
        if not ptype:
            if clean_lines and len(clean_lines[0]) == 5:
                ptype = "五言"
            elif clean_lines and len(clean_lines[0]) == 7:
                ptype = "七言"
            else:
                ptype = "未知"
        result.append({
            "id": p.get("id") or make_id(p.get("title", ""), p.get("author", "")),
            "title": p.get("title", ""),
            "author": p.get("author", ""),
            "dynasty": p.get("dynasty", ""),
            "type": ptype,
            "lines": lines,
            "cleanLines": clean_lines,
            "note": "",
            "allChars": chars_set,
            "_xunhua": True,
        })
    return result

# ─── 主逻辑 ────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("风雨情 — 诗词数据库生成器")
    print("=" * 60)

    # 1. 加载种子列表
    seed_set, seed_list = load_seed_titles()
    print(f"\n✅ 种子标题：{len(seed_set)} 个（唐诗三百首 + 教育部必背）")

    # 2. 从 poems1.json 提取匹配项
    yxcs_poems = stream_poems1(seed_set)
    yxcs_converted = convert_yxcs(yxcs_poems)
    yxcs_titles_norm = {normalize(p["title"]) for p in yxcs_converted}
    print(f"\n✅ 从 yxcs 匹配：{len(yxcs_converted)} 首")

    # 3. 加载 XunHuaLing（兜底未匹配项）
    xunhua_poems = load_xunhua()
    xunhua_titles_norm = {normalize(p["title"]) for p in xunhua_poems}
    print(f"✅ XunHuaLing：{len(xunhua_poems)} 首")

    # 4. 合并去重
    all_poems_dict: dict[str, dict] = {}
    seen_ids: set[str] = set()

    # 先加 yxcs（优先级高）
    for p in yxcs_converted:
        pid = p["id"]
        if pid not in seen_ids:
            all_poems_dict[normalize(p["title"]) + "_" + pid[:4]] = p
            seen_ids.add(pid)

    # 再加 XunHuaLing（兜底，只加不在 yxcs 中的）
    for p in xunhua_poems:
        pid = p["id"]
        title_norm = normalize(p["title"])
        key = title_norm + "_" + pid[:4]
        if key not in all_poems_dict:
            all_poems_dict[key] = p
            seen_ids.add(pid)

    all_poems = list(all_poems_dict.values())

    # 5. 按优先级排序
    # 已在 yxcs 中（_yxcs=True）的排前面
    yxcs_sorted = sorted([p for p in all_poems if p.get("_yxcs")], key=lambda p: p["title"])
    xunhua_sorted = sorted([p for p in all_poems if p.get("_xunhua") and not p.get("_yxcs")], key=lambda p: p["title"])
    all_poems = yxcs_sorted + xunhua_sorted

    # 6. 更新 rank
    for i, p in enumerate(all_poems, 1):
        p["rank"] = i
        # 清理内部字段
        for key in ["_yxcs", "_xunhua"]:
            p.pop(key, None)

    # 7. 写输出
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_poems, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"✅ 写入 {len(all_poems)} 首诗 → {OUTPUT_FILE}")
    print(f"   yxcs 匹配：{len(yxcs_sorted)} 首")
    print(f"   XunHuaLing 兜底：{len(xunhua_sorted)} 首")
    print(f"\n前20首：")
    for p in all_poems[:20]:
        print(f"  {p['rank']:3d}. {p['title']} — {p['author']}（{p['dynasty']}）")

if __name__ == "__main__":
    main()
