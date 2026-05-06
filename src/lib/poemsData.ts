/**
 * poemsData.ts — 静态导入诗词数据（webpack build 时打包进 chunk）
 *
 * poems.index.json → charIndex: Map<char, poemsArray-indexes>
 * poems.json       → poemsArray: IndexedPoem[]（附 k 字段）
 *
 * webpack 会将这两个 JSON 作为独立 chunk 输出，
 * 不阻塞主 bundle，首次访问后永久缓存。
 */

import charIndexRaw from "../../public/data/poems.index.json";
import poemsRaw from "../../public/data/poems.json";
import type { IndexedPoem } from "./localSearch";

// ─── Char → poemIdx[] 倒排索引 ─────────────────────────────────────────────

export const charIndex: Map<string, number[]> = new Map(
  Object.entries(charIndexRaw as Record<string, number[]>)
);

// ─── 诗歌列表 + key 字段 ───────────────────────────────────────────────────

export const poemsArray: IndexedPoem[] = (poemsRaw as IndexedPoem[]).map(
  (p) => ({ ...p, k: `${p.t}:${p.a}` })
);

// ─── key → index 映射 ────────────────────────────────────────────────────

export const poemsMapData: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < poemsArray.length; i++) {
    map[poemsArray[i].k!] = i;
  }
  return map;
})();
