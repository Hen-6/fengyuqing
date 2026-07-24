/**
 * localSearch.ts — Local database search agent (Supabase wrapper).
 */
export {
  isLoaded,
  ensureLoaded,
  searchOnline,
  generalSearch,
  searchByChar,
  getPoemByKeyExport,
  getAllPoems,
  localSearch,
} from "./dbSearch";

export type {
  SearchResult,
  PoemResult,
  OnlinePoemResult,
} from "./dbSearch";

export interface IndexedPoem {
  k: string;   // key = "title:author"
  r: number;   // rank
  t: string;   // title
  a: string;   // author
  d: string;   // dynasty
  id: string;  // same as k
  c: string[]; // content lines
  n: string;   // note
}
