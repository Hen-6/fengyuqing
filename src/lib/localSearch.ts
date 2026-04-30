/**
 * localSearch.ts — 本地诗词搜索
 *
 * poems.json 格式：[{ r, t, a, d, id, content: string[], note }]
 *
 * 索引策略：
 * - 启动时一次性加载 poems.json，构建内存索引
 * - 字符倒排索引：char → LineEntry[]，单字符搜索 O(匹配数)
 * - 首次加载后所有 API 均为同步，延迟 < 1ms
 * - Session 内只下载一次，浏览器自动缓存
 */

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

export type OnlinePoemResult = PoemResult;

export interface SearchResult {
  poem: PoemResult;
  score: number;
}

export interface IndexedPoem {
  key: string;
  r: number;
  t: string;
  a: string;
  d: string;
  content: string[];
  note: string;
}

// ─── 索引结构 ───────────────────────────────────────────────────────────────

/** 一句诗在倒排索引中的条目 */
interface LineEntry {
  poem: IndexedPoem;
  lineIndex: number;
  clean: string;   // 去标点后的文本
}

/** 单字符倒排索引：char → 所有包含该字的诗句 */
type CharIndex = Map<string, LineEntry[]>;

// ─── 全局缓存（一次性构建，永久持有）────────────────────────────────────────

let poemsIndex: IndexedPoem[] | null = null;
let keyMap: Map<string, IndexedPoem> | null = null;
let idMap: Map<string, IndexedPoem> | null = null;
let charIndex: CharIndex | null = null;
let loadPromise: Promise<void> | null = null;
let _loaded = false;

const PUNCT_RE = /[，。？！、；：""''【】「」()（）·—–…\s.,?!'":;\[\]]+/g;

function cleanHtml(text: string): string {
  return typeof text === "string"
    ? text.replace(/<[^>]+>/g, "").trim()
    : "";
}

function stripPunct(s: string): string {
  return s.replace(PUNCT_RE, "");
}

/** 触发异步预加载（首次调用时触发，之后立即返回） */
export function preloadIndex(): void {
  if (_loaded || loadPromise) return;
  loadPromise = _load().then(() => { _loaded = true; });
}

export function loadIndex(): Promise<IndexedPoem[]> {
  preloadIndex();
  if (poemsIndex) return Promise.resolve(poemsIndex);
  return loadPromise!.then(() => poemsIndex!);
}

export async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  await loadIndex();
}

async function _load(): Promise<void> {
  const resp = await fetch("/data/poems.json", {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!resp.ok) throw new Error(`加载 poems.json 失败: ${resp.status}`);
  const data: Array<{
    r: number; t: string; a: string; d: string;
    id: string; content: string[]; note: string;
  }> = await resp.json();

  poemsIndex = [];
  keyMap = new Map();
  idMap = new Map();
  charIndex = new Map();

  for (const p of data) {
    const poem: IndexedPoem = {
      key: `${p.t.trim()}:${p.a.trim()}`,
      r: p.r,
      t: p.t,
      a: p.a,
      d: p.d,
      content: (p.content || []).map(cleanHtml),
      note: cleanHtml(p.note || ""),
    };
    poemsIndex!.push(poem);
    keyMap!.set(poem.key, poem);
    if (p.id) idMap!.set(p.id, poem);

    for (let i = 0; i < poem.content.length; i++) {
      const clean = stripPunct(poem.content[i]);
      if (clean.length < 4) continue;
      for (const ch of [...new Set(clean)]) {
        if (ch.trim()) {
          const entry: LineEntry = { poem, lineIndex: i, clean };
          const existing = charIndex!.get(ch);
          if (existing) {
            existing.push(entry);
          } else {
            charIndex!.set(ch, [entry]);
          }
        }
      }
    }
  }
}

// ─── 搜索 ─────────────────────────────────────────────────────────────────

/**
 * 通用搜索：query 可以是单字、多字词组或完整诗句。
 * 索引加载后为同步调用，< 1ms。
 */
export function localSearch(
  query: string,
  maxResults = 8
): SearchResult[] {
  const q = query.trim();
  if (!q || !_loaded || !charIndex) return [];

  const results: SearchResult[] = [];
  const seenKeys = new Set<string>();

  // ── 单字符：用倒排索引 O(匹配数) ──────────────────────────────
  if (q.length === 1) {
    const entries = charIndex!.get(q) ?? [];
    for (const entry of entries) {
      const ukey = `${entry.poem.key}:${entry.lineIndex}`;
      if (seenKeys.has(ukey)) continue;
      seenKeys.add(ukey);
      results.push({
        poem: wrapPoem(entry.poem, entry.lineIndex, entry.clean),
        score: 100,
      });
      if (results.length >= maxResults) break;
    }
    return results;
  }

  // ── 多字符：取出现次数最少的字符作为主查询键 ───────────────────
  const chars = [...new Set(q)];
  let primaryChar = chars[0];
  let minSize = Infinity;
  for (const c of chars) {
    const size = charIndex!.get(c)?.length ?? 0;
    if (size < minSize) { minSize = size; primaryChar = c; }
  }

  const candidates = new Map<string, LineEntry>();
  const entries = charIndex!.get(primaryChar) ?? [];
  for (const entry of entries) {
    let hasAll = true;
    for (const c of chars) {
      if (!entry.clean.includes(c)) { hasAll = false; break; }
    }
    if (hasAll) {
      candidates.set(`${entry.poem.key}:${entry.lineIndex}`, entry);
    }
  }

  for (const [, entry] of candidates) {
    const clean = entry.clean;
    let score = 0;
    if (clean === q) {
      score = 100;
    } else if (clean.includes(q)) {
      score = 80;
    } else if (q.length >= 4) {
      const maxDist = clean.length <= 9 ? 3 : 4;
      if (Math.abs(clean.length - q.length) <= maxDist) {
        const dist = levenshtein(clean, q);
        if (dist <= maxDist) score = Math.max(0, 70 - dist * 10);
      }
    }
    if (score > 0) {
      const ukey = `${entry.poem.key}:${entry.lineIndex}`;
      if (!seenKeys.has(ukey)) {
        seenKeys.add(ukey);
        results.push({ poem: wrapPoem(entry.poem, entry.lineIndex, entry.clean), score });
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * 按字符搜索，返回包含该字的所有诗句（飞花令专用）。
 * 同步，O(匹配数)。
 */
export function searchByChar(char: string, maxResults = 20): SearchResult[] {
  if (!char.trim() || !_loaded || !charIndex) return [];
  const entries = charIndex!.get(char) ?? [];
  const results: SearchResult[] = [];
  const seenKeys = new Set<string>();
  for (const entry of entries) {
    if (!seenKeys.has(entry.poem.key)) {
      seenKeys.add(entry.poem.key);
      results.push({ poem: wrapPoem(entry.poem, entry.lineIndex, entry.clean), score: 100 });
      if (results.length >= maxResults) break;
    }
  }
  return results;
}

export const searchOnline = localSearch;

export function getPoemByKey(key: string): SearchResult | null {
  if (!_loaded || !keyMap) return null;
  let poem = keyMap.get(key) ?? keyMap.get(key.trim());
  if (poem) return wrap(poem);
  const colonIdx = key.trim().indexOf(":");
  if (colonIdx !== -1) {
    const t = key.trim().slice(0, colonIdx).trim();
    const a = key.trim().slice(colonIdx + 1).trim();
    poem = keyMap.get(`${t}:${a}`);
    if (poem) return wrap(poem);
  }
  if (idMap) {
    poem = idMap.get(key) ?? idMap.get(key.trim());
    if (poem) return wrap(poem);
  }
  return null;
}

// ─── 工具 ─────────────────────────────────────────────────────────────────

function wrap(poem: IndexedPoem): SearchResult {
  return {
    poem: wrapPoem(poem, 0, poem.content[0] ?? ""),
    score: 100,
  };
}

function wrapPoem(poem: IndexedPoem, lineIndex: number, matchedLine: string): PoemResult {
  return {
    _id: poem.key,
    name: poem.t,
    author: poem.a,
    dynasty: poem.d,
    content: poem.content,
    note: poem.note,
    matchedLine,
    matchedLineIndex: lineIndex,
  };
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}
