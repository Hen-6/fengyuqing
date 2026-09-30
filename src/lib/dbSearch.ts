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

  try {
    let results: any[] = [];
    let usedFuzzy = false;

    // 1. Try fuzzy search RPC first (requires running supabase-fuzzy-search.sql)
    const { data: fuzzyData, error: fuzzyError } = await supabase.rpc("search_poems_fuzzy", {
      query_text: stripPunct(cleanQuery),
      max_results: Math.max(maxResults * 2, 80),
    });

    if (!fuzzyError && fuzzyData) {
      results = fuzzyData;
      usedFuzzy = true;
    } else {
      // 2. Fallback to old strict search logic
      if (tokens.length >= 2) {
        const t1 = tokens[0];
        const t2 = tokens[1];
        const { data, error } = await supabase
          .from("poems")
          .select("id, title, author, dynasty, lines")
          .or(`and(title.ilike.%${t1}%,author.ilike.%${t2}%),and(title.ilike.%${t2}%,author.ilike.%${t1}%)`)
          .limit(maxResults * 2);
        if (!error && data) results = data;
      }

      if (results.length === 0) {
        const primaryToken = tokens[0];
        let dbQuery = primaryToken;
        if (primaryToken.length >= 8) {
          dbQuery = primaryToken.slice(0, primaryToken.length >= 14 ? 7 : 5);
        }
        const { data, error } = await supabase.rpc("search_poems", {
          query_text: dbQuery,
          max_results: Math.max(maxResults * 2, 80),
        });
        if (!error && data) results = data;
      }
    }

    const finalResults: SearchResult[] = [];

    for (const r of results) {
      let matchesAll = true;
      let totalScore = 0;
      const lines = r.lines || [];
      let matchedLine = lines[0] || "";
      let matchedLineIndex = 0;

      const normTitle = r.title ? stripPunct(r.title) : "";
      const normAuthor = r.author ? stripPunct(r.author) : "";
      const normDynasty = r.dynasty ? stripPunct(r.dynasty) : "";
      const joinedLines = lines.map((line: string) => stripPunct(line)).join("");

      for (const token of tokens) {
        let tokenMatched = false;
        let tokenScore = 0;

        if (normTitle === token) { tokenScore += 150; tokenMatched = true; }
        else if (normTitle.includes(token)) { tokenScore += 80; tokenMatched = true; }
        else if (levenshtein(normTitle, token) <= 1 && token.length > 2) { tokenScore += 50; tokenMatched = true; }

        if (normAuthor === token) { tokenScore += 100; tokenMatched = true; }
        else if (normAuthor.includes(token)) { tokenScore += 50; tokenMatched = true; }
        else if (levenshtein(normAuthor, token) <= 1 && token.length > 1) { tokenScore += 30; tokenMatched = true; }

        if (normDynasty === token) { tokenScore += 30; tokenMatched = true; }

        if (!tokenMatched) {
          if (joinedLines.includes(token)) {
            tokenScore += 40;
            tokenMatched = true;
            for (let i = 0; i < lines.length; i++) {
              if (stripPunct(lines[i]).includes(token)) {
                matchedLine = lines[i];
                matchedLineIndex = i;
                break;
              }
            }
          } else {
            // Fuzzy line match fallback
            for (let i = 0; i < lines.length; i++) {
              const normLine = stripPunct(lines[i]);
              const dist = levenshtein(normLine, token);
              // Allow 1 typo per 4 chars roughly
              const allowedTypos = Math.max(1, Math.floor(token.length / 4));
              
              if (dist <= allowedTypos) {
                tokenScore += Math.max(10, 40 - (dist * 10));
                tokenMatched = true;
                matchedLine = lines[i];
                matchedLineIndex = i;
                break;
              }
            }
          }
        }

        // If we used fuzzy DB search, we are more lenient and don't strictly require matchesAll
        // as the DB already deemed it similar. But we still prefer matches.
        if (!tokenMatched && !usedFuzzy) {
          matchesAll = false;
          break;
        } else if (!tokenMatched && usedFuzzy) {
          // It's technically okay because the DB found it fuzzy similar, but give it 0 score for this token.
        }
        
        totalScore += tokenScore;
      }

      if (matchesAll || usedFuzzy) {
        // Boost score slightly if it was returned by fuzzy DB search
        if (usedFuzzy && totalScore === 0) {
          totalScore = 5; // minimal score for db match
        }
        
        if (totalScore > 0) {
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
    }

    return finalResults.sort((a, b) => b.score - a.score).slice(0, maxResults);
  } catch (err) {
    console.error("Supabase search failed, returning empty:", err);
    return [];
  }
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
