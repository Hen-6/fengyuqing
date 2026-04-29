"""
daily.py — 风雨情 Discord Bot
- 常驻运行，每日 UTC 14:00 自动推送到指定频道
- 支持斜杠命令：/今日 /复习 /状态 /飞花 /接龙 /验证
- 诗词内容运行时从 GitHub yxcs/poems-db 在线获取
"""

import os
import sys
import json
import sqlite3
import asyncio
import aiohttp
import re
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from dataclasses import dataclass

import discord
from discord import app_commands

# ─── 路径配置 ──────────────────────────────────────────────────────────────

BOT_DIR = Path(__file__).parent
DB_PATH = BOT_DIR / "progress.db"
RANK_PATH = BOT_DIR.parent / "data" / "rank.json"

# ─── 配置（环境变量） ───────────────────────────────────────────────────────

CHANNEL_ID = int(os.environ.get("DISCORD_CHANNEL_ID", "0"))  # 推送目标频道 ID
TARGET_USER_ID = int(os.environ.get("DISCORD_TARGET_USER_ID", "0"))  # 推送目标用户 ID
TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")

# ─── yxcs 数据源 ───────────────────────────────────────────────────────────

YXCS_URLS = [
    "https://raw.githubusercontent.com/yxcs/poems-db/master/poems1.json",
    "https://raw.githubusercontent.com/yxcs/poems-db/master/poems2.json",
    "https://raw.githubusercontent.com/yxcs/poems-db/master/poems3.json",
    "https://raw.githubusercontent.com/yxcs/poems-db/master/poems4.json",
]

# ─── 工具函数 ──────────────────────────────────────────────────────────────

PUNCT_RE = re.compile(
    "["
    "\u3002\uff0c\uff1f\uff01\uff0b\uff1b\uff1a"  # 。，？！！；：
    "\u201c\u201d"                                 # "" curly quotes
    "\u2018\u2019"                                 # '' curly quotes
    "\u300a\u300b"                                 # 【】
    "\u300c\u300d"                                 # 「」
    "\u3008\u3009"                                 # 〈〉
    "\uff08\uff09"                                 # （）
    "\u00b7"                                       # ·
    "\u2014\u2013"                                 # —–
    "\s"
    ".,?!'\":;"
    "\[\]"
    "]"
)


def strip_punct(s: str) -> str:
    return PUNCT_RE.sub("", s)


def clean_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()


def levenshtein(a: str, b: str) -> int:
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            dp[i][j] = (
                dp[i - 1][j - 1]
                if a[i - 1] == b[j - 1]
                else 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
            )
    return dp[m][n]


# ─── 数据结构 ────────────────────────────────────────────────────────────────

@dataclass
class Poem:
    _id: str
    name: str
    author: str
    dynasty: str
    content: list[str]
    note: str
    matched_line: str = ""
    matched_line_index: int = 0


@dataclass
class SearchResult:
    poem: Poem
    score: int


# ─── 诗词缓存 ───────────────────────────────────────────────────────────────

_poem_cache: dict[str, Poem] = {}
_loaded = False


async def _load_poems():
    global _poem_cache, _loaded
    if _loaded:
        return

    semaphore = asyncio.Semaphore(4)

    async def fetch_file(url: str):
        async with semaphore:
            try:
                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as session:
                    async with session.get(url, headers={"User-Agent": "fengyuqing-discord/1.0"}) as resp:
                        if not resp.ok:
                            return
                        text = await resp.text()
                        for raw_line in text.split("\n"):
                            line = raw_line.strip()
                            if not line:
                                continue
                            try:
                                obj = json.loads(line)
                            except json.JSONDecodeError:
                                continue
                            name = obj.get("name") or obj.get("title") or ""
                            if not name:
                                continue
                            raw_content = obj.get("content") or []
                            if not isinstance(raw_content, list) or not raw_content:
                                continue
                            content = [clean_html(str(c)) for c in raw_content]
                            pid = str(obj.get("_id") or f"{name}:{obj.get('author','')}")
                            poem = Poem(
                                _id=pid,
                                name=name,
                                author=obj.get("author", "佚名"),
                                dynasty=obj.get("dynasty", ""),
                                content=content,
                                note=obj.get("note", ""),
                            )
                            _poem_cache[pid] = poem
                            alt_id = f"{name}:{obj.get('author','')}"
                            if alt_id not in _poem_cache:
                                _poem_cache[alt_id] = poem
            except Exception as e:
                print(f"[load] Failed to fetch {url}: {e}", file=sys.stderr)

    print("[bot] 正在加载诗词数据（约需 30-60 秒）...")
    await asyncio.gather(*[fetch_file(url) for url in YXCS_URLS])
    _loaded = True
    print(f"[bot] 已加载 {len(_poem_cache)} 首诗词")


def search_poems(query: str, max_results: int = 8) -> list[SearchResult]:
    key = query.strip()
    if not key:
        return []

    seen = set()
    results: list[SearchResult] = []

    for poem in _poem_cache.values():
        for i, raw in enumerate(poem.content):
            clean = strip_punct(raw)
            if not clean or len(clean) < 4:
                continue

            score = 0
            if clean == key:
                score = 100
            elif key in clean:
                score = 80
            elif clean in key and len(clean) >= 4:
                score = 70
            else:
                max_dist = 3 if max(len(clean), len(key)) <= 9 else 4
                if abs(len(clean) - len(key)) <= max_dist:
                    d = levenshtein(clean, key)
                    if d <= max_dist:
                        score = max(0, 60 - d * 10)

            if score > 0:
                dup_key = f"{poem.name}:{poem.author}:{i}"
                if dup_key in seen:
                    continue
                seen.add(dup_key)
                results.append(SearchResult(
                    poem=Poem(
                        _id=poem._id,
                        name=poem.name,
                        author=poem.author,
                        dynasty=poem.dynasty,
                        content=poem.content,
                        note=poem.note,
                        matched_line=raw,
                        matched_line_index=i,
                    ),
                    score=score,
                ))

    results.sort(key=lambda r: r.score, reverse=True)
    return results[:max_results]


def find_poem_by_title(title: str) -> Poem | None:
    return next((p for p in _poem_cache.values() if p.name == title), None)


def load_rank() -> list[dict]:
    if RANK_PATH.exists():
        with open(RANK_PATH, encoding="utf-8") as f:
            return json.load(f)
    return []


# ─── 数据库 ─────────────────────────────────────────────────────────────────

def get_user_state(user_id: str) -> dict:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "CREATE TABLE IF NOT EXISTS user_progress (user_id TEXT PRIMARY KEY, data TEXT)"
    )
    conn.commit()
    cur.execute("SELECT data FROM user_progress WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    if row:
        return json.loads(row[0])
    return {"current_rank": 0, "last_date": "", "poems": {}}


def save_user_state(user_id: str, data: dict):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT OR REPLACE INTO user_progress (user_id, data) VALUES (?, ?)",
        (user_id, json.dumps(data)),
    )
    conn.commit()
    conn.close()


def advance_daily_rank(state: dict, total: int) -> int:
    today = str(date.today())
    if state.get("last_date") == today:
        return state.get("current_rank", 0)
    next_rank = ((state.get("current_rank", 0) - 1) % total) + 1
    state["current_rank"] = next_rank
    state["last_date"] = today
    return next_rank


# ─── Discord Embed ──────────────────────────────────────────────────────────

ACCENT = 0xC0392B
GREEN = 0x27AE60


def make_embed(
    poem: Poem,
    title: str,
    show_note: bool = False,
    extra_fields: list[tuple[str, str]] | None = None,
    color: int = ACCENT,
) -> discord.Embed:
    embed = discord.Embed(title=title, color=color)
    embed.add_field(
        name=f"《{poem.name}》",
        value=f"{poem.author} · {poem.dynasty or '不详'}",
        inline=False,
    )
    lines_text = "\n".join(poem.content)
    embed.add_field(name="诗句", value=lines_text, inline=False)
    if show_note and poem.note:
        embed.add_field(name="赏析", value=poem.note[:300], inline=False)
    if extra_fields:
        for name, val in extra_fields:
            embed.add_field(name=name, value=val, inline=False)
    embed.set_footer(text="数据来源：yxcs/poems-db · 回复 1-5 记录熟练度")
    return embed


# ─── Bot ────────────────────────────────────────────────────────────────────

class DailyBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        self._daily_task: asyncio.Task | None = None

    async def setup_hook(self):
        await self.tree.sync()
        self._daily_task = asyncio.create_task(_daily_sender(self))


# ─── 每日自动推送任务 ─────────────────────────────────────────────────────

async def _get_next_send_time() -> datetime:
    """计算下一个 UTC 14:00 的时间"""
    now_utc = datetime.now(timezone.utc)
    target = now_utc.replace(hour=14, minute=0, second=0, microsecond=0)
    if now_utc.hour >= 14:
        target += timedelta(days=1)
    return target


async def _daily_sender(self: DailyBot):
    """每分钟检查一次，是否到 UTC 14:00；到时自动发送每日诗词"""
    print("[bot] 每日推送任务已启动")
    send_now = os.environ.get("DISCORD_SEND_NOW", "").lower() == "true"

    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            if not _loaded or TARGET_USER_ID == 0 or not _poem_cache:
                await asyncio.sleep(60)
                continue

            should_send = send_now or (now_utc.hour == 14 and now_utc.minute == 0)
            if not should_send:
                await asyncio.sleep(30)
                continue

            rank_list = load_rank()
            if not rank_list:
                await asyncio.sleep(60)
                continue

            # 全局 rank 推进（不绑定用户）
            state = get_user_state("__global__")
            next_rank = advance_daily_rank(state, len(rank_list))
            save_user_state("__global__", state)

            entry = next((e for e in rank_list if e["r"] == next_rank), rank_list[0])
            poem = find_poem_by_title(entry["t"])

            user = await asyncio.wait_for(self.fetch_user(TARGET_USER_ID), timeout=15.0)
            if user is None:
                print(f"[bot] 找不到用户 {TARGET_USER_ID}", file=sys.stderr)
            else:
                dm = user.dm_channel
                if dm is None:
                    dm = await asyncio.wait_for(user.create_dm(), timeout=15.0)
                if poem:
                    embed = make_embed(
                        poem,
                        f"📜 今日诗词 · 第 {next_rank} 首（共 {len(rank_list)} 首）",
                        show_note=True,
                    )
                    await dm.send(
                        "🌸 每日诗词推送 · 回复 /状态 查看你的学习进度，或在下方选择熟练度",
                        embed=embed,
                    )
                    print(f"[bot] 已推送：{poem.name} — rank {next_rank}")
                else:
                    await dm.send(f"⚠️ 未找到《{entry['t']}》的诗词内容")
                    print(f"[bot] 未找到：{entry['t']}")

            if send_now:
                print("[bot] send_now 模式：发送完毕，退出")
                return

            # 定时模式：推送后等 70 秒，防止重复发送
            await asyncio.sleep(70)

        except asyncio.CancelledError:
            print("[bot] 每日推送任务已取消")
            break
        except Exception as e:
            print(f"[bot] 每日推送出错: {e}", file=sys.stderr)
            await asyncio.sleep(60)


bot = DailyBot()


@bot.event
async def on_ready():
    print(f"[bot] Logged in as {bot.user}")


# ─── 命令：今日 ─────────────────────────────────────────────────────────────

@bot.tree.command(name="今日", description="发送今日推荐诗")
async def cmd_today(interaction: discord.Interaction):
    await interaction.response.defer()
    rank_list = load_rank()
    if not rank_list:
        await interaction.followup.send("❌ 排名数据加载失败", ephemeral=True)
        return

    state = get_user_state(str(interaction.user.id))
    next_rank = advance_daily_rank(state, len(rank_list))
    save_user_state(str(interaction.user.id), state)

    entry = next((e for e in rank_list if e["r"] == next_rank), rank_list[0])
    poem = find_poem_by_title(entry["t"])
    if not poem:
        await interaction.followup.send(
            f"❌ 未找到《{entry['t']}》，请稍后重试", ephemeral=True
        )
        return

    embed = make_embed(
        poem,
        f"📜 今日诗词 · 第 {next_rank} 首（共 {len(rank_list)} 首）",
        show_note=True,
    )
    await interaction.followup.send(embed=embed)


# ─── 命令：复习 ─────────────────────────────────────────────────────────────

@bot.tree.command(name="复习", description="查看今日待复习的诗")
async def cmd_review(interaction: discord.Interaction):
    await interaction.response.defer()
    state = get_user_state(str(interaction.user.id))
    today = str(date.today())
    poems_data = state.get("poems", {})

    due = [
        e for e in load_rank()
        if poems_data.get(e["t"] + ":" + e["a"], {}).get("nextReview", "") <= today
    ]

    if not due:
        embed = discord.Embed(
            title="🎉 今日复习已完成！",
            description="今天没有待复习的诗，继续学习新诗词吧",
            color=GREEN,
        )
        await interaction.followup.send(embed=embed)
        return

    entry = due[0]
    poem = find_poem_by_title(entry["t"])
    if not poem:
        await interaction.followup.send("❌ 加载诗词内容失败，请重试", ephemeral=True)
        return

    pid = entry["t"] + ":" + entry["a"]
    lvl = poems_data.get(pid, {}).get("level", "?")
    embed = make_embed(
        poem,
        f"🔄 今日复习 · 第 {entry['r']} 首",
        show_note=True,
        extra_fields=[("当前熟练度", f"Lv.{lvl}")],
        color=GREEN,
    )
    await interaction.followup.send(embed=embed)


# ─── 命令：状态 ─────────────────────────────────────────────────────────────

@bot.tree.command(name="状态", description="查看个人学习状态")
async def cmd_status(interaction: discord.Interaction):
    state = get_user_state(str(interaction.user.id))
    poems_data = state.get("poems", {})

    counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for prog in poems_data.values():
        lvl = prog.get("level", 1)
        counts[lvl] = counts.get(lvl, 0) + 1

    total = len(load_rank())
    known = sum(counts.get(l, 0) for l in [3, 4, 5])
    pct = round(known / total * 100) if total > 0 else 0

    embed = discord.Embed(
        title=f"📊 {interaction.user.display_name} 的学习状态",
        color=ACCENT,
    )
    embed.add_field(name="已识句（Lv.3+）", value=f"{known} / {total}（{pct}%）", inline=False)
    for lvl, name in [(1, "陌生"), (2, "认字"), (3, "识句"), (4, "成篇"), (5, "全知")]:
        embed.add_field(name=f"Lv.{lvl} {name}", value=str(counts.get(lvl, 0)), inline=True)

    await interaction.response.send_message(embed=embed, ephemeral=True)


# ─── 命令：飞花 ─────────────────────────────────────────────────────────────

FEIHUA_CHARS = [
    "月", "花", "春", "秋", "风", "雨", "山", "水", "云", "雪",
    "夜", "星", "江", "河", "人", "思", "乡", "酒", "剑", "马",
    "日", "天", "鸟", "草", "木", "叶", "声", "光", "心", "情",
]


@bot.tree.command(name="飞花", description="随机一个字，任意接出含该字的诗句")
@app_commands.describe(char="关键字（留空则随机）")
async def cmd_feihua(interaction: discord.Interaction, char: str = ""):
    await interaction.response.defer()
    target_char = char.strip() if char.strip() else (
        FEIHUA_CHARS[hash(str(interaction.user.id)) % len(FEIHUA_CHARS)]
    )

    results = search_poems(target_char, max_results=5)
    if not results:
        await interaction.followup.send(
            f"❌ 没有找到含「{target_char}」的诗句", ephemeral=True
        )
        return

    poem = results[0].poem
    embed = make_embed(
        poem,
        f"🌸 飞花令 · 关键字「{target_char}」",
        extra_fields=[("挑战", f"请接出含「{target_char}」的诗句（≥4字）")],
    )
    await interaction.followup.send(embed=embed)


# ─── 命令：接龙 ─────────────────────────────────────────────────────────────

@bot.tree.command(name="接龙", description="开始接龙游戏")
@app_commands.describe(mode="模式：同诗 或 跨诗")
async def cmd_jielong(interaction: discord.Interaction, mode: str = "跨诗"):
    await interaction.response.defer()
    if mode not in ("同诗", "跨诗"):
        mode = "跨诗"

    STARTS = ["月", "春", "花", "风", "秋", "雨", "山", "水", "夜", "天"]
    start_char = STARTS[hash(str(interaction.user.id)) % len(STARTS)]
    results = search_poems(start_char, max_results=10)
    if not results:
        await interaction.followup.send("❌ 加载失败，请重试", ephemeral=True)
        return

    poem = results[0].poem
    line = next((l for l in poem.content if len(strip_punct(l)) >= 4), poem.content[0] if poem.content else "")
    last_char = strip_punct(line)[-1] if line else ""
    embed = make_embed(
        poem,
        f"🐉 接龙游戏 · {mode}接龙",
        extra_fields=[
            ("系统出句", line),
            ("请接句末字", f"「{last_char}」（≥4字）"),
        ],
    )
    embed.set_footer(text=f"模式：{mode} · 回复 /验证 你的诗句 来核对")
    await interaction.followup.send(embed=embed)


# ─── 命令：验证 ─────────────────────────────────────────────────────────────

@bot.tree.command(name="验证", description="验证你接的诗句是否在库中")
@app_commands.describe(line="诗句（不包含标点）")
async def cmd_verify(interaction: discord.Interaction, line: str):
    await interaction.response.defer()
    results = search_poems(line.strip(), max_results=1)
    if not results:
        await interaction.followup.send(
            "❌ 这句诗不在库中，请检查是否有错别字", ephemeral=True
        )
        return

    result = results[0]
    poem = result.poem
    state = get_user_state(str(interaction.user.id))
    poems_data = state.setdefault("poems", {})
    pid = poem.name + ":" + poem.author
    if poems_data.get(pid, {}).get("level", 0) < 3:
        poems_data[pid] = {
            "level": 3,
            "halfLifeDays": 1,
            "nextReview": str(date.today()),
        }
        save_user_state(str(interaction.user.id), state)

    msg = "✅ 完全正确！" if result.score >= 80 else f"✅ 找到相似诗句（{result.score}分）"
    embed = make_embed(poem, f"{msg} 已记录为 Lv.3", show_note=True, color=GREEN)
    await interaction.followup.send(embed=embed)


# ─── 消息处理：接收熟练度反馈 ──────────────────────────────────────────────

@bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return
    content = message.content.strip()
    if content in ("1", "2", "3", "4", "5"):
        try:
            await message.channel.trigger_typing()
        except Exception:
            pass
        state = get_user_state(str(message.author.id))
        poems_data = state.setdefault("poems", {})
        if poems_data:
            last_key = list(poems_data.keys())[-1]
            poems_data[last_key]["level"] = int(content)
            save_user_state(str(message.author.id), state)
            try:
                await message.reply(f"✅ 已将熟练度记录为 Lv.{content}")
            except Exception:
                pass
        else:
            try:
                await message.reply("❌ 暂无最近学习的诗，先发送 /今日 开始吧")
            except Exception:
                pass


# ─── 主程序 ─────────────────────────────────────────────────────────────────

def main():
    if not TOKEN:
        print("ERROR: DISCORD_BOT_TOKEN not set", file=sys.stderr)
        sys.exit(1)

    async def run():
        # 先加载诗词数据，再启动 bot
        await _load_poems()
        async with bot:
            await bot.start(TOKEN)

    asyncio.run(run())


if __name__ == "__main__":
    main()
