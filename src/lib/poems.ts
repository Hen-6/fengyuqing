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
  cleanPair: string;       // 去标点合并，如"床前明月光疑是地上霜"
  rawPair: string;        // 含标点合并，如"床前明月光，疑是地上霜。"
  charCount: number;      // 5 或 7
  poem: Poem;
}
const _coupletIndex: CoupletEntry[] = [];

function buildIndexes() {
  for (const poem of POEMS) {
    const { id, cleanLines } = poem;
    const rawLines = poem.lines ?? cleanLines;

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
      const charCount = l1.length; // 5 或 7
      if (charCount !== 5 && charCount !== 7) continue;
      const r1 = rawLines[i] ?? l1;
      const r2 = rawLines[i + 1] ?? l2;
      _coupletIndex.push({ poemId: id, lineIndex: i, cleanPair: l1 + l2, rawPair: r1 + r2, charCount, poem });
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

/** 去除所有中文标点符号 */
export function stripPunctuation(s: string): string {
  return s.replace(/[，。？！、；：""''【】『』「」()（）·—–\-…\s.,?!'":;[\]「」『』【】]/g, "");
}

/** Levenshtein 编辑距离 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** 验证诗句是否在库中（自动去除标点后匹配） */
export function verifyLineExists(rawLine: string): { found: boolean; poem: Poem | null; lineIndex: number } {
  const clean = stripPunctuation(rawLine);
  const hits = _lineIndex.get(clean);
  if (!hits || hits.length === 0) return { found: false, poem: null, lineIndex: -1 };
  const hit = hits[0];
  const poem = getPoemById(hit.poemId);
  return { found: true, poem: poem ?? null, lineIndex: hit.lineIndex };
}

/** 查找相近诗词（当精确匹配失败时）
 *
 *  策略：
 *  1. 子串匹配：查询句子是否为库中任意句的子串（允许中间有标点差异）
 *  2. 子串反向：库中句子是否为查询句的子串
 *  3. 宽阈值编辑距离：允许 5 言 ±3 字 / 7 言 ±3 字 / 长句 ±4 字 差异
 */
export function findSimilarLines(rawLine: string, maxResults = 8): { poem: Poem; lineIndex: number; cleanLine: string; distance: number }[] {
  const clean = stripPunctuation(rawLine);
  if (!clean || clean.length < 4) return [];

  const results: { poem: Poem; lineIndex: number; cleanLine: string; distance: number }[] = [];
  const len = clean.length;

  for (const poem of POEMS) {
    for (let i = 0; i < poem.cleanLines.length; i++) {
      const cl = poem.cleanLines[i];

      // 1. 精确匹配（理论上上面已处理，双保险）
      if (cl === clean) {
        results.push({ poem, lineIndex: i, cleanLine: cl, distance: 0 });
        continue;
      }

      const clen = cl.length;

      // 2. 子串匹配（处理标点分割导致的不完整输入）
      // 用户输入是库中句的子串，或库中句是用户输入的子串
      if (len >= 4 && clen >= 4) {
        const isSubstr = cl.includes(clean) || clean.includes(cl);
        if (isSubstr) {
          const dist = Math.abs(len - clen);
          results.push({ poem, lineIndex: i, cleanLine: cl, distance: dist });
          continue;
        }
      }

      // 3. 宽阈值编辑距离
      // 五言：允许±3，七言：允许±3，长句：允许±4
      const maxLenDiff = Math.max(len, clen) <= 7 ? 3 : 4;
      const maxDist = Math.max(maxLenDiff, 2);
      if (Math.abs(len - clen) <= maxLenDiff) {
        const dist = levenshtein(clean, cl);
        if (dist <= maxDist) {
          results.push({ poem, lineIndex: i, cleanLine: cl, distance: dist });
        }
      }
    }
  }

  // 去重（同诗同句只保留一条），按编辑距离升序
  const seen = new Set<string>();
  const deduped: typeof results = [];
  for (const r of results) {
    const key = `${r.poem.id}:${r.lineIndex}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }
  deduped.sort((a, b) => a.distance - b.distance);
  return deduped.slice(0, maxResults);
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
