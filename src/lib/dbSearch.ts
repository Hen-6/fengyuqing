import { supabase } from "./supabaseClient";

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

function linesContain(lines: string[], query: string): boolean {
  const norm = stripPunct(query);
  if (norm.length < 4) return true;
  const joined = lines.map((line) => stripPunct(line)).join("");
  return joined.includes(norm);
}

export async function searchOnline(
  query: string,
  maxResults = 8
): Promise<SearchResult[]> {
  const cleanQuery = stripPunct(query);
  if (!cleanQuery) return [];

  try {
    let dbQuery = query;
    if (cleanQuery.length >= 8) {
      dbQuery = cleanQuery.slice(0, cleanQuery.length >= 14 ? 7 : 5);
    }

    const { data, error } = await supabase.rpc("search_poems", {
      query_text: dbQuery,
      max_results: maxResults,
    });

    if (error) throw error;
    const results = data || [];

    let finalResults = results.map((r: any) => {
      const lines = r.lines || [];
      const normQuery = stripPunct(query);
      let matchedLineIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (stripPunct(lines[i]).includes(normQuery)) {
          matchedLineIndex = i;
          break;
        }
      }
      const matchedLine = lines[matchedLineIndex] || lines[0] || "";

      return {
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
        score: 100,
      };
    });

    if (cleanQuery.length >= 4) {
      finalResults = finalResults.filter((r: any) =>
        linesContain(r.poem.content, query)
      );
    }
    return finalResults;
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
