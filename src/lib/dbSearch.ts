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
  maxResults = 20
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q })
    });
    
    // Fallback gracefully if API is down
    if (!res.ok) return [];
    
    const { results } = await res.json();
    
    if (!results || results.length === 0) return [];

    // Map titles to DB IDs efficiently using OR
    const orQuery = results.map((r: any) => `and(title.eq."${r.title}",author.eq."${r.author}")`).join(',');
    
    const { data: dbPoems } = await supabase
      .from('poems')
      .select('id, title, author, dynasty, lines')
      .or(orQuery);

    const dbPoemsArray = dbPoems || [];

    return results.map((r: any, idx: number) => {
       const dbMatch = dbPoemsArray.find(dbp => dbp.title === r.title && dbp.author === r.author);
       const lines = dbMatch ? dbMatch.lines : r.lines;
       let matchedLineIndex = 0;
       
       if (r.matchedLine) {
           matchedLineIndex = lines.findIndex((l: string) => l === r.matchedLine) || 0;
           if (matchedLineIndex === -1) matchedLineIndex = 0;
       }

       return {
           poem: {
               _id: dbMatch ? dbMatch.id : `fallback-${r.title}`,
               name: r.title,
               author: r.author,
               dynasty: r.dynasty || r.d,
               content: lines,
               note: "",
               matchedLine: r.matchedLine || lines[0] || "",
               matchedLineIndex
           },
           score: 100 - idx // Keep sort order
       };
    }).slice(0, maxResults);
  } catch (error) {
    console.error("Search API error:", error);
    return [];
  }
}

export async function generalSearch(query: string, maxResults = 2000): Promise<SearchResult[]> {
  return searchOnline(query, maxResults);
}

export async function searchByChar(char: string, maxResults = 20): Promise<SearchResult[]> {
  const cleanQuery = stripPunct(char.trim());
  if (!cleanQuery) return [];

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: cleanQuery, mode: 'char' })
    });
    const { results } = await res.json();

    if (!results || results.length === 0) return [];

    const orQuery = results.map((r: any) => `and(title.eq."${r.title}",author.eq."${r.author}")`).join(',');
    const { data: dbPoems } = await supabase
      .from('poems')
      .select('id, title, author, dynasty, lines')
      .or(orQuery);

    const dbPoemsArray = dbPoems || [];

    return results.map((r: any, idx: number) => {
       const dbMatch = dbPoemsArray.find(dbp => dbp.title === r.title && dbp.author === r.author);
       const lines = dbMatch ? dbMatch.lines : r.lines;
       let matchedLineIndex = 0;
       
       if (r.matchedLine) {
           matchedLineIndex = lines.findIndex((l: string) => l === r.matchedLine) || 0;
           if (matchedLineIndex === -1) matchedLineIndex = 0;
       }

       return {
           poem: {
               _id: dbMatch ? dbMatch.id : `fallback-${r.title}`,
               name: r.title,
               author: r.author,
               dynasty: r.dynasty || r.d,
               content: lines,
               note: "",
               matchedLine: r.matchedLine || lines[0] || "",
               matchedLineIndex
           },
           score: 100
       };
    }).slice(0, maxResults);
  } catch (e) {
    return [];
  }
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
    const title = key.split(':')[0];
    const author = key.split(':')[1];
    
    const { data, error } = await supabase.from("poems").select("*")
      .eq("title", title)
      .eq("author", author)
      .limit(1)
      .maybeSingle();

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
