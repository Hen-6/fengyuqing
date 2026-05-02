/**
 * localSearch.ts — 预建倒排索引 + 按需扫描
 *
 * poems.index.json：字符 → poemsArray 索引列表（单字查找 O(1)）
 * poems.json：完整诗歌数据（短字段格式）
 *
 * 字段格式（与 rank_poems.py 输出一致）：
 *   r=rank, t=title, a=author, d=dynasty, id, c=cleanLines, n=note
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface IndexedPoem {
  r: number; t: string; a: string; d: string; id: string; c: string[]; n: string;
  /** 内部字段：去重后的 key = "title:author"，加载时由 localSearch.ts 填充 */
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

// ─── Module-level cache (singleton) ───────────────────────────────────────

let poemsArray: IndexedPoem[] = [];
let poemsMapData: Record<string, number> = {};
let _loaded = false;

// 预建倒排索引：字符 → poemsArray 索引列表（单字 O(1)）
let charIndex: Map<string, number[]> = new Map();

// 辅助：去除标点
const PUNCT_RE = /[，。？！、；：""''【】「」()（）·—–…\s.,?!'":;\[\]]+/g;
function stripPunct(s: string): string {
  return s.replace(PUNCT_RE, "");
}
function cleanHtml(text: string): string {
  return typeof text === "string" ? text.replace(/<[^>]+>/g, "").trim() : "";
}

// ─── 基础路径 ─────────────────────────────────────────────────────────────

function getBase(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.replace(/\/[^/]*$/, "") || "";
}

// ─── 加载 poems.index.json（预建倒排索引，小文件） ──────────────────────────

async function _loadIndex(base: string): Promise<void> {
  const url = `${base}/data/poems.index.json`;
  const text = await fetch(url).then(r => {
    if (!r.ok) throw new Error(`无法加载索引: ${r.url}`);
    return r.text();
  });
  const data = JSON.parse(text) as Record<string, number[]>;
  charIndex = new Map(Object.entries(data));
}

// ─── 加载 poems.json（诗歌数据） ───────────────────────────────────────────

async function _loadPoems(base: string): Promise<void> {
  const text = await fetch(`${base}/data/poems.json`).then(r => {
    if (!r.ok) throw new Error(`无法加载诗歌: ${r.url}`);
    return r.text();
  });
  const raw = JSON.parse(text) as IndexedPoem[];
  poemsArray = raw.map((p, i) => ({
    ...p,
    k: `${p.t}:${p.a}`,
  }));
  // 建立 key → index 映射
  poemsMapData = {};
  for (let i = 0; i < poemsArray.length; i++) {
    poemsMapData[poemsArray[i].k!] = i;
  }
}

// ─── 公开加载 API ─────────────────────────────────────────────────────────

export function isLoaded(): boolean {
  return _loaded;
}

export async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  const base = getBase();
  await Promise.all([_loadIndex(base), _loadPoems(base)]);
  _loaded = true;
}

export function getAllPoems(): IndexedPoem[] {
  return poemsArray;
}

// ─── Search ─────────────────────────────────────────────────────────────────

function wrapPoem(poem: IndexedPoem, lineIdx: number, matchedLine: string): PoemResult {
  return {
    _id: poem.k ?? `${poem.t}:${poem.a}`,
    name: poem.t,
    author: poem.a,
    dynasty: poem.d,
    content: poem.c,
    note: poem.n,
    matchedLine,
    matchedLineIndex: lineIdx,
  };
}

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

    let matchedLine = poem.c[0] ?? "";
    let matchedLineIdx = 0;
    for (let li = 0; li < poem.c.length; li++) {
      if (stripPunct(poem.c[li]).includes(char)) {
        matchedLine = stripPunct(poem.c[li]);
        matchedLineIdx = li;
        break;
      }
    }
    results.push({ poem: wrapPoem(poem, matchedLineIdx, matchedLine), score: 100 });
    if (results.length >= maxResults) break;
  }
  return results;
}

/** 多字/词组搜索：按需扫描 poemsArray */
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

    for (let li = 0; li < poem.c.length; li++) {
      const clean = stripPunct(poem.c[li]);
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
        results.push({ poem: wrapPoem(poem, li, clean), score });
        break;
      }
    }
    if (results.length >= maxResults) break;
  }
  return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

// ─── Public API ────────────────────────────────────────────────────────────

export function searchByChar(char: string, maxResults = 20): SearchResult[] {
  return searchByCharImpl(char, maxResults);
}

export function searchOnline(query: string, maxResults = 8): SearchResult[] {
  if (!isLoaded()) return [];
  if (!query.trim()) return [];
  const q = query.trim();
  if (q.length === 1) return searchByCharImpl(q, maxResults);
  return searchByMultiChar(q, maxResults);
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
  return { poem: wrapPoem(poem, 0, poem.c[0] ?? ""), score: 100 };
}

export const localSearch = searchOnline;
export { poemsArray };

// ─── 句级搜索（支持逗号分隔的短句） ─────────────────────────────────────────

const SHORT_PUNCT_RE = /[，、；：]/;

function normalize(s: string): string {
  return s.replace(SHORT_PUNCT_RE, "").trim();
}

/**
 * 将用户输入拆分为"小句"（以中文逗号/顿号/分号/冒号分隔），
 * 每小句 ≥4 字即为有效句。
 * 返回所有有效小句的组合（单句 + 连续两短句 + ...）
 */
function splitIntoClauses(input: string): string[] {
  const raw = input.trim();
  if (!raw) return [];

  // 先检查完整句子（可能含有句号、感叹号、问号结尾）
  const whole = normalize(raw);
  if (whole.length >= 4) return [whole];

  // 按短句分隔符拆分为小句
  const parts = raw.split(SHORT_PUNCT_RE).map(normalize).filter((s) => s.length >= 4);
  return parts;
}

/**
 * 在数据库中搜索用户输入的句级匹配。
 * 优先级：
 * 1. 完整输入去标点精确匹配某行
 * 2. 逗号分隔的每个小句单独匹配
 * 3. 连续两个短句合并后匹配
 */
export function searchByLine(input: string, maxResults = 5): SearchResult[] {
  if (!isLoaded() || !input.trim()) return [];

  const clauses = splitIntoClauses(input);
  if (clauses.length === 0) return [];

  const seen = new Set<string>();
  const results: SearchResult[] = [];

  for (const clause of clauses) {
    for (let pi = 0; pi < poemsArray.length; pi++) {
      const poem = poemsArray[pi];
      const ukey = poem.k ?? "";
      if (seen.has(ukey)) continue;

      for (let li = 0; li < poem.c.length; li++) {
        const clean = normalize(poem.c[li]);
        if (clean === clause) {
          seen.add(ukey);
          results.push({ poem: wrapPoem(poem, li, poem.c[li]), score: 100 });
          break;
        }
      }
      if (results.length >= maxResults) break;
    }
    if (results.length >= maxResults) break;
  }

  // 仍未命中 → 降级到词组搜索（searchOnline）
  if (results.length === 0) {
    return searchOnline(input, maxResults);
  }
  return results;
}

export function getPoemIdx(key: string): number | undefined {
  return poemsMapData[key];
}

export function preloadIndex(): void {
  ensureLoaded();
}
