#!/usr/bin/env python3
"""
rank_poems.py — 生成按知名度排序的 poems.json

数据来源（优先级从高到低）：
  1. 唐诗三百首（蘅塘退士编）— 从 yxcs poems1-4.json NDJSON 流式读取
  2. 教育部义务教育必背古诗词 — 补充
  3. 宋词三百首 — chinese-poetry/宋词/宋词三百首.json

输出格式（TypeScript localSearch.ts 期望）：
  r=rank, t=title, a=author, d=dynasty, id, p=rawParagraphs(带标点), c=cleanLines(去标点), n=note
"""

import json
import re
import hashlib
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
OUTPUT_FILE = DATA_DIR / "poems.json"

YXCS_URLS = [
    ("poems1.json", "https://raw.githubusercontent.com/yxcs/poems-db/master/poems1.json"),
    ("poems2.json", "https://raw.githubusercontent.com/yxcs/poems-db/master/poems2.json"),
    ("poems3.json", "https://raw.githubusercontent.com/yxcs/poems-db/master/poems3.json"),
    ("poems4.json", "https://raw.githubusercontent.com/yxcs/poems-db/master/poems4.json"),
]

CI300_URL = "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/%E5%AE%8B%E8%AF%8D/%E5%AE%8B%E8%AF%8D%E4%B8%89%E7%99%BE%E9%A6%96.json"


# ─── 工具函数 ───────────────────────────────────────────────────────────────

def normalize(s: str) -> str:
    """去除标点、空格并小写，用于标题匹配"""
    return re.sub(r"[\s，。！？、；：""''【】『』「」()（）.?!,·《》]", "", s).strip().lower()


def clean_html(text: str) -> str:
    """去除 HTML 标签"""
    return re.sub(r"<[^>]+>", "", text).strip()


def split_lines_preserve_punct(raw_line: str) -> list[str]:
    """
    将一行原始文本拆分为多句，保留句末标点。
    例: '床前明月光，疑是地上霜。举头望明月，低头思故乡。'
    → ['床前明月光，', '疑是地上霜。', '举头望明月，', '低头思故乡。']
    """
    comma_parts = re.split(r"(?<=[，、])", raw_line)
    result: list[str] = []
    for part in comma_parts:
        part = part.strip()
        if not part:
            continue
        sub_parts = re.split(r"(?<=[。！？；])", part)
        for sp in sub_parts:
            sp = sp.strip()
            if sp and len(re.sub(r"[，。！？、；：""''【】「」()（）。.?!,·《》]", "", sp)) >= 2:
                result.append(sp)
    return result


def split_lines(raw_line: str) -> list[str]:
    """
    将一行原始文本拆分为多句（无标点版本）。
    """
    comma_parts = re.split(r"[，、]", raw_line)
    result: list[str] = []
    for part in comma_parts:
        part = part.strip()
        if not part:
            continue
        sub_parts = re.split(r"[。！？；]", part)
        for sp in sub_parts:
            sp = sp.strip()
            if sp and len(sp) >= 2:
                result.append(sp)
    return result


def punct_strip(text: str) -> str:
    """去除所有标点符号"""
    return re.sub(r"[，。！？、；：""''【】「」()（）.?!,\s「」『』—–\-《》〈〉]", "", text)


def make_id(title: str, author: str) -> str:
    key = f"{title}:{author}"
    return hashlib.md5(key.encode()).hexdigest()[:12]


def valid_line(ln: str) -> bool:
    """一句至少含 2 个汉字"""
    return bool(re.search(r"[\u4e00-\u9fff]", ln)) and len(ln) >= 2


# ─── 加载种子列表 ────────────────────────────────────────────────────────────

def load_seed_titles() -> tuple[set[str], list[str]]:
    seen_norm: dict[str, str] = {}
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
            expanded: list[str] = []
            for item in items:
                if not isinstance(item, str):
                    expanded.append(item)
                    continue
                stripped = item.strip()
                if re.match(r'^"[^"]+"(,\s*"[^"]+")+,?$', stripped):
                    try:
                        cleaned = stripped.rstrip(",")
                        parsed = json.loads("[" + cleaned + "]")
                        for p in parsed:
                            if isinstance(p, str) and p.strip():
                                expanded.append(p.strip())
                        continue
                    except Exception:
                        pass
                expanded.append(item)
            items = expanded

        for item in items:
            title = ""
            if isinstance(item, str):
                title = item.strip()
            elif isinstance(item, dict):
                title = (item.get("title") or item.get("name", "")).strip()
            if title:
                norm = normalize(title)
                if norm and norm not in seen_norm:
                    seen_norm[norm] = title

    norms = list(seen_norm.keys())
    return set(norms), norms


def match_title(seed_norm: str, title: str) -> bool:
    title_norm = normalize(title)
    if not seed_norm or not title_norm:
        return False
    if seed_norm in title_norm or title_norm in seed_norm:
        return True

    def strip_suffix(s: str) -> str:
        suffix_order = sorted(
            ["其一", "其二", "其三", "其四", "其五", "其六", "其七",
             "词三首", "词二首", "词一首", "三首", "二首", "一首"],
            key=len, reverse=True
        )
        for suffix in suffix_order:
            if s.endswith(suffix):
                s = s[:-len(suffix)]
        return s

    seed_stripped = strip_suffix(seed_norm)
    title_stripped = strip_suffix(title_norm)
    if seed_stripped and title_stripped:
        if seed_stripped in title_stripped or title_stripped in seed_stripped:
            return True
        if len(seed_stripped) >= 4 and seed_stripped == title_stripped:
            return True
    if len(seed_norm) >= 2 and len(title_norm) >= 2 and seed_norm[:2] == title_norm[:2]:
        return True
    return False


# ─── 推断诗歌类型 ────────────────────────────────────────────────────────────

FORBIDDEN_TYPES = ["散曲", "仙吕", "中吕", "正宫", "双调", "南吕", "越调", "大石调",
                   "般涉调", "商调", "黄钟宫", "商角调", "高平调", "平调",
                   "梧桐雨", "寄生草调", "山坡羊", "清江引", "塞鸿秋",
                   "小令", "套数", "杂剧", "曲牌"]

CI_CANDS = {"沁园春","水调歌头","满江红","念奴娇","水龙吟","永遇乐","望海潮",
            "贺新郎","摸鱼儿","扬州慢","采桑子","卜算子","渔家傲","清平乐",
            "清平调","菩萨蛮","西江月","如梦令","蝶恋花","鹊桥仙","临江仙","虞美人",
            "木兰花","踏莎行","雨霖铃","声声慢","一剪梅","鹧鸪天","南乡子",
            "定风波","少年游","六州歌头","长相思","点绛唇","生查子","诉衷情",
            "好事近","天仙子","蓦山溪","千秋岁","天净沙","青玉案","满庭芳",
            "苏幕遮","御街行","夜游宫","祝英台近","南浦","双双燕","瑞鹤仙",
            "高阳台","锁窗寒","疏帘淡月","六丑","兰陵王","八声甘州","夜半乐"}


def infer_type(name: str, clean_lines: list[str]) -> str:
    for kw in FORBIDDEN_TYPES:
        if kw in name:
            return "拒绝"
    for kw in CI_CANDS:
        if kw in name:
            return "词"
    line_lens = [len(ln) for ln in clean_lines]
    first_len = line_lens[0] if line_lens else 0
    if first_len == 5:
        if len(clean_lines) == 1: return "五言古诗"
        if len(clean_lines) == 4: return "五言绝句"
        if len(clean_lines) >= 6: return "五言律诗"
        return "五言古诗"
    elif first_len == 7:
        if len(clean_lines) == 1: return "七言古诗"
        if len(clean_lines) == 4: return "七言绝句"
        if len(clean_lines) >= 6: return "七言律诗"
        return "七言古诗"
    elif first_len == 6:
        return "六言诗"
    return "其他"


# ─── 处理 yxcs NDJSON（唐诗） ───────────────────────────────────────────────

def stream_yxcs(url: str, fname: str, seed_set: set[str], seed_rank: dict[str, int],
                matched: dict[str, dict]) -> int:
    import urllib.request
    total = 0
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=240) as resp:
            for line in resp:
                total += 1
                line_str = line.decode("utf-8").strip()
                if not line_str or line_str in ("[", "]", ","):
                    continue
                try:
                    obj = json.loads(line_str)
                except json.JSONDecodeError:
                    continue

                name = obj.get("name") or obj.get("title", "")
                if not name:
                    continue
                name_norm = normalize(name)
                if not name_norm:
                    continue

                is_match = any(match_title(seed, name) for seed in seed_set)
                if not is_match:
                    continue

                author = obj.get("author", "") or "佚名"
                dedup_key = f"{name_norm}:{author}"
                if dedup_key in matched:
                    continue

                raw_content: list = obj.get("content", [])
                if not raw_content:
                    continue

                raw_lines: list[str] = []
                clean_lines: list[str] = []
                for item in raw_content:
                    cleaned = clean_html(str(item))
                    if not cleaned:
                        continue
                    for rp in split_lines_preserve_punct(cleaned):
                        cl = punct_strip(rp)
                        if valid_line(cl) and rp not in raw_lines:
                            raw_lines.append(rp)
                            if cl not in clean_lines:
                                clean_lines.append(cl)

                if not raw_lines:
                    continue

                ptype = infer_type(name, clean_lines)
                if ptype == "拒绝":
                    continue

                chars_set = set()
                for cl in clean_lines:
                    for c in cl:
                        if "\u4e00" <= c <= "\u9fff":
                            chars_set.add(c)

                pid = obj.get("_id", {})
                if isinstance(pid, dict):
                    pid = pid.get("$oid", "")
                if not pid or len(str(pid)) < 6:
                    pid = make_id(name, author)

                matched[dedup_key] = {
                    "id": str(pid),
                    "title": name,
                    "author": author,
                    "dynasty": obj.get("dynasty", "唐"),
                    "type": ptype,
                    "p": raw_lines,       # 带标点原始句
                    "c": clean_lines,      # 去标点句（用于索引）
                    "note": obj.get("note", ""),
                    "_rank": seed_rank.get(name_norm, 9999),
                    "_dedup_key": dedup_key,
                }
    except Exception as e:
        print(f"  ⚠ 下载 {fname} 失败: {e}")
    return total


# ─── 处理宋词三百首 ─────────────────────────────────────────────────────────

def stream_ci300(seed_set: set[str], seed_rank: dict[str, int], matched: dict[str, dict]) -> int:
    """
    读取 chinese-poetry 宋词三百首 JSON（local file if present, else download）。
    宋词数据字段：rhythmic=词牌名, author=作者, paragraphs=段落列表（带标点）
    """
    import urllib.request

    # 先检查本地是否有缓存
    cache_file = DATA_DIR / "ci300_cache.json"
    if cache_file.exists():
        print(f"  读取本地缓存 {cache_file}")
        with open(cache_file, encoding="utf-8") as f:
            data = json.load(f)
    else:
        print(f"  下载宋词三百首...")
        try:
            req = urllib.request.Request(CI300_URL, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            # 缓存本地
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
            print(f"  已缓存到 {cache_file}")
        except Exception as e:
            print(f"  ⚠ 下载宋词三百首失败: {e}")
            return 0

    total = 0
    for obj in data:
        total += 1
        rhythmic = obj.get("rhythmic", "")
        if not rhythmic:
            continue
        name_norm = normalize(rhythmic)
        author = obj.get("author", "") or "佚名"
        dedup_key = f"{name_norm}:{author}"

        # 宋词三百首优先级：跟随 seed_rank（如果没有 seed 记录，排在唐诗之后）
        rank = seed_rank.get(name_norm, 5000 + len(matched))
        dynasty = "宋"

        # paragraphs 已经是带标点的独立句
        raw_paragraphs: list[str] = []
        clean_paragraphs: list[str] = []
        for p in obj.get("paragraphs", []):
            if not p or not p.strip():
                continue
            # paragraphs 中的每项已经是完整的带标点句子
            raw_paragraphs.append(p)
            cl = punct_strip(p)
            if valid_line(cl) and cl not in clean_paragraphs:
                clean_paragraphs.append(cl)

        if not raw_paragraphs or not clean_paragraphs:
            continue

        # 去重（同词牌同作者跳过）
        if dedup_key in matched:
            continue

        chars_set = set()
        for cl in clean_paragraphs:
            for c in cl:
                if "\u4e00" <= c <= "\u9fff":
                    chars_set.add(c)

        matched[dedup_key] = {
            "id": make_id(rhythmic, author),
            "title": rhythmic,
            "author": author,
            "dynasty": dynasty,
            "type": "词",
            "p": raw_paragraphs,
            "c": clean_paragraphs,
            "note": "",
            "_rank": rank,
            "_dedup_key": dedup_key,
        }

    print(f"  宋词三百首处理完成：{total} 首")
    return total


# ─── 主逻辑 ────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("风雨情 — 诗词数据库生成器")
    print("=" * 60)

    # 1. 加载种子列表
    seed_set, seed_list = load_seed_titles()
    print(f"\n✅ 种子标题：{len(seed_set)} 个（唐诗三百首 + 教育部必背）")

    seed_rank: dict[str, int] = {norm: i for i, norm in enumerate(seed_list)}

    # 2. 处理唐诗（yxcs NDJSON）
    matched: dict[str, dict] = {}
    grand_total = 0
    for fname, url in YXCS_URLS:
        print(f"\n下载 {fname}（流式处理）...")
        total = stream_yxcs(url, fname, seed_set, seed_rank, matched)
        print(f"  {fname} 扫描完成：共 {total} 行，已匹配 {len(matched)} 首")
        grand_total += total

    # 3. 处理宋词三百首
    ci_total = stream_ci300(seed_set, seed_rank, matched)
    grand_total += ci_total

    print(f"\n总计扫描 {grand_total} 行，匹配 {len(matched)} 首诗歌")

    # 4. 按优先级排序
    poems = sorted(matched.values(), key=lambda p: p["_rank"])

    # 5. 更新 rank，清理内部字段
    for i, p in enumerate(poems, 1):
        p["rank"] = i
        p.pop("_rank", None)
        p.pop("_dedup_key", None)

    # 6. 预建字符倒排索引
    print(f"\n构建字符倒排索引...")
    char_index: dict[str, list[int]] = {}
    total = len(poems)
    for idx, p in enumerate(poems):
        if idx % 5000 == 0:
            print(f"  建索引进度：{idx}/{total}")
        chars = set()
        for line in p.get("c", []):
            for c in line:
                if "\u4e00" <= c <= "\u9fff":
                    chars.add(c)
        for ch in chars:
            if ch not in char_index:
                char_index[ch] = []
            char_index[ch].append(idx)
    print(f"  建索引完成：{total}/{total}，共 {len(char_index)} 个不同汉字")

    # 7. 写 poems.json
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    poems_short = [
        {
            "r": p["rank"],
            "t": p["title"],
            "a": p["author"],
            "d": p["dynasty"],
            "id": p.get("id", ""),
            "p": p.get("p", []),   # 带标点原始句（用于展示和搜索）
            "c": p.get("c", []),   # 去标点句（用于索引）
            "n": p.get("note", ""),
        }
        for p in poems
    ]
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(poems_short, f, ensure_ascii=False, indent=2)

    # 8. 写 poems.index.json
    index_file = DATA_DIR / "poems.index.json"
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(char_index, f, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"✅ poems.json       → {OUTPUT_FILE}  ({len(poems_short)} 首)")
    print(f"✅ poems.index.json  → {index_file}  ({len(char_index)} 个汉字)")

    # 9. 统计类型分布
    from collections import Counter
    type_dist = Counter(p.get("type", "") for p in poems)
    print(f"\n类型分布：")
    for t, cnt in type_dist.most_common():
        print(f"  {t}: {cnt}")

    print(f"\n前30首：")
    for p in poems[:30]:
        ci_mark = " [词]" if p.get("type") == "词" else ""
        print(f"  {p['rank']:3d}. 《{p['title']}》— {p['author']}（{p['dynasty']}）{ci_mark}")

    # 10. 验证关键诗词
    famous = ["醉花阴", "声声慢", "静夜思", "春晓", "登鹳雀楼"]
    print(f"\n关键诗词验证：")
    found_titles = {p["title"]: p["author"] for p in poems}
    for title in famous:
        info = found_titles.get(title)
        if info:
            print(f"  ✅ {title} — {info}")
            # 打印带标点原句
            for p in poems:
                if p["title"] == title:
                    print(f"     原句: {p['p'][:2]}")
                    break
        else:
            print(f"  ❌ {title} 未找到")


if __name__ == "__main__":
    main()
