/**
 * user.ts — localStorage 用户进度管理
 */

import { PoemProgress, createInitialProgress, updateProgress, upgradeToLevel } from "./srs";
import { getRankList } from "./poems";

const STORE_KEY = "fengyuqing_v1";

export interface UserStore {
  version: number;
  initialized: boolean;
  assessmentDone: boolean;
  currentRank: number;       // 每日推送当前位置
  lastDailyDate: string;     // 上次每日推送日期
  poems: Record<string, PoemProgress>;
}

function defaultStore(): UserStore {
  return {
    version: 1,
    initialized: false,
    assessmentDone: false,
    currentRank: 0,
    lastDailyDate: "",
    poems: {},
  };
}

export function loadStore(): UserStore {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultStore();
    const store = JSON.parse(raw) as UserStore;
    // 迁移旧数据：ObjectId key → title:author key
    migrateStore(store);
    return store;
  } catch {
    return defaultStore();
  }
}

/** 将旧版 ObjectId key 迁移到新的 title:author key */
function migrateStore(store: UserStore): boolean {
  // ObjectId 格式：24位十六进制字符（MongoDB）
  const OBJECTID_RE = /^[0-9a-f]{24}$/i;
  const poems = store.poems;
  const toDelete: string[] = [];
  let migrated = false;

  for (const key of Object.keys(poems)) {
    if (OBJECTID_RE.test(key)) {
      toDelete.push(key);
    }
  }

  if (toDelete.length === 0) return false;

  for (const key of toDelete) {
    const prog = poems[key];
    if (prog?.poemId && !OBJECTID_RE.test(prog.poemId)) {
      const newKey = prog.poemId;
      if (!poems[newKey]) {
        poems[newKey] = { ...prog, poemId: newKey };
        migrated = true;
      }
    }
    delete poems[key];
  }

  if (migrated) {
    // 强制触发 saveStore 中的 JSON 序列化更新 localStorage
    saveStore(store);
  }
  return migrated;
}

export function saveStore(store: UserStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    console.error("Failed to save store to localStorage");
  }
}

// ─── ID normalization ───────────────────────────────────────────────────────
// Both yxcs (name:author) and rank.json (title:author) use the same format,
// but whitespace/trailing-space differences can occur. Normalize by trimming.
function normId(title: string, author: string): string {
  return `${title.trim()}:${author.trim()}`;
}

/** Reverse-lookup map: any yxcs-style variant → canonical rank.json ID.
 *  Built once from rank.json, cached for the session. */
let aliasMap: Map<string, string> | null = null;

function getAliasMap(): Map<string, string> {
  if (aliasMap) return aliasMap;
  aliasMap = new Map();
  for (const poem of getRankList()) {
    const canonical = normId(poem.t, poem.a);
    aliasMap.set(canonical, canonical);
  }
  return aliasMap;
}

/** Find the key under which a poem's progress is stored.
 *  1. Try the raw ID as-is.
 *  2. Normalize (trim) and try again.
 *  3. Look up via alias map (yxcs "name:author" ↔ rank "title:author").
 *  Returns the existing key if found, otherwise the trimmed canonical form. */
function findPoemKey(store: UserStore, rawId: string): string {
  const trimmed = rawId.trim();
  if (store.poems[trimmed]) return trimmed;
  if (store.poems[rawId]) return rawId;
  const aliases = getAliasMap();
  const canonical = aliases.get(trimmed);
  if (canonical && canonical !== trimmed && store.poems[canonical]) return canonical;
  return trimmed;
}

// ─── Progress accessors ─────────────────────────────────────────────────────

export function getPoemProgress(store: UserStore, poemId: string): PoemProgress {
  const key = findPoemKey(store, poemId);
  return store.poems[key] ?? createInitialProgress(key);
}

export function setPoemProgress(store: UserStore, progress: PoemProgress): void {
  const key = findPoemKey(store, progress.poemId);
  progress.poemId = key;
  store.poems[key] = progress;
  saveStore(store);
}

export function upsertPoemProgress(
  store: UserStore,
  poemId: string,
  updater: (p: PoemProgress) => PoemProgress
): void {
  // Always normalize the key to avoid " 静夜思:李白" vs "静夜思:李白" mismatches
  const existingKey = findPoemKey(store, poemId.trim());
  const current = store.poems[existingKey] ?? createInitialProgress(existingKey);
  const next = updater({ ...current, poemId: existingKey });
  store.poems[existingKey] = next;
  saveStore(store);
}

/** 游戏回答正确 → 升级到 level 3 */
export function markPoemAnswered(store: UserStore, poemId: string): void {
  upsertPoemProgress(store, poemId, (p) => upgradeToLevel(p, 3));
}

/** 游戏回答正确 → 触发 SRS 更新 */
export function recordResult(
  store: UserStore,
  poemId: string,
  result: "correct" | "wrong"
): void {
  upsertPoemProgress(store, poemId, (p) => updateProgress(p, result));
}

/** 手动设置等级（自测） */
export function setLevel(store: UserStore, poemId: string, level: number): void {
  upsertPoemProgress(store, poemId, (p) => ({
    ...p,
    level: Math.max(1, Math.min(5, level)),
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
  }));
}

/** 初始化所有诗为 level 1（引导结束后调用） */
export function initializeAllPoems(store: UserStore): void {
  // 保护现有进度：已有记录的诗不覆盖
  let added = 0;
  for (const poem of getRankList()) {
    const id = normId(poem.t, poem.a);
    if (!store.poems[id]) {
      store.poems[id] = createInitialProgress(id);
      added++;
    }
  }
  store.initialized = true;
  saveStore(store);
}

/** 今日每日推荐（推进 rank） */
export function advanceDailyRank(store: UserStore): number {
  const today = new Date().toISOString().split("T")[0];
  if (store.lastDailyDate === today) {
    return store.currentRank;
  }
  const poems = getRankList();
  store.currentRank = (store.currentRank % poems.length) + 1;
  store.lastDailyDate = today;
  saveStore(store);
  return store.currentRank;
}

/** 导出进度 JSON */
export function exportProgress(store: UserStore): string {
  return JSON.stringify(store, null, 2);
}

/** 导入进度 JSON */
export function importProgress(json: string): boolean {
  try {
    const data = JSON.parse(json) as UserStore;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    }
    return true;
  } catch {
    return false;
  }
}

/** 统计概览 */
export function getOverview(store: UserStore): {
  total: number;
  level3plus: number;
  level5: number;
  dueToday: number;
} {
  const poems = getRankList();
  const today = new Date().toISOString().split("T")[0];
  let level3plus = 0, level5 = 0, dueToday = 0;
  for (const poem of poems) {
    const id = normId(poem.t, poem.a);
    const p = store.poems[id] ?? createInitialProgress(id);
    if (p.level >= 3) level3plus++;
    if (p.level === 5) level5++;
    if (p.nextReview <= today) dueToday++;
  }
  return { total: poems.length, level3plus, level5, dueToday };
}
