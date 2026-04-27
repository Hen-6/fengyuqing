/**
 * poems.ts — 诗歌排名数据（极小本地文件）
 *
 * 本地仅存：rank, title, author, dynasty（无内容）
 * 所有诗词内容：运行时从 GitHub yxcs/poems-db 在线获取
 */

import rankData from "../../data/rank.json";

// ─── 类型 ────────────────────────────────────────────────────────────────

export interface RankEntry {
  r: number;  // rank
  t: string;   // title
  a: string;   // author
  d: string;   // dynasty
}

// ─── 排名数据（本地极小文件） ───────────────────────────────────────────

const RANK_LIST: RankEntry[] = (rankData as RankEntry[])
  .sort((a, b) => a.r - b.r);

export function getRankList(): RankEntry[] {
  return RANK_LIST;
}

export function getRankEntry(rank: number): RankEntry | undefined {
  return RANK_LIST.find((p) => p.r === rank);
}

/** 按 rank 获取今日推荐（仅元数据，内容在线获取） */
export function getDailyEntry(currentRank: number): RankEntry {
  const nextRank = (currentRank % RANK_LIST.length) + 1;
  return getRankEntry(nextRank) ?? RANK_LIST[0];
}

// ─── 工具函数 ────────────────────────────────────────────────────────────

export function stripPunctuation(s: string): string {
  return s.replace(
    /[，。？！、；：""''【】「」()（）·—–\-…\s.,?!'":;\[\]「」『』【】]/g,
    ""
  );
}

// ─── 预设飞花令常用字 ────────────────────────────────────────────────────

export const FEIHUA_CHARS = [
  "月", "花", "春", "秋", "风", "雨", "山", "水", "云", "雪",
  "夜", "星", "江", "河", "人", "思", "乡", "酒", "剑", "马",
  "日", "天", "鸟", "草", "木", "叶", "声", "光", "心", "情",
];
