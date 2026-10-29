import { getPoemByKeyFast } from "../data/allPoemsLookup";

export interface PoemResult {
  _id: string;
  name: string;
  author: string;
  dynasty: string;
  content: string[];
  note: string;
  trans?: string;
  shangxi?: string;
  tags?: string[];
  matchedLine: string;
  matchedLineIndex: number;
}

export type OnlinePoemResult = PoemResult;

export interface SearchResult {
  poem: PoemResult;
  score: number;
}

function stripPunct(s: string): string {
  return s.replace(/[，。！？、；：""''（）【】《》〈〉〔〕—…·.!?,\s]/g, "");
}

// Instantiate Web Worker for frontend search
let worker: Worker | null = null;
let msgIdCounter = 0;
const resolvers = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

if (typeof window !== "undefined") {
    worker = new Worker(new URL('../workers/searchWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
        const { id, error, results } = e.data;
        const p = resolvers.get(id);
        if (p) {
            resolvers.delete(id);
            if (error) p.reject(new Error(error));
            else p.resolve(results);
        }
    };
}

async function runWorker(type: string, payload: any): Promise<any> {
    if (!worker) throw new Error("Worker not initialized (SSR)");
    const id = ++msgIdCounter;
    return new Promise((resolve, reject) => {
        resolvers.set(id, { resolve, reject });
        worker!.postMessage({ id, type, ...payload });
    });
}

export async function searchOnline(
  query: string,
  maxResults = 20,
  mode: 'general' | 'line' | 'char' | 'tag' = 'general',
  matchType: 'exact' | 'scattered' = 'exact',
  tag?: string
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q && !tag) return [];

  try {
    const results = await runWorker('SEARCH', { query: q, mode, limit: maxResults, matchType, tag });
    if (!results || results.length === 0) return [];

    return results.map((r: any, idx: number) => {
       let matchedLineIndex = 0;
       
       if (r.matchedLine) {
           matchedLineIndex = r.lines.findIndex((l: string) => l === r.matchedLine) || 0;
           if (matchedLineIndex === -1) matchedLineIndex = 0;
       }

       return {
           poem: {
               _id: r.id || `fallback-${r.title}`,
               name: r.title,
               author: r.author,
               dynasty: r.dynasty || r.d || "未知",
               content: r.lines,
               note: r.note || "",
               trans: r.trans || "",
               shangxi: r.shangxi || "",
               tags: r.tags || [],
               matchedLine: r.matchedLine || r.lines[0] || "",
               matchedLineIndex
           },
           score: r.score || (100 - idx)
       };
    }).slice(0, maxResults);
  } catch (error) {
    console.error("Search API error:", error);
    return [];
  }
}

export async function generalSearch(query: string, maxResults = 2000): Promise<SearchResult[]> {
  return searchOnline(query, maxResults, 'general');
}

export async function searchByTag(tag: string, maxResults = 2000, textQuery = ""): Promise<SearchResult[]> {
  const cleanTag = tag.trim();
  if (!cleanTag) return [];
  return searchOnline(textQuery || cleanTag, maxResults, 'tag', 'exact', cleanTag);
}

export async function getAllTags(): Promise<{ name: string; count: number }[]> {
  try {
    const res = await runWorker('GET_TAGS', {});
    return res || [];
  } catch (error) {
    console.error("getAllTags error:", error);
    return [];
  }
}

export async function searchByChar(char: string, maxResults = 20, matchType: 'exact' | 'scattered' = 'exact'): Promise<SearchResult[]> {
  const cleanQuery = stripPunct(char.trim());
  if (!cleanQuery) return [];
  return searchOnline(cleanQuery, maxResults, 'char', matchType);
}

export async function getPoemByKeyExport(key: string): Promise<SearchResult | null> {
  const cached = getPoemByKeyFast(key);
  if (cached) {
    return {
      poem: { _id: key, name: cached.t, author: cached.a, dynasty: cached.d || "", content: cached.content || [], note: cached.note || "", trans: cached.trans || "", shangxi: cached.shangxi || "", tags: cached.tags || [], matchedLine: cached.content?.[0] || "", matchedLineIndex: 0 },
      score: 100,
    };
  }
  try {
    const data = await runWorker('GET_POEM', { key });
    if (!data || !data.poem) return null;

    const p = data.poem;
    return {
      poem: { _id: p.id || key, name: p.t, author: p.a, dynasty: p.d || "", content: p.content || [], note: p.note || "", trans: p.trans || "", shangxi: p.shangxi || "", tags: p.tags || [], matchedLine: p.content?.[0] || "", matchedLineIndex: 0 },
      score: 100,
    };
  } catch (error) {
    console.error("getPoemByKeyExport error:", error);
    return null;
  }
}

export function isLoaded(): boolean { return true; }
export async function ensureLoaded(): Promise<void> { return Promise.resolve(); }
export async function getAllPoems(): Promise<any[]> { return Promise.resolve([]); }
export const localSearch = searchOnline;

export function searchFullDataset(query: string, limit = 50): Promise<PoemResult[]> {
    return new Promise((resolve) => {
        const id = Math.random().toString(36).substring(7);
        const handler = (e: MessageEvent) => {
            if (e.data.id === id) {
                if (e.data.type === 'SEARCH_FULL_RESULT') {
                    worker?.removeEventListener('message', handler);
                    resolve(e.data.results);
                } else if (e.data.error) {
                    worker?.removeEventListener('message', handler);
                    console.error("Worker error:", e.data.error);
                    resolve([]);
                }
            }
        };
        worker?.addEventListener('message', handler);
        worker?.postMessage({ type: 'SEARCH_FULL', query, limit, id });
    });
}

export function addCustomPoemsToWorker(poems: PoemResult[]): Promise<void> {
    return new Promise((resolve) => {
        const id = Math.random().toString(36).substring(7);
        const handler = (e: MessageEvent) => {
            if (e.data.type === 'ADD_CUSTOM_RESULT' && e.data.id === id) {
                worker?.removeEventListener('message', handler);
                resolve();
            }
        };
        worker?.addEventListener('message', handler);
        worker?.postMessage({ type: 'ADD_CUSTOM', customPoems: poems, id });
    });
}

export async function getWorkerPoemCount(): Promise<number> {
    try {
        const res = await runWorker('COUNT', {});
        return res?.count ?? 9880;
    } catch {
        return 9880;
    }
}

export async function getAllWorkerKeys(): Promise<string[]> {
    try {
        const res = await runWorker('GET_ALL_KEYS', {});
        return res || [];
    } catch (e) {
        console.error("Failed to get all keys from worker:", e);
        return [];
    }
}

export async function getDailyRecommendation(
    excludedKeys: string[] = [],
    offset = 0
): Promise<{ poem: PoemResult | null; rank: number; total: number }> {
    try {
        const res = await runWorker('GET_DAILY', { excludedKeys, offset });
        if (!res?.poem) return { poem: null, rank: 0, total: 0 };
        return {
            poem: {
                _id: res.poem.id,
                name: res.poem.t,
                author: res.poem.a,
                dynasty: res.poem.d,
                content: res.poem.content,
                note: res.poem.note || "",
                trans: res.poem.trans || "",
                shangxi: res.poem.shangxi || "",
                tags: res.poem.tags || [],
                matchedLine: res.poem.content[0] || "",
                matchedLineIndex: 0,
            },
            rank: res.rank,
            total: res.total,
        };
    } catch (e) {
        console.error("Failed to get daily recommendation:", e);
        return { poem: null, rank: 0, total: 0 };
    }
}
