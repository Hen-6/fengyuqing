/**
 * localSearch.ts — 静态搜索（poemsData chunk 已预加载，搜索同步完成）
 *
 * 数据来源：poemsData.ts（webpack chunk，内含 charIndex + poemsArray + poemsMapData）
 * 加载方式：dynamic import() → webpack 分 chunk，主 bundle 不阻塞
 *
 * 字段格式（与 rank_poems.py 输出一致）：
 *   r=rank, t=title, a=author, d=dynasty, id, c=cleanLines, n=note
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface IndexedPoem {
  r: number; t: string; a: string; d: string; id: string;
  /** 带标点原始句（搜索和展示用） */
  p: string[];
  /** 去标点句（索引用） */
  c: string[];
  n: string;
  /** key = "title:author" */
  k: string;
}

export interface PoemResult {
  _id: string; name: string; author: string; dynasty: string;
  content: string[]; note: string;
  matchedLine: string; matchedLineIndex: number;
}

export interface SearchResult {
  poem: PoemResult; score: number;
}

export type OnlinePoemResult = PoemResult;

// ─── Module-level state ────────────────────────────────────────────────────

let poemsArray: IndexedPoem[] = [];
let poemsMapData: Record<string, number> = {};
let charIndex: Map<string, number[]> = new Map();
let _loaded = false;

// ─── 数据加载（dynamic import → webpack chunk） ─────────────────────────────

async function _loadBundledData(): Promise<void> {
  if (_loaded) return;
  const { charIndex: idx, poemsArray: arr, poemsMapData: map } =
    await import("./poemsData");
  charIndex = idx;
  poemsArray = arr;
  poemsMapData = map;
  _loaded = true;
}

// ─── 公开 API ─────────────────────────────────────────────────────────────

export function isLoaded(): boolean {
  return _loaded;
}

export async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  await _loadBundledData();
}

export function getAllPoems(): IndexedPoem[] {
  return poemsArray;
}

// ─── 辅助 ────────────────────────────────────────────────────────────────

const PUNCT_RE = /[，。？！、；：""''【】「」()（）·—–…\s.,?!'":;\[\]]+/g;

function stripPunct(s: string): string {
  return s.replace(PUNCT_RE, "");
}

function cleanHtml(text: string): string {
  return typeof text === "string" ? text.replace(/<[^>]+>/g, "").trim() : "";
}

const SHORT_PUNCT_RE = /[，、；：]/;

function normalize(s: string): string {
  return s.replace(SHORT_PUNCT_RE, "").trim();
}

// ─── 结果封装 ────────────────────────────────────────────────────────────

function wrapPoem(poem: IndexedPoem, lineIdx: number, matchedLine: string): PoemResult {
  return {
    _id: poem.k,
    name: poem.t,
    author: poem.a,
    dynasty: poem.d,
    content: poem.p,  // 返回带标点原始句，供展示
    note: poem.n,
    matchedLine,
    matchedLineIndex: lineIdx,
  };
}

// ─── 搜索实现 ────────────────────────────────────────────────────────────

/** 单字搜索：倒排索引 O(匹配数) */
function searchByCharImpl(char: string, maxResults: number): SearchResult[] {
  if (!char.trim()) return [];
  const seen = new Set<string>();
  const results: SearchResult[] = [];

  const indices = charIndex.get(char) ?? [];
  for (const idx of indices) {
    const poem = poemsArray[idx];
    const ukey = poem.k ?? "";
    if (seen.has(ukey)) continue;
    seen.add(ukey);

    let matchedLine = poem.p[0] ?? "";   // 带标点原始句
    let matchedLineIdx = 0;
    for (let li = 0; li < poem.p.length; li++) {
      if (stripPunct(poem.p[li]).includes(char)) {
        matchedLine = poem.p[li];
        matchedLineIdx = li;
        break;
      }
    }
    results.push({ poem: wrapPoem(poem, matchedLineIdx, matchedLine), score: 100 });
    if (results.length >= maxResults) break;
  }
  return results;
}

/** 多字/词组搜索：扫描 poemsArray */
function searchByMultiChar(query: string, maxResults: number): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.trim();
  const chars = [...new Set(q)];
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  outer:
  for (let pi = 0; pi < poemsArray.length; pi++) {
    const poem = poemsArray[pi];
    const ukey = poem.k ?? "";
    if (seen.has(ukey)) continue;

    for (let li = 0; li < poem.p.length; li++) {
      const raw = poem.p[li];
      const clean = stripPunct(raw);
      if (clean.length < 4) continue;

      let hasAll = true;
      for (const c of chars) {
        if (!clean.includes(c)) { hasAll = false; break; }
      }
      if (!hasAll) continue;

      let score = 0;
      if (clean === q) score = 100;
      else if (clean.includes(q)) score = 80;

      if (score > 0) {
        seen.add(ukey);
        results.push({ poem: wrapPoem(poem, li, raw), score });  // 返回带标点原始句
        break;
      }
    }
    if (results.length >= maxResults) break;
  }
  return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

// ─── 句级搜索（支持逗号分隔的短句） ─────────────────────────────────────────

function splitIntoClauses(input: string): string[] {
  const raw = input.trim();
  if (!raw) return [];
  const whole = normalize(raw);
  if (whole.length >= 4) return [whole];
  const parts = raw.split(SHORT_PUNCT_RE).map(normalize).filter((s) => s.length >= 4);
  return parts;
}

export function searchByLine(input: string, maxResults = 5): SearchResult[] {
  if (!_loaded || !input.trim()) return [];

  const clauses = splitIntoClauses(input);
  if (clauses.length === 0) return [];

  const seen = new Set<string>();
  const results: SearchResult[] = [];

  // 在带标点的原始句中搜索（对用户输入去标点后做等值匹配）
  for (const clause of clauses) {
    for (let pi = 0; pi < poemsArray.length; pi++) {
      const poem = poemsArray[pi];
      const ukey = poem.k ?? "";
      if (seen.has(ukey)) continue;

      for (let li = 0; li < poem.p.length; li++) {
        const clean = normalize(poem.p[li]);  // 原始句去标点后比较
        if (clean === clause) {
          seen.add(ukey);
          results.push({ poem: wrapPoem(poem, li, poem.p[li]), score: 100 });  // 返回带标点原始句
          break;
        }
      }
      if (results.length >= maxResults) break;
    }
    if (results.length >= maxResults) break;
  }

  if (results.length === 0) {
    return searchOnline(input, maxResults);
  }
  return results;
}

// ─── 公开搜索 API ────────────────────────────────────────────────────────

export function searchOnline(query: string, maxResults = 8): SearchResult[] {
  if (!_loaded || !query.trim()) return [];
  const q = query.trim();
  if (q.length === 1) return searchByCharImpl(q, maxResults);
  return searchByMultiChar(q, maxResults);
}

export function searchByChar(char: string, maxResults = 20): SearchResult[] {
  return searchByCharImpl(char, maxResults);
}

export function getPoemByKeyExport(key: string): SearchResult | null {
  let idx = poemsMapData[key];
  if (idx === undefined) {
    idx = poemsMapData[key.trim()];
    if (idx === undefined) {
      const colonIdx = key.trim().indexOf(":");
      if (colonIdx !== -1) {
        const t = key.trim().slice(0, colonIdx).trim();
        const a = key.trim().slice(colonIdx + 1).trim();
        idx = poemsMapData[`${t}:${a}`];
      }
    }
  }
  if (idx === undefined) return null;
  const poem = poemsArray[idx];
  if (!poem) return null;
  return { poem: wrapPoem(poem, 0, poem.p[0] ?? ""), score: 100 };
}

export function getPoemIdx(key: string): number | undefined {
  return poemsMapData[key];
}

export function preloadIndex(): void {
  ensureLoaded();
}

export const localSearch = searchOnline;
export { poemsArray };
