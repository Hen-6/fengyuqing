/**
 * poems.ts — 诗歌数据加载、索引构建
 *
 * 数据来源: /public/data/poems.json
 * 字段: id, rank, title, author, dynasty, type, lines, cleanLines, note, allChars
 */

import poemsData from "@/data/poems.json";

export interface Poem {
  id: string;
  rank: number;
  title: string;
  author: string;
  dynasty: string;
  type: string;
  lines: string[];       // 含标点原句
  cleanLines: string[];  // 去标点
  note: string;          // 赏析注释
  allChars: string[];    // 所有去重汉字
}

// ─── 加载 ──────────────────────────────────────────────────────────────

const POEMS: Poem[] = poemsData as Poem[];

export function getAllPoems(): Poem[] {
  return POEMS;
}

export function getPoemById(id: string): Poem | undefined {
  return POEMS.find((p) => p.id === id);
}

export function getPoemByTitle(title: string): Poem | undefined {
  return POEMS.find(
    (p) => p.title.replace(/[，。？！、；：""''【】]/g, "") === title.replace(/[，。？！、；：""''【】]/g, "")
  );
}

// ─── 索引 ──────────────────────────────────────────────────────────────

/** "床前明月光" → {poemId, lineIndex} */
export type LineIndex = Map<string, { poemId: string; lineIndex: number }[]>;
const _lineIndex: LineIndex = new Map();

/** "月" → [poemId1, poemId2, ...] */
export type CharIndex = Map<string, string[]>;
const _charIndex: CharIndex = new Map();

/** 所有五言/七言对句（couplet = 一联 = 上下两句合并） */
export interface CoupletEntry {
  poemId: string;
  lineIndex: number;      // 起始句索引（偶数：1、3、5句）
  cleanPair: string;      // 去标点合并，如"床前明月光疑是地上霜"
  charCount: number;      // 5 或 7
  poem: Poem;
}
const _coupletIndex: CoupletEntry[] = [];

function buildIndexes() {
  for (const poem of POEMS) {
    const { id, cleanLines } = poem;

    // 字符索引
    for (const char of poem.allChars) {
      if (!char.trim()) continue;
      if (!_charIndex.has(char)) _charIndex.set(char, []);
      _charIndex.get(char)!.push(id);
    }

    // 行索引
    for (let i = 0; i < cleanLines.length; i++) {
      const clean = cleanLines[i];
      if (!_lineIndex.has(clean)) _lineIndex.set(clean, []);
      _lineIndex.get(clean)!.push({ poemId: id, lineIndex: i });
    }

    // 对句索引（仅偶数行起始，成对）
    for (let i = 0; i < cleanLines.length - 1; i += 2) {
      const l1 = cleanLines[i];
      const l2 = cleanLines[i + 1];
      if (l1.length < 4 || l2.length < 4) continue;
      const pair = l1 + l2;
      const charCount = l1.length; // 5 或 7
      if (charCount !== 5 && charCount !== 7) continue;
      _coupletIndex.push({ poemId: id, lineIndex: i, cleanPair: pair, charCount, poem });
    }
  }
}

buildIndexes();

export function getCharPoems(char: string): Poem[] {
  const ids = _charIndex.get(char) ?? [];
  return ids.map((id) => getPoemById(id)).filter(Boolean) as Poem[];
}

export function getLinePoem(cleanLine: string): { poem: Poem; lineIndex: number } | null {
  const hits = _lineIndex.get(cleanLine);
  if (!hits || hits.length === 0) return null;
  const hit = hits[0];
  const poem = getPoemById(hit.poemId);
  if (!poem) return null;
  return { poem, lineIndex: hit.lineIndex };
}

export function getAllCouplets(): CoupletEntry[] {
  return _coupletIndex;
}

export function getCoupletsByCount(charCount: 5 | 7): CoupletEntry[] {
  return _coupletIndex.filter((c) => c.charCount === charCount);
}

/** 查找含某字的随机 N 句诗 */
export function getRandomLinesWithChar(char: string, count: number): { poem: Poem; lineIndex: number; cleanLine: string }[] {
  const poemIds = _charIndex.get(char) ?? [];
  const results: { poem: Poem; lineIndex: number; cleanLine: string }[] = [];
  for (const id of poemIds) {
    const poem = getPoemById(id);
    if (!poem) continue;
    for (let i = 0; i < poem.cleanLines.length; i++) {
      if (poem.cleanLines[i].includes(char)) {
        results.push({ poem, lineIndex: i, cleanLine: poem.cleanLines[i] });
      }
    }
  }
  // 打乱
  for (let i = results.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [results[i], results[j]] = [results[j], results[i]];
  }
  return results.slice(0, count);
}

/** 验证诗句是否在库中 */
export function verifyLineExists(cleanLine: string): { found: boolean; poem: Poem | null; lineIndex: number } {
  const hits = _lineIndex.get(cleanLine);
  if (!hits || hits.length === 0) return { found: false, poem: null, lineIndex: -1 };
  const hit = hits[0];
  const poem = getPoemById(hit.poemId);
  return { found: true, poem: poem ?? null, lineIndex: hit.lineIndex };
}

/** 获取今日推荐诗（按 rank 顺延） */
export function getDailyPoem(currentRank: number): Poem {
  const nextRank = (currentRank % POEMS.length) + 1;
  return POEMS.find((p) => p.rank === nextRank) ?? POEMS[0];
}

// 预设飞花令常用字
export const FEIHUA_CHARS = [
  "月", "花", "春", "秋", "风", "雨", "山", "水", "云", "雪",
  "夜", "星", "江", "河", "人", "思", "乡", "酒", "剑", "马",
  "日", "天", "鸟", "草", "木", "叶", "声", "光", "心", "情",
];
