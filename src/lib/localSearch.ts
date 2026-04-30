/**
 * localSearch.ts — 本地诗词搜索（从 public/data/poems.json 加载）
 *
 * poems.json 格式：
 *   [{ r, t, a, d, id, content: string[], note }]
 *
 * 加载策略：首次调用时 fetch 全文，存入内存索引；
 * Session 内只下载一次，浏览器自动缓存。
 */

export interface PoemResult {
  _id: string;
  name: string;      // title (yxcs 兼容)
  author: string;
  dynasty: string;
  content: string[];
  note: string;
  matchedLine: string;
  matchedLineIndex: number;
}

// Alias for backwards compatibility with OnlinePoemCard etc.
export type OnlinePoemResult = PoemResult;

export interface SearchResult {
  poem: PoemResult;
  score: number;
}

export interface IndexedPoem {
  key: string;        // "title:author"
  r: number;
  t: string;
  a: string;
  d: string;
  content: string[];
  note: string;
}

// ─── 内存缓存 ───────────────────────────────────────────────────────────────

let poemsIndex: IndexedPoem[] | null = null;
let keyMap: Map<string, IndexedPoem> | null = null;   // O(1) lookup by key
let idMap: Map<string, IndexedPoem> | null = null;    // O(1) lookup by id (yxcs _id)
let loadPromise: Promise<IndexedPoem[]> | null = null;

const PUNCT_RE = /[，。？！、；：""''【】「」()（）·—–…\s.,?!'":;\[\]]+/g;

function cleanHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

function stripPunct(s: string): string {
  return s.replace(PUNCT_RE, "");
}

export async function loadIndex(): Promise<IndexedPoem[]> {
  if (poemsIndex) return poemsIndex;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const resp = await fetch("/data/poems.json", {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!resp.ok) throw new Error(`Failed to load poems.json: ${resp.status}`);
    const data: Array<{
      r: number;
      t: string;
      a: string;
      d: string;
      id: string;
      content: string[];
      note: string;
    }> = await resp.json();

    poemsIndex = [];
    keyMap = new Map();
    idMap = new Map();

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
      poemsIndex.push(poem);
      keyMap.set(poem.key, poem);
      // 旧版 poems.json 用 id 字段，兼容 ObjectId 风格 id
      if (p.id) idMap.set(p.id, poem);
    }

    return poemsIndex;
  })();

  return loadPromise;
}

// ─── 搜索 ─────────────────────────────────────────────────────────────────

/**
 * 在本地诗词库中搜索。
 * query 可以是：单字、词组、完整诗句。
 */
export async function localSearch(
  query: string,
  maxResults = 8
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const index = await loadIndex();
  const results: SearchResult[] = [];
  const seenKeys = new Set<string>();

  for (const poem of index) {
    const content = poem.content;
    for (let i = 0; i < content.length; i++) {
      const clean = stripPunct(content[i]);
      if (!clean || clean.length < 4) continue;

      let score = 0;
      if (clean === q) {
        score = 100;
      } else if (clean.includes(q)) {
        score = 80;
      } else if (q.length >= 4 && clean.length >= 4) {
        const maxDist = Math.max(clean.length, q.length) <= 9 ? 3 : 4;
        if (Math.abs(clean.length - q.length) <= maxDist) {
          const dist = levenshtein(clean, q);
          if (dist <= maxDist) {
            score = Math.max(0, 70 - dist * 10);
          }
        }
      }

      if (score > 0) {
        const ukey = `${poem.key}:${i}`;
        if (!seenKeys.has(ukey)) {
          seenKeys.add(ukey);
          results.push({
            poem: {
              _id: poem.key,
              name: poem.t,
              author: poem.a,
              dynasty: poem.d,
              content: poem.content,
              note: poem.note,
              matchedLine: content[i],
              matchedLineIndex: i,
            },
            score,
          });
          if (results.length >= maxResults * 3) break;
        }
      }
    }
    if (results.length >= maxResults * 3) break;
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
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

// ─── 兼容别名（直接替代原 onlineSearch 模块） ────────────────────────────────

export const searchOnline = localSearch;

/**
 * O(1) 按 "title:author" key 精确查找一首诗。
 * 同时兼容旧版 ObjectId key（通过 idMap）。
 */
export async function getPoemByKey(
  key: string
): Promise<SearchResult | null> {
  await loadIndex();
  if (!keyMap) return null;

  // 1. 直接查 keyMap
  let poem = keyMap.get(key);
  if (poem) return wrap(poem);

  // 2. trim 后查 keyMap
  const trimmed = key.trim();
  poem = keyMap.get(trimmed);
  if (poem) return wrap(poem);

  // 3. 解析 "title:author" 后重新拼接查 keyMap
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx !== -1) {
    const t = trimmed.slice(0, colonIdx).trim();
    const a = trimmed.slice(colonIdx + 1).trim();
    poem = keyMap.get(`${t}:${a}`);
    if (poem) return wrap(poem);
  }

  // 4. 旧版 ObjectId key → 通过 idMap 查找
  if (idMap) {
    poem = idMap.get(key) ?? idMap.get(trimmed);
    if (poem) return wrap(poem);
  }

  return null;
}

function wrap(poem: IndexedPoem): SearchResult {
  return {
    poem: {
      _id: poem.key,
      name: poem.t,
      author: poem.a,
      dynasty: poem.d,
      content: poem.content,
      note: poem.note,
      matchedLine: poem.content[0] || "",
      matchedLineIndex: 0,
    },
    score: 100,
  };
}

// ─── 预加载 ───────────────────────────────────────────────────────────────

let preloadStarted = false;
export function preloadIndex(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  loadIndex().catch(console.error);
}
