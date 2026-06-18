#!/usr/bin/env python3
"""
从 poems_content.json（192K 首，仅有 lines）和 yxcs JSONL（215K 首，含 dynasty/content）
合并，生成 public/data/all_poems_lookup.json。

数据源策略：
  - content: poems_content.json（干净，无 markup）
  - dynasty:  yxcs（yxcs 唯一，content 最长优先）
  - 无重复 key
"""
import json
import os
import re

MARKUP_RE = re.compile(r'<[^>]+>')
MIDDLE_DOT = '\u00b7'

def strip_markup(text):
    """去掉 HTML markup 标签"""
    return MARKUP_RE.sub('', text)

def normalize_title(title: str) -> str:
    """去掉标题中的·和空格，得到规范标题用于去重"""
    return title.replace(MIDDLE_DOT, '').replace(' ', '')

def make_canonical_key(title: str, author: str) -> str:
    """生成规范化的 key，用于去重"""
    return f"{normalize_title(title)}:{author}"

def main():
    # 1. 加载 poems_content.json（title:author -> {lines}）—— 干净内容
    print("加载 poems_content.json（192K）...")
    pc = json.load(open("data/poems_content.json", encoding="utf-8"))
    print(f"  {len(pc)} 条记录")

    # 2. 扫描 yxcs JSONL，构建 key -> {dynasty, content} 映射
    #    同一 key 可能出现多次，保留内容最长的那个
    print("扫描 yxcs JSONL（收集 dynasty / 取内容最长版本）...")
    yxcs_map = {}
    dupes_in_yxcs = 0
    dupes_content_diff = 0

    for fname in ["yxcs/poems1.json", "yxcs/poems2.json", "yxcs/poems3.json", "yxcs/poems4.json"]:
        added = 0
        updated = 0
        with open(f"data/{fname}", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    p = json.loads(line)
                except Exception:
                    continue
                name = p.get("name", "").strip()
                author = p.get("author", "").strip()
                dynasty = p.get("dynasty", "").strip()
                raw_content = p.get("content") or []

                if not name or not author:
                    continue

                key = f"{name}:{author}"

                # 清理 markup
                clean_content = []
                for para in raw_content:
                    if isinstance(para, str):
                        cleaned = strip_markup(para).strip()
                        if cleaned:
                            clean_content.append(cleaned)

                content_len = len(clean_content)

                if key in yxcs_map:
                    dupes_in_yxcs += 1
                    # 保留内容更长的版本
                    if content_len > len(yxcs_map[key]["content"]):
                        yxcs_map[key] = {"content": clean_content, "dynasty": dynasty}
                        updated += 1
                    elif content_len == len(yxcs_map[key]["content"]) and clean_content != yxcs_map[key]["content"]:
                        dupes_content_diff += 1
                else:
                    yxcs_map[key] = {"content": clean_content, "dynasty": dynasty}
                    added += 1

        print(f"  {fname}: 新增 {added}，更新 {updated}（累计 {len(yxcs_map)}）")

    print(f"  yxcs 内重复 key: {dupes_in_yxcs}，内容不同: {dupes_content_diff}")

    # 3. 合并：content ← poems_content.json，dynasty ← yxcs
    #    去重：标题变体（青玉案·元夕 vs 青玉案 元夕）保留内容最长的版本
    print("\n合并中（去重标题变体）...")
    canonical_groups: dict[str, list[tuple]] = {}

    for key, val in pc.items():
        parts = key.rsplit(":", 1)
        if len(parts) == 2:
            title, author = parts
        else:
            title = key
            author = ""

        pc_lines = val.get("lines", []) or []
        pc_content = [l.strip() for l in pc_lines if l and l.strip()]
        content_len = len(pc_content)

        yxcs = yxcs_map.get(key, {})
        dynasty = yxcs.get("dynasty") or ""

        canonical = make_canonical_key(title, author)
        if canonical not in canonical_groups:
            canonical_groups[canonical] = []
        canonical_groups[canonical].append((title, author, pc_content, content_len, dynasty, key))

    print(f"  原始 poems_content.json: {len(pc)} 条")
    print(f"  去重后: {len(canonical_groups)} 条")

    # 从每个 group 中选内容最长的版本
    merged = []
    missing_dyn = 0
    variant_deduped = 0

    for canonical, entries in canonical_groups.items():
        if len(entries) > 1:
            variant_deduped += len(entries) - 1
        # 按 content_len 降序，取最长的
        entries.sort(key=lambda e: e[3], reverse=True)
        title, author, content, _, dynasty, _ = entries[0]

        if not dynasty:
            missing_dyn += 1

        merged.append({
            "t": title.strip(),
            "a": author.strip(),
            "d": dynasty,
            "content": content,
        })

    print(f"  标题变体去重: {variant_deduped} 条合并")
    print(f"  缺失 dynasty: {missing_dyn}")

    # 4. 写出 JSON（仅 poems 数组，keyMap 已不需要）
    out_json = "public/data/all_poems_lookup.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({"poems": merged}, f, ensure_ascii=False)
    size_mb = os.path.getsize(out_json) / 1024 / 1024
    print(f"\n写出 {out_json}（{size_mb:.1f} MB）")

    # 5. 生成 TypeScript
    ts_out = "src/data/allPoemsLookup.ts"
    with open(ts_out, "w", encoding="utf-8") as f:
        f.write("// AUTO-GENERATED by scripts/build_all_poems.py — DO NOT EDIT\n")
        f.write('"use client";\n\n')
        f.write("/** 全部诗词本地查找（content 来自 poems_content.json，干净无 markup）。\n")
        f.write(f" *  total={len(merged)} | titleVariantsDeduped={variant_deduped} | missingDyn={missing_dyn}\n")
        f.write(" */\n\n")
        f.write("export interface PoemData { t: string; a: string; d: string; content: string[]; }\n\n")
        f.write("let _cache: Map<string, PoemData> | null = null;\n\n")
        f.write("// 规范化标题：去掉 · 和空格，确保变体标题查到同一首诗\n")
        f.write("const MIDDLE_DOT = '\\u00b7'\n")
        f.write("function normalizeTitle(title: string): string {\n")
        f.write("  return title.replace(MIDDLE_DOT, '').replace(/ /g, '')\n")
        f.write("}\n\n")
        f.write("async function _load(): Promise<Map<string, PoemData>> {\n")
        f.write("  if (_cache) return _cache;\n")
        f.write("  const res = await fetch('/data/all_poems_lookup.json');\n")
        f.write("  const data: { poems: PoemData[] } = await res.json();\n")
        f.write("  _cache = new Map();\n")
        f.write("  for (const p of data.poems) {\n")
        f.write("    const canonical = `${normalizeTitle(p.t)}:${p.a}`\n")
        f.write("    _cache.set(canonical, p)\n")
        f.write("  }\n")
        f.write("  return _cache;\n")
        f.write("}\n\n")
        f.write("export function getPoemByKeyFast(key: string): PoemData | undefined {\n")
        f.write("  if (!_cache) return undefined\n")
        f.write("  const lastColon = key.lastIndexOf(':')\n")
        f.write("  if (lastColon < 0) return undefined\n")
        f.write("  const title = key.slice(0, lastColon)\n")
        f.write("  const author = key.slice(lastColon + 1)\n")
        f.write("  return _cache.get(`${normalizeTitle(title)}:${author}`)\n")
        f.write("}\n\n")
        f.write("export async function loadAllPoemsLookup(): Promise<Map<string, PoemData>> {\n")
        f.write("  return _load();\n")
        f.write("}\n")
    print(f"写出 {ts_out}")
    print("\n完成！")

if __name__ == "__main__":
    main()
