import { supabase } from "./supabaseClient";

export interface SearchResult {
  id: string;
  key?: string;
  title: string;
  author: string;
  dynasty: string;
  lines: string[];
  matchedLine?: string;
}

function stripPunct(str: string): string {
  return str.replace(/[.,?!;:()'"\[\]{}<>《》【】“”‘’、，。？！；：]/g, "");
}

// 1. Unified search function (Uses local Vercel API for fuzzy search, then resolves DB IDs)
export async function searchOnline(query: string, maxResults = 5): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  
  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q })
    });
    const { results } = await res.json();
    
    if (!results || results.length === 0) return [];

    const orQuery = results.map((r: any) => `and(title.eq."${r.title}",author.eq."${r.author}")`).join(',');
    
    const { data: dbPoems, error } = await supabase
      .from('poems')
      .select('id, title, author, dynasty, lines')
      .or(orQuery);

    if (error || !dbPoems) {
       console.error("Failed to resolve DB IDs", error);
       return results.map((r: any) => ({ ...r, id: `fallback-${r.title}` }));
    }

    const finalResults = results.map((r: any) => {
       const dbMatch = dbPoems.find(dbp => dbp.title === r.title && dbp.author === r.author);
       return {
           id: dbMatch ? dbMatch.id : `fallback-${r.title}`,
           title: r.title,
           author: r.author,
           dynasty: r.dynasty || r.d,
           lines: dbMatch ? dbMatch.lines : r.lines,
           matchedLine: r.matchedLine
       };
    }).slice(0, maxResults);

    return finalResults;
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
}

// 2. Xunhualing character search
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

    return results.map((r: any) => {
       const dbMatch = dbPoemsArray.find(dbp => dbp.title === r.title && dbp.author === r.author);
       return {
           id: dbMatch ? dbMatch.id : `fallback-${r.title}`,
           title: r.title,
           author: r.author,
           dynasty: r.dynasty || r.d,
           lines: dbMatch ? dbMatch.lines : r.lines,
           matchedLine: r.matchedLine
       };
    }).slice(0, maxResults);
  } catch (e) {
    return [];
  }
}

// 3. Export specific poem
export async function getPoemByKeyExport(key: string): Promise<SearchResult | undefined> {
  try {
    const parts = key.split("-");
    const [title, author] = parts.length >= 2 ? [parts[0], parts[1]] : [key, ""];
    
    let query = supabase.from("poems").select("*").eq("title", title);
    if (author) query = query.eq("author", author);
    
    const { data, error } = await query.limit(1).single();
    if (error || !data) return undefined;

    return {
      id: data.id,
      key: data.key,
      title: data.title,
      author: data.author,
      dynasty: data.dynasty,
      lines: data.lines,
    };
  } catch (e) {
    console.error("Error fetching poem by key:", e);
    return undefined;
  }
}
