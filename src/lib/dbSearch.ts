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

export async function searchOnline(
  query: string,
  maxResults = 20,
  mode: 'general' | 'line' | 'char' = 'general'
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, mode, limit: maxResults })
    });
    
    if (!res.ok) return [];
    
    const { results } = await res.json();
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
               note: "",
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

export async function searchByChar(char: string, maxResults = 20): Promise<SearchResult[]> {
  const cleanQuery = stripPunct(char.trim());
  if (!cleanQuery) return [];
  return searchOnline(cleanQuery, maxResults, 'char');
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
    const res = await fetch(`/api/poem?key=${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.poem) return null;

    const p = data.poem;
    return {
      poem: { _id: p.id || key, name: p.t, author: p.a, dynasty: p.d || "", content: p.content || [], note: "", matchedLine: p.content?.[0] || "", matchedLineIndex: 0 },
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
