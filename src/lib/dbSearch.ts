import { supabase } from "./supabaseClient";
import { getPoemByKeyFast } from "../data/allPoemsLookup";

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

function stripPunct(s: string): string {
  return s.replace(/[，。！？、；：""''（）【】《》〈〉〔〕—…·.!?,\s]/g, "");
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

export async function searchOnline(
  query: string,
  maxResults = 8
): Promise<SearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const tokens = cleanQuery.split(/\s+/).map(t => stripPunct(t)).filter(Boolean);
  if (tokens.length === 0) return [];

  let finalResults: SearchResult[] = [];

  try {
    // 1. Try fuzzy search RPC for Title/Author (Instant via pg_trgm indices)
    const { data: fuzzyData, error: fuzzyError } = await supabase.rpc("search_poems_fuzzy", {
      query_text: stripPunct(cleanQuery),
      max_results: maxResults,
    });

    if (!fuzzyError && fuzzyData && fuzzyData.length > 0) {
      for (const r of fuzzyData) {
        finalResults.push({
          poem: {
            _id: r.id,
            name: r.title,
            author: r.author,
            dynasty: r.dynasty || "",
            content: r.lines || [],
            note: "",
            matchedLine: r.lines?.[0] || "",
            matchedLineIndex: 0,
          },
          score: 100, // Trust the database ranking
        });
      }
    }
  } catch (err) {
    console.error("Supabase search failed:", err);
  }

  // 2. If the database didn't find enough, or if it's a very short query (like a single character for 飞花令),
  // fallback to the ultra-fast local JSON map in Javascript (searches 314k poems in < 150ms).
  if (finalResults.length < maxResults) {
    const { loadAllPoemsLookup } = await import("../data/allPoemsLookup");
    const map = await loadAllPoemsLookup();
    
    // We only need one token for local substring matching
    const token = tokens[0];
    let added = 0;

    for (const [key, p] of map.entries()) {
      if (finalResults.some(res => res.poem._id === key)) continue; // skip duplicates

      let tokenMatched = false;
      let matchedLine = p.content?.[0] || "";
      let matchedLineIndex = 0;

      // Check title/author first (in case DB failed)
      if (p.t.includes(token) || p.a.includes(token)) {
        tokenMatched = true;
      } else if (p.content) {
        // Scan the lines for the character/phrase
        for (let i = 0; i < p.content.length; i++) {
          if (p.content[i].includes(token)) {
            tokenMatched = true;
            matchedLine = p.content[i];
            matchedLineIndex = i;
            break;
          }
        }
      }

      if (tokenMatched) {
        finalResults.push({
          poem: {
            _id: key, // Use key as ID
            name: p.t,
            author: p.a,
            dynasty: p.d || "",
            content: p.content || [],
            note: "",
            matchedLine,
            matchedLineIndex,
          },
          score: 50, // Local fallback score
        });
        added++;
        if (finalResults.length >= maxResults) break;
      }
    }
  }

  return finalResults.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

export async function generalSearch(query: string, maxResults = 2000): Promise<SearchResult[]> {
  return searchOnline(query, maxResults);
}

export async function searchByChar(char: string, maxResults = 20): Promise<SearchResult[]> {
  return searchOnline(char, maxResults);
}

export async function getPoemByKeyExport(key: string): Promise<SearchResult | null> {
  const cached = getPoemByKeyFast(key);
  if (cached) {
    return {
      poem: { _id: key, name: cached.t, author: cached.a, dynasty: cached.d || "", content: cached.content || [], note: "", matchedLine: cached.content?.[0] || "", matchedLineIndex: 0 },
      score: 100,
    };
  }
  try {
    const { data, error } = await supabase.from("poems").select("*").eq("key", key).maybeSingle();
    if (error || !data) return null;
    return {
      poem: { _id: data.id, name: data.title, author: data.author, dynasty: data.dynasty || "", content: data.lines || [], note: "", matchedLine: data.lines?.[0] || "", matchedLineIndex: 0 },
      score: 100,
    };
  } catch {
    return null;
  }
}

export function isLoaded(): boolean { return true; }
export async function ensureLoaded(): Promise<void> { return Promise.resolve(); }
export async function getAllPoems(): Promise<any[]> { return Promise.resolve([]); }
export const localSearch = searchOnline;
