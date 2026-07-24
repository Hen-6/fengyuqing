import { supabase } from "./supabaseClient";
import { searchLocalCached, isCacheLoaded, cleanToken, matchLocalToken } from "../data/allPoemsLookup";

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
  maxResults = 8
): Promise<SearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // If local cache is loaded, delegate to high-performance local fuzzy search
  if (isCacheLoaded()) {
    return searchLocalCached(query, maxResults);
  }

  // Split by whitespace
  const tokens = cleanQuery.split(/\s+/).map(t => cleanToken(t)).filter(Boolean);
  if (tokens.length === 0) return [];

  // Sort tokens by length descending (longest/most specific token first)
  const sortedTokens = [...tokens].sort((a, b) => b.length - a.length);
  const primaryToken = sortedTokens[0];

  try {
    let dbQuery = primaryToken;
    // For very long queries, query a shorter prefix first to handle line wrapping/mismatches
    if (primaryToken.length >= 8) {
      dbQuery = primaryToken.slice(0, primaryToken.length >= 14 ? 7 : 5);
    }

    let { data, error } = await supabase.rpc("search_poems", {
      query_text: dbQuery,
      max_results: Math.max(maxResults * 2, 80),
    });

    if (error) throw error;
    let results = data || [];

    // Fallback: If no results and the primary token is long, try searching with its suffix part
    if (results.length === 0 && primaryToken.length >= 6) {
      const suffixQuery = primaryToken.slice(-5);
      const fallbackReq = await supabase.rpc("search_poems", {
        query_text: suffixQuery,
        max_results: Math.max(maxResults * 2, 80),
      });
      if (!fallbackReq.error && fallbackReq.data && fallbackReq.data.length > 0) {
        results = fallbackReq.data;
      }
    }

    // Filter and score the candidates client-side using all query tokens
    const finalResults: SearchResult[] = [];

    for (const r of results) {
      let matchesAll = true;
      let totalScore = 0;
      const lines = r.lines || [];
      let matchedLine = lines[0] || "";
      let matchedLineIndex = 0;

      const normTitle = cleanToken(r.title);
      const normAuthor = cleanToken(r.author);
      const normDynasty = cleanToken(r.dynasty || "");

      for (const token of tokens) {
        let tokenMatched = false;
        let tokenScore = 0;

        // 1. Check title
        if (normTitle === token) {
          tokenScore += 150;
          tokenMatched = true;
        } else if (matchLocalToken(normTitle, token)) {
          tokenScore += 80;
          tokenMatched = true;
        }

        // 2. Check author
        if (normAuthor === token) {
          tokenScore += 100;
          tokenMatched = true;
        } else if (matchLocalToken(normAuthor, token)) {
          tokenScore += 50;
          tokenMatched = true;
        }

        // 3. Check dynasty
        if (normDynasty === token) {
          tokenScore += 30;
          tokenMatched = true;
        }

        // 4. Check lines
        if (!tokenMatched) {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const normLine = cleanToken(line);
            if (normLine.includes(token)) {
              tokenScore += 40;
              tokenMatched = true;
              matchedLine = line;
              matchedLineIndex = i;
              break;
            } else if (matchLocalToken(normLine, token)) {
              tokenScore += 20;
              tokenMatched = true;
              matchedLine = line;
              matchedLineIndex = i;
              break;
            }
          }
        }

        if (!tokenMatched) {
          matchesAll = false;
          break;
        }
        totalScore += tokenScore;
      }

      if (matchesAll) {
        finalResults.push({
          poem: {
            _id: r.id,
            name: r.title,
            author: r.author,
            dynasty: r.dynasty || "",
            content: lines,
            note: "",
            matchedLine,
            matchedLineIndex,
          },
          score: totalScore,
        });
      }
    }

    // Sort by score descending and return
    return finalResults.sort((a, b) => b.score - a.score).slice(0, maxResults);
  } catch (err) {
    console.error("Supabase search failed, returning empty:", err);
    return [];
  }
}

export async function generalSearch(
  query: string,
  maxResults = 2000
): Promise<SearchResult[]> {
  return searchOnline(query, maxResults);
}

export async function searchByChar(
  char: string,
  maxResults = 20
): Promise<SearchResult[]> {
  return searchOnline(char, maxResults);
}

export async function getPoemByKeyExport(key: string): Promise<SearchResult | null> {
  try {
    const { data, error } = await supabase
      .from("poems")
      .select("*")
      .eq("key", key)
      .maybeSingle();

    if (error || !data) return null;
    return {
      poem: {
        _id: data.id,
        name: data.title,
        author: data.author,
        dynasty: data.dynasty || "",
        content: data.lines || [],
        note: "",
        matchedLine: data.lines?.[0] || "",
        matchedLineIndex: 0,
      },
      score: 100,
    };
  } catch {
    return null;
  }
}

export function isLoaded(): boolean {
  return true;
}

export async function ensureLoaded(): Promise<void> {
  return Promise.resolve();
}

export async function getAllPoems(): Promise<any[]> {
  return Promise.resolve([]);
}

export const localSearch = searchOnline;
