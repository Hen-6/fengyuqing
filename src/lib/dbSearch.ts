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
  maxResults = 8
): Promise<SearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // Split by whitespace
  const tokens = cleanQuery.split(/\s+/).map(t => stripPunct(t)).filter(Boolean);
  if (tokens.length === 0) return [];

  try {
    let results: any[] = [];

    // 1. If multiple tokens, try title-author combination query first
    if (tokens.length >= 2) {
      const t1 = tokens[0];
      const t2 = tokens[1];

      const { data, error } = await supabase
        .from("poems")
        .select("id, title, author, dynasty, lines")
        .or(`and(title.ilike.%${t1}%,author.ilike.%${t2}%),and(title.ilike.%${t2}%,author.ilike.%${t1}%)`)
        .limit(maxResults * 2);

      if (!error && data) {
        results = data;
      }
    }

    // 2. Fallback to RPC function search_poems
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

      if (!error && data) {
        results = data;
      }
    }

    // Filter and score the candidates client-side (max ~80 items, extremely fast!)
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

        // Check title
        if (normTitle === token) {
          tokenScore += 150;
          tokenMatched = true;
        } else if (normTitle.includes(token)) {
          tokenScore += 80;
          tokenMatched = true;
        }

        // Check author
        if (normAuthor === token) {
          tokenScore += 100;
          tokenMatched = true;
        } else if (normAuthor.includes(token)) {
          tokenScore += 50;
          tokenMatched = true;
        }

        // Check dynasty
        if (normDynasty === token) {
          tokenScore += 30;
          tokenMatched = true;
        }

        // Check lines (joined)
        if (!tokenMatched) {
          if (joinedLines.includes(token)) {
            tokenScore += 40;
            tokenMatched = true;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const normLine = stripPunct(line);
              if (normLine.includes(token) || token.includes(normLine)) {
                matchedLine = line;
                matchedLineIndex = i;
                break;
              }
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
  const cached = getPoemByKeyFast(key);
  if (cached) {
    return {
      poem: {
        _id: key,
        name: cached.t,
        author: cached.a,
        dynasty: cached.d || "",
        content: cached.content || [],
        note: "",
        matchedLine: cached.content?.[0] || "",
        matchedLineIndex: 0,
      },
      score: 100,
    };
  }

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
