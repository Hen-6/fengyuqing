"""
daily.py — Discord 每日推送
"""

import os
import json
import sqlite3
from pathlib import Path

import discord
from discord import app_commands

POEMS_PATH = os.environ.get("POEMS_JSON_PATH", "data/poems.json")
DB_PATH = Path(__file__).parent / "progress.db"

# ─── 数据加载 ──────────────────────────────────────────────

def load_poems():
    with open(POEMS_PATH, encoding="utf-8") as f:
        return json.load(f)

def load_user_state(user_id: str) -> dict:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT data FROM user_progress WHERE user_id = ?",
        (user_id,)
    )
    row = cur.fetchone()
    conn.close()
    if row:
        return json.loads(row[0])
    return {"current_rank": 0, "last_date": ""}

def save_user_state(user_id: str, data: dict):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT OR REPLACE INTO user_progress (user_id, data) VALUES (?, ?)",
        (user_id, json.dumps(data))
    )
    conn.commit()
    conn.close()

# ─── 每日推送 ──────────────────────────────────────────────

def get_daily_embed(poems: list[dict], user_state: dict) -> discord.Embed:
    from datetime import date
    today = str(date.today())
    current_rank = user_state.get("current_rank", 0)

    poems_list = poems
    next_rank = (current_rank % len(poems_list)) + 1
    poem = next((p for p in poems_list if p["rank"] == next_rank), poems_list[0])

    embed = discord.Embed(
        title=f"📜 今日诗词 · 第 {next_rank} 首",
        color=0xC0392B,
    )
    embed.add_field(name=f"《{poem['title']}》", value=f"{poem['author']} · {poem['dynasty']}", inline=False)

    lines = "\n".join(poem.get("cleanLines", poem.get("lines", [])))
    embed.add_field(name="诗句", value=lines, inline=False)

    if poem.get("note"):
        embed.add_field(name="赏析", value=poem["note"][:200], inline=False)

    embed.set_footer(text="回复熟练程度：1=陌生 2=认字 3=识句 4=成篇 5=全知")
    return embed, poem, next_rank, today


# ─── Bot ────────────────────────────────────────────────────

class DailyBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(intents=intents)
        self.poems = load_poems()

    async def setup_hook(self):
        await self.tree.sync()


client = DailyBot()

@client.event
async def on_ready():
    print(f"Logged in as {client.user}")


@client.tree.command(name="今日", description="发送今日推荐诗")
async def daily(interaction: discord.Interaction):
    state = load_user_state(str(interaction.user.id))
    embed, poem, rank, today = get_daily_embed(client.poems, state)

    # 更新 rank
    state["current_rank"] = rank
    state["last_date"] = today
    save_user_state(str(interaction.user.id), state)

    await interaction.response.send_message(embed=embed)


@client.tree.command(name="复习", description="查看今日待复习的诗")
async def review(interaction: discord.Interaction):
    from datetime import date
    today = str(date.today())
    state = load_user_state(str(interaction.user.id))
    user_progress = state.get("poems", {})

    due = [
        p for p in client.poems
        if user_progress.get(p["id"], {}).get("nextReview", "") <= today
    ]

    if not due:
        await interaction.response.send_message("🎉 今天没有待复习的诗！")
        return

    poem = due[0]
    embed = discord.Embed(
        title="🔄 今日复习",
        color=0x27AE60,
    )
    lines = "\n".join(poem.get("cleanLines", poem.get("lines", [])))
    embed.add_field(name=f"《{poem['title']}》", value=lines, inline=False)
    embed.add_field(name="作者", value=f"{poem['author']} · {poem['dynasty']}", inline=False)
    await interaction.response.send_message(embed=embed)


@client.tree.command(name="状态", description="查看个人学习状态")
async def status(interaction: discord.Interaction):
    state = load_user_state(str(interaction.user.id))
    poems_data = state.get("poems", {})

    level_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for prog in poems_data.values():
        lvl = prog.get("level", 1)
        level_counts[lvl] = level_counts.get(lvl, 0) + 1

    total = len(client.poems)
    known = sum(level_counts.get(l, 0) for l in [3, 4, 5])

    embed = discord.Embed(
        title=f"📊 {interaction.user.display_name} 的学习状态",
        color=0xC0392B,
    )
    embed.add_field(name="已识句（Lv.3+）", value=f"{known} / {total}", inline=False)
    for lvl, name in [(1,"陌生"),(2,"认字"),(3,"识句"),(4,"成篇"),(5,"全知")]:
        embed.add_field(name=name, value=str(level_counts.get(lvl, 0)), inline=True)

    await interaction.response.send_message(embed=embed)


def main():
    token = os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        print("ERROR: DISCORD_BOT_TOKEN not set")
        return
    client.run(token)


if __name__ == "__main__":
    main()
