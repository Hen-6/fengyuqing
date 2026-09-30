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
    // 1. Ultra-fast index search on Title/Author
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
    
    // 2. If we need more (like for 飞花令), search the bodies using a streaming sequential scan
    if (finalResults.length < maxResults) {
      const { data: bodyData, error: bodyError } = await supabase.rpc("search_poems_body", {
        query_text: stripPunct(cleanQuery),
        max_results: maxResults - finalResults.length,
      });

      if (!bodyError && bodyData && bodyData.length > 0) {
        for (const r of bodyData) {
          if (finalResults.some(res => res.poem._id === r.id)) continue;
          
          let matchedLine = r.lines?.[0] || "";
          let matchedLineIndex = 0;
          for (let i = 0; i < (r.lines || []).length; i++) {
            if (r.lines[i].includes(stripPunct(cleanQuery))) {
              matchedLine = r.lines[i];
              matchedLineIndex = i;
              break;
            }
          }
          
          finalResults.push({
            poem: {
              _id: r.id,
              name: r.title,
              author: r.author,
              dynasty: r.dynasty || "",
              content: r.lines || [],
              note: "",
              matchedLine,
              matchedLineIndex,
            },
            score: 50,
          });
        }
      }
    }
  } catch (err) {
    console.error("Supabase search failed:", err);
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
