/**
 * localSearch.ts — Meilisearch 本地搜索代理。
 *
 * 保留原有签名不变，底层委托给 meilisearch.ts。
 * Meilisearch 实例由 scripts/start_meilisearch.sh 启动。
 */
export {
  isLoaded,
  ensureLoaded,
  searchOnline,
  searchByChar,
  getPoemByKeyExport,
  searchInLibrary,
  setInLibrary,
  getAllPoems,
  localSearch,
} from './meilisearch'

export type {
  IndexedPoem,
  SearchResult,
  PoemResult,
  OnlinePoemResult,
} from './meilisearch'
