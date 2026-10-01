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
  maxResults = 20
): Promise<SearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const tokens = cleanQuery.split(/\s+/).map(t => stripPunct(t)).filter(Boolean);
  if (tokens.length === 0) return [];
  const q = tokens.join("");

  let finalResults: SearchResult[] = [];
  const addedIds = new Set<string>();

  const addResult = (r: any, score: number, forceExactMatch = false) => {
    if (addedIds.has(r.id)) return;
    addedIds.add(r.id);
    
    let matchedLine = r.lines?.[0] || "";
    let matchedLineIndex = 0;

    // Find the best matching line
    let foundExact = false;
    for (let i = 0; i < (r.lines || []).length; i++) {
      if (r.lines[i].includes(q) || stripPunct(r.lines[i]).includes(q)) {
        matchedLine = r.lines[i];
        matchedLineIndex = i;
        foundExact = true;
        break;
      }
    }

    // If not exact and we need to find the roughly matched sentence
    if (!foundExact && !forceExactMatch && r.lines) {
      let bestScore = Infinity;
      for (let i = 0; i < r.lines.length; i++) {
        const lineClean = stripPunct(r.lines[i]);
        // Simple heuristic: if line shares characters with query, score it
        let sharedChars = 0;
        for (const char of q) {
          if (lineClean.includes(char)) sharedChars++;
        }
        // Penalize by length difference
        const dist = Math.abs(lineClean.length - q.length) - (sharedChars * 2);
        if (dist < bestScore) {
          bestScore = dist;
          matchedLine = r.lines[i];
          matchedLineIndex = i;
        }
      }
    }

    finalResults.push({
      poem: {
        _id: r.id, name: r.title, author: r.author, dynasty: r.dynasty || "",
        content: r.lines || [], note: "", matchedLine, matchedLineIndex,
      },
      score,
    });
  };

  try {
    const [bodyRes, fuzzyRes] = await Promise.all([
      supabase.rpc("search_poems_body", { query_text: q, max_results: maxResults }),
      supabase.rpc("search_poems_fuzzy", { query_text: q, max_results: maxResults })
    ]);

    const bodyData = bodyRes.data || [];
    const fuzzyData = fuzzyRes.data || [];

    // 1. EXACT TITLE/AUTHOR MATCH (Score 100)
    for (const r of fuzzyData) {
      if (r.title === cleanQuery || r.author === cleanQuery || r.title.includes(q) || r.author.includes(q)) {
        addResult(r, 100, true);
      }
    }

    // 2. EXACT BODY MATCH (Score 80)
    for (const r of bodyData) {
      addResult(r, 80);
    }

    // 3. ROUGH MATCHES (CLOSE ALTERNATIVES)
    // "Also, when showing rough matches, show only the top 5 matches"
    let roughCount = 0;
    
    // Try wildcard body search if it's a sentence
    if (q.length >= 3) {
      const wildChars = q.split('').filter(c => c.trim().length > 0);
      if (wildChars.length >= 2) {
        const wildQuery = wildChars.join('%');
        const { data: roughBody } = await supabase.rpc("search_poems_body", {
          query_text: wildQuery,
          max_results: 5,
        });
        if (roughBody) {
          for (const r of roughBody) {
            if (!addedIds.has(r.id) && roughCount < 5) {
              addResult(r, 60);
              roughCount++;
            }
          }
        }
      }
    }

    // Finally, add fuzzy title/author matches if we still have room for top 5
    for (const r of fuzzyData) {
      if (!addedIds.has(r.id) && roughCount < 5) {
        addResult(r, 50, true);
        roughCount++;
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
  const cleanQuery = stripPunct(char.trim());
  if (!cleanQuery) return [];

  try {
    const { data, error } = await supabase.rpc("search_poems_body", {
      query_text: cleanQuery,
      max_results: maxResults,
    });

    if (error || !data) return [];

    return data.map((r: any) => {
      let matchedLine = r.lines?.[0] || "";
      let matchedLineIndex = 0;
      for (let i = 0; i < (r.lines || []).length; i++) {
        if (r.lines[i].includes(cleanQuery)) {
          matchedLine = r.lines[i];
          matchedLineIndex = i;
          break;
        }
      }
      return {
        poem: {
          _id: r.id, name: r.title, author: r.author, dynasty: r.dynasty || "",
          content: r.lines || [], note: "", matchedLine, matchedLineIndex,
        },
        score: 100
      };
    });
  } catch (err) {
    console.error("Feihua search failed:", err);
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
    
    // Fallback: search by title and author
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
