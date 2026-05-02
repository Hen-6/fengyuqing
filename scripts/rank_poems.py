#!/usr/bin/env python3
"""
rank_poems.py — 生成按知名度排序的 poems.json

数据来源（优先级从高到低）：
  1. 唐诗三百首（蘅塘退士编）— 从 yxcs poems1.json NDJSON 流式读取
  2. 教育部义务教育必背古诗词 — 补充

poems1.json NDJSON URL: https://raw.githubusercontent.com/yxcs/poems-db/master/poems1.json
每行一个 JSON 对象，用 name/content 字段。
"""

import json
import re
import hashlib
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
OUTPUT_FILE = DATA_DIR / "poems.json"
POEMS1_URL = "https://raw.githubusercontent.com/yxcs/poems-db/master/poems1.json"
POEMS2_URL = "https://raw.githubusercontent.com/yxcs/poems-db/master/poems2.json"
POEMS3_URL = "https://raw.githubusercontent.com/yxcs/poems-db/master/poems3.json"
POEMS4_URL = "https://raw.githubusercontent.com/yxcs/poems-db/master/poems4.json"
ALL_POEMS_URLS = [
    ("poems1.json", POEMS1_URL),
    ("poems2.json", POEMS2_URL),
    ("poems3.json", POEMS3_URL),
    ("poems4.json", POEMS4_URL),
]

# ─── 工具函数 ───────────────────────────────────────────────────────────────

def normalize(s: str) -> str:
    """去除标点、空格并小写，用于标题匹配"""
    return re.sub(r"[\s，。！？、；：""''【】『』「」()（）.?!,·《》]", "", s).strip().lower()

def clean_html(text: str) -> str:
    """去除 HTML 标签"""
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()

def split_lines_preserve_punct(raw_line: str) -> list[str]:
    """
    将一行原始文本拆分为多句，保留句末标点。
    先按逗号/顿号拆分，再按句末标点拆分。
    例: '床前明月光，疑是地上霜。举头望明月，低头思故乡。'
    → ['床前明月光，', '疑是地上霜。', '举头望明月，', '低头思故乡。']
    """
    # 第一步：按逗号/顿号拆分（保留标点）
    comma_parts = re.split(r"(?<=[，、])", raw_line)
    result: list[str] = []
    for part in comma_parts:
        part = part.strip()
        if not part:
            continue
        # 第二步：每个子句再按句末标点拆分（保留标点）
        sub_parts = re.split(r"(?<=[。！？；])", part)
        for sp in sub_parts:
            sp = sp.strip()
            if sp and len(re.sub(r"[，。！？、；：""''【】「」()（）.?!,·《》]", "", sp)) >= 2:
                result.append(sp)
    return result

def split_lines(raw_line: str) -> list[str]:
    """
    将一行原始文本拆分为多句（无标点版本）。
    先按中文逗号、顿号拆分对句，再按句末标点拆分段落。
    例: '床前明月光，疑是地上霜。' → ['床前明月光', '疑是地上霜']
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
    """去除所有标点符号（含逗号、顿号、书名号、引号等）"""
    return re.sub(r"[，。！？、；：""''【】『』「」()（）.?!,\s「」『』—–\-《》〈〉『〗【】『】″′″″″]", "", text)

def make_id(title: str, author: str) -> str:
    key = f"{title}:{author}"
    return hashlib.md5(key.encode()).hexdigest()[:12]

# ─── 加载种子列表 ────────────────────────────────────────────────────────────

def load_seed_titles() -> tuple[set[str], list[str]]:
    """
    加载所有种子标题。
    返回 (normalized_set, [normalized_titles]) 按优先级排序
    """
    seen_norm: dict[str, str] = {}  # norm → original
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
            # fallback: split by newlines
            items = [l.strip() for l in raw.splitlines() if l.strip()]
            # 二次处理：某行可能是被合并的 JSON 片段（如 "行路难","梁园吟"...）
            expanded: list[str] = []
            for item in items:
                if not isinstance(item, str):
                    expanded.append(item)
                    continue
                # 如果该行看起来像 JSON 数组片段（有多个引号包裹的字符串），尝试解析
                stripped = item.strip()
                if re.match(r'^"[^"]+"(,\s*"[^"]+")+,?$', stripped):
                    try:
                        # 去掉尾部逗号（Python json.loads 不支持 trailing comma）
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

    # 按优先级排序（唐诗三百首在前）
    norms = list(seen_norm.keys())
    return set(norms), norms

# ─── 标题匹配 ────────────────────────────────────────────────────────────────

def match_title(seed_norm: str, title: str) -> bool:
    """
    宽松匹配：
      1. 标准化精确匹配
      2. 去除序号词（其一/其二/其三/三首等）后的词干匹配
         解决 "清平调三首" 应匹配 "清平调其一/其二" 的问题
      3. 前两字相同（兜底宽松匹配）
    """
    title_norm = normalize(title)
    if not seed_norm or not title_norm:
        return False

    # 1. 标准化包含匹配
    if seed_norm in title_norm or title_norm in seed_norm:
        return True

    # 2. 去除序号词后再匹配
    # 将 seed 和 title 都去掉 "其一/其二/其三/三首" 等序号后缀
    def strip_suffix(s: str) -> str:
        """去除常见序号词后缀，保留词干"""
        # 按长度降序排列，避免"三首"先匹配导致"词三首"无法匹配
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

    # 如果去掉序号后能互相包含，说明是同一首诗的不同编号
    if seed_stripped and title_stripped:
        if seed_stripped in title_stripped or title_stripped in seed_stripped:
            return True
        # 如果词干相同（长度 ≥ 4），也匹配
        if len(seed_stripped) >= 4 and seed_stripped == title_stripped:
            return True

    # 3. 前两字相同（兜底）
    if len(seed_norm) >= 2 and len(title_norm) >= 2 and seed_norm[:2] == title_norm[:2]:
        return True
    return False

# ─── 类型推断 ───────────────────────────────────────────────────────────────

KNOWN_CI_TYPES = {
    "沁园春", "水调歌头", "满江红", "念奴娇", "水龙吟", "永遇乐", "望海潮",
    "贺新郎", "摸鱼儿", "贺新郎", "扬州慢", "暗香", "疏影", "疏影", "双双燕",
    "霓裳中序第一", "摸鱼子", "采桑子", "卜算子", "渔家傲", "清平乐", "菩萨蛮",
    "西江月", "如梦令", "蝶恋花", "鹊桥仙", "临江仙", "虞美人", "木兰花",
    "踏莎行", "雨霖铃", "声声慢", "一剪梅", "鹧鸪天", "南乡子", "定风波",
    "少年游", "六丑", "兰陵王", "六州歌头", "戚氏", "八声甘州", "夜半乐",
    "眉妩", "庆春宫", "绮罗香", "疏帘淡月", "采旧令", "换巢鸾凤", "东风第一枝",
    "庆清朝", "长亭怨慢", "暗香", "疏影", "绿头鸭", "西平乐", "归朝欢",
    "永遇乐", "望海潮", "长相思", "点绛唇", "生查子", "诉衷情", "谒金门",
    "好事近", "谒金门", "天仙子", "更漏子", "酒泉子", "采莲令", "河满子",
    "清平乐", "女冠子", "更漏子", "归国谣", "菩萨蛮", "玉蝴蝶",
    "八六子", "扑蝴蝶", "秋霁", "夜合花", "大有", "水调歌", "探春令",
    "传言玉女", "花心动", "垂丝钓", "金人捧露盘", "金盏子", "龙山会",
    "蓦山溪", "千秋岁", "归田乐", "清平乐令", "应天长", "渔父", "张中令",
    "西溪子", "更漏子", "酒泉子", "上行杯", "离别的依",
}

CI_CHARS = {"沁","水","满","念","龙","永","望","贺","摸","扬","暗","疏","双","采","卜","渔","清","菩","西","如","蝶","鹊","临","虞","木","踏","雨","声","一","鹧","南","定","少","六","兰","夜","归","长","点","生","诉","好","天","垂","应","张","女","上","离","大","探","言","花","垂","千","归","应","渔"}

def infer_type(name: str, clean_lines: list[str]) -> str:
    """
    推断诗歌类型：五言绝句 / 五言律诗 / 七言绝句 / 七言律诗 / 词 / 其他
    基于 clean_lines（去标点后的独立句）
    """
    if not clean_lines:
        return "其他"

    # 检查是否含词牌关键字
    ci_cands = ["沁园春","水调歌头","满江红","念奴娇","水龙吟","永遇乐","望海潮",
                "贺新郎","摸鱼儿","扬州慢","采桑子","卜算子","渔家傲","清平乐",
                "清平调","菩萨蛮","西江月","如梦令","蝶恋花","鹊桥仙","临江仙","虞美人",
                "木兰花","踏莎行","雨霖铃","声声慢","一剪梅","鹧鸪天","南乡子",
                "定风波","少年游","六州歌头","长相思","点绛唇","生查子","诉衷情",
                "好事近","天仙子","蓦山溪","千秋岁","天净沙","青玉案","千秋岁引",
                "汉宫春","满庭芳","苏幕遮","御街行","夜游宫","祝英台近",
                "惜红衣","暗香","疏影","瑶华","忆旧游","曲游春","三姝媚",
                "南浦","双双燕","月下笛","瑞鹤仙","声声慢","高阳台","锁窗寒",
                "疏帘淡月","六丑","兰陵王","八声甘州","夜半乐","水调","征管"]

    name_lower = name.lower()
    # 过滤散曲/元曲
    forbidden = ["散曲", "仙吕", "中吕", "正宫", "双调", "南吕", "越调", "大石调",
                 "般涉调", "商调", "黄钟宫", "商角调", "高平调", "平调",
                 "梧桐雨", "寄生草调", "山坡羊", "清江引", "塞鸿秋",
                 "小令", "套数", "杂剧", "曲牌"]
    for kw in forbidden:
        if kw in name:
            return "拒绝"

    for kw in ci_cands:
        if kw in name or kw in name_lower:
            return "词"
        if clean_lines and kw in clean_lines[0]:
            return "词"

    # 判断五言/七言
    # 使用 clean_lines 中的独立句（不是合并的对句）
    line_lens = [len(ln) for ln in clean_lines]
    first_len = line_lens[0] if line_lens else 0

    if first_len == 5:
        if len(clean_lines) == 1:
            return "五言古诗"
        if len(clean_lines) == 4:
            return "五言绝句"
        if len(clean_lines) >= 6:
            return "五言律诗"
        return "五言古诗"
    elif first_len == 7:
        if len(clean_lines) == 1:
            return "七言古诗"
        if len(clean_lines) == 4:
            return "七言绝句"
        if len(clean_lines) >= 6:
            return "七言律诗"
        return "七言古诗"
    elif first_len == 6:
        return "六言诗"
    else:
        return "其他"

# ─── 处理 yxcs poems NDJSON（支持 poems1-4.json） ─────────────────────────────

def stream_poems_from_url(url: str, filename: str, seed_set: set[str], seed_rank: dict[str, int], matched: dict[str, dict]) -> int:
    """
    从指定 URL 流式读取 NDJSON 文件，只保留匹配种子的诗歌。
    返回扫描行数。
    matched 是共享的 dict，由调用方管理（同名去重：保留第一个匹配/优先级高的）。
    """
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

                # 检查是否匹配任意种子标题
                is_match = False
                for seed in seed_set:
                    if match_title(seed, name):
                        is_match = True
                        break
                if not is_match:
                    continue

                # 同名去重（保留第一个/优先级高的）
                # 用 name_norm + author 做 key，避免同标题不同作者被误去重
                author = obj.get("author", "") or "佚名"
                dedup_key = f"{name_norm}:{author}"
                if dedup_key in matched:
                    continue

                raw_content: list = obj.get("content", [])
                if not raw_content:
                    continue

                # 先清理 HTML，再拆分句子
                all_lines_raw: list[str] = []
                for item in raw_content:
                    cleaned = clean_html(str(item))
                    if not cleaned:
                        continue
                    raw_parts = split_lines_preserve_punct(cleaned)
                    for rp in raw_parts:
                        if rp and rp not in all_lines_raw:
                            all_lines_raw.append(rp)

                if not all_lines_raw:
                    continue

                # 去相邻重复
                seen_lines = set()
                lines = []
                for ln in all_lines_raw:
                    if ln not in seen_lines:
                        seen_lines.add(ln)
                        lines.append(ln)

                clean_lines = [punct_strip(ln) for ln in lines]
                valid = [(ln, cl) for ln, cl in zip(lines, clean_lines)
                         if len(cl) >= 4 and re.search(r"[\u4e00-\u9fff]", cl)]
                if not valid:
                    continue
                lines, clean_lines = zip(*valid)
                lines = list(lines)
                clean_lines = list(clean_lines)

                # 推断类型（用于过滤散曲）
                ptype = infer_type(name, clean_lines)
                if ptype == "拒绝":
                    continue

                chars_set = set()
                for line in clean_lines:
                    for c in line:
                        if c.strip():
                            chars_set.add(c)

                pid = obj.get("_id", {})
                if isinstance(pid, dict):
                    pid = pid.get("$oid", "")
                if not pid or len(str(pid)) < 6:
                    pid = make_id(name, obj.get("author", ""))

                poem = {
                    "id": str(pid),
                    "title": name,
                    "author": obj.get("author", ""),
                    "dynasty": obj.get("dynasty", ""),
                    "type": ptype,
                    "lines": lines,
                    "cleanLines": clean_lines,
                    "note": obj.get("note", ""),
                    "allChars": sorted(list(chars_set)),
                    "_rank": seed_rank.get(name_norm, 9999),
                    "_dedup_key": dedup_key,
                }
                matched[dedup_key] = poem

    except Exception as e:
        print(f"  ⚠ 下载 {filename} 失败: {e}")
    return total


def stream_poems_all(seed_set: set[str], seed_list: list[str]) -> list[dict]:
    """
    流式下载并处理 poems1-4.json NDJSON，只保留匹配种子的诗歌。
    """
    seed_rank: dict[str, int] = {norm: i for i, norm in enumerate(seed_list)}
    matched: dict[str, dict] = {}

    grand_total = 0
    for filename, url in ALL_POEMS_URLS:
        print(f"\n下载 {filename}（流式处理）...")
        total = stream_poems_from_url(url, filename, seed_set, seed_rank, matched)
        print(f"  {filename} 扫描完成：共 {total} 行，已匹配 {len(matched)} 首")
        grand_total += total

    print(f"\n总计扫描 {grand_total} 行，匹配 {len(matched)} 首诗歌")
    sorted_poems = sorted(matched.values(), key=lambda p: p["_rank"])
    return sorted_poems

# ─── 输出格式 ────────────────────────────────────────────────────────────

def short_poem(p: dict, rank: int) -> dict:
    """
    转换为 TypeScript localSearch.ts 期望的短字段格式。
    字段：r=rank, t=title, a=author, d=dynasty, id, c=cleanLines, n=note
    """
    return {
        "r": rank,
        "t": p["title"],
        "a": p["author"],
        "d": p["dynasty"],
        "id": p.get("id", ""),
        # c: 去标点后的所有诗句（去重），localSearch.ts 内部使用
        "c": p.get("cleanLines", []),
        "n": p.get("note", ""),
    }


def build_char_index(poems: list[dict]) -> dict[str, list[int]]:
    """
    预建字符倒排索引：char → [poemIdx1, poemIdx2, ...]
    每首诗的每句中所有去重汉字都加入索引。
    """
    char_index: dict[str, list[int]] = {}
    total = len(poems)
    for idx, p in enumerate(poems):
        if idx % 5000 == 0:
            print(f"  建索引进度：{idx}/{total}")
        chars = set()
        for line in p.get("cleanLines", []):
            for c in line:
                if "\u4e00" <= c <= "\u9fff":
                    chars.add(c)
        for ch in chars:
            if ch not in char_index:
                char_index[ch] = []
            char_index[ch].append(idx)
    print(f"  建索引完成：{total}/{total}，共 {len(char_index)} 个不同汉字")
    return char_index


# ─── 主逻辑 ────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("风雨情 — 诗词数据库生成器")
    print("=" * 60)

    # 1. 加载种子列表
    seed_set, seed_list = load_seed_titles()
    print(f"\n✅ 种子标题：{len(seed_set)} 个（唐诗三百首 + 教育部必背）")

    # 2. 流式读取 yxcs poems1-4.json（全部四个文件）
    poems = stream_poems_all(seed_set, seed_list)
    print(f"\n✅ 匹配诗歌：{len(poems)} 首")

    # 3. 更新 rank，清理内部字段
    for i, p in enumerate(poems, 1):
        p["rank"] = i
        p.pop("_rank", None)

    # 4. 预建倒排索引
    print(f"\n构建字符倒排索引...")
    char_index = build_char_index(poems)

    # 5. 写 poems.json（短字段格式）
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    poems_short = [short_poem(p, p["rank"]) for p in poems]
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(poems_short, f, ensure_ascii=False, indent=2)

    # 6. 写 poems.index.json（倒排索引）
    index_file = DATA_DIR / "poems.index.json"
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(char_index, f, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"✅ poems.json      → {OUTPUT_FILE}  ({len(poems_short)} 首)")
    print(f"✅ poems.index.json → {index_file}  ({len(char_index)} 个汉字)")

    # 7. 统计类型分布
    from collections import Counter
    type_dist = Counter(p.get("type", "") for p in poems)
    print(f"\n类型分布：")
    for t, cnt in type_dist.most_common():
        print(f"  {t}: {cnt}")

    print(f"\n前20首：")
    for p in poems[:20]:
        print(f"  {p['rank']:3d}. 《{p['title']}》— {p['author']}（{p['dynasty']}）{p['type']}")

if __name__ == "__main__":
    main()
