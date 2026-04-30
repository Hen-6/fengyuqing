/**
 * localSearch.ts — 运行时加载 + 内存倒排索引诗词搜索
 *
 * poems.json 放在 public/data/，由 Next.js 静态导出时复制到 out/。
 * 首次调用 ensureLoaded() 加载一次，缓存于模块级别。
 * 搜索：预建字符倒排索引（单字 O(1)，多字全表扫描 ~15ms）。
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface IndexedPoem {
  k: string; r: number; t: string; a: string; d: string; id: string;
  c: string[]; n: string;
}

export interface PoemResult {
  _id: string;
  name: string;
  author: string;
  dynasty: string;
  content: string[];
  note: string;
  matchedLine: string;
  matchedLineIndex: number;
}

export interface SearchResult {
  poem: PoemResult;
  score: number;
}

export type OnlinePoemResult = PoemResult;

// ─── Module-level cache (singleton) ───────────────────────────────────────

let poemsArray: IndexedPoem[] = [];
let poemsMapData: Record<string, number> = {};
let _loaded = false;

// 预建倒排索引：字符 → poemsArray 索引列表
let charIndex: Map<string, number[]> = new Map();

export function isLoaded(): boolean {
  return _loaded;
}

export function ensureLoaded(): Promise<void> {
  if (_loaded) return Promise.resolve();
  return _doLoad();
}

const PUNCT_RE = /[，。？！、；：""''【】「」()（）·—–…\s.,?!'":;\[\]]+/g;

function stripPunct(s: string): string {
  return s.replace(PUNCT_RE, "");
}

function cleanHtml(text: string): string {
  return typeof text === "string" ? text.replace(/<[^>]+>/g, "").trim() : "";
}

async function _doLoad(): Promise<void> {
  const raw = await fetch("/data/poems.json").then(r => r.text());
  const poemsRaw = JSON.parse(raw) as Array<{
    r: number; t: string; a: string; d: string;
    id?: string; content?: string[]; note?: string;
  }>;

  poemsArray = poemsRaw.map((p) => ({
    k: `${p.t.trim()}:${p.a.trim()}`,
    r: p.r,
    t: p.t,
    a: p.a,
    d: p.d,
    id: p.id ?? "",
    c: (p.content ?? []).map(cleanHtml),
    n: cleanHtml(p.note ?? ""),
  }));

  poemsMapData = {};
  for (let i = 0; i < poemsArray.length; i++) {
    poemsMapData[poemsArray[i].k] = i;
  }

  // 预建字符倒排索引
  charIndex = new Map();
  for (let i = 0; i < poemsArray.length; i++) {
    const chars = new Set(
      poemsArray[i].c.join("").replace(PUNCT_RE, "").split("")
    );
    for (const c of chars) {
      if (!charIndex.has(c)) charIndex.set(c, []);
      charIndex.get(c)!.push(i);
    }
  }

  _loaded = true;
}

function wrapPoem(poem: IndexedPoem, lineIdx: number, matchedLine: string): PoemResult {
  return {
    _id: poem.k,
    name: poem.t,
    author: poem.a,
    dynasty: poem.d,
    content: poem.c,
    note: poem.n,
    matchedLine,
    matchedLineIndex: lineIdx,
  };
}

// ─── Search ─────────────────────────────────────────────────────────────────

/** 单字搜索：倒排索引 O(匹配数) */
function searchByCharImpl(char: string, maxResults: number): SearchResult[] {
  if (!char.trim()) return [];
  const seen = new Set<string>();
  const results: SearchResult[] = [];

  const indices = charIndex.get(char) ?? [];
  for (const idx of indices) {
    const poem = poemsArray[idx];
    const ukey = poem.k;
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
    if (results.length >= maxResults) return results;
  }

  return results;
}

/** 多字/词组搜索：全表扫描 */
function searchByMultiChar(query: string, maxResults: number): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.trim();
  const chars = [...new Set(q)];
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (let pi = 0; pi < poemsArray.length; pi++) {
    const poem = poemsArray[pi];
    const ukey = poem.k;
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

// Aliases
export const localSearch = searchOnline;
export { poemsArray };

// ─── Data access ───────────────────────────────────────────────────────────

export function getAllPoems(): IndexedPoem[] {
  return poemsArray;
}

export function getPoemIdx(key: string): number | undefined {
  return poemsMapData[key];
}

export function preloadIndex(): void {
  ensureLoaded();
}
