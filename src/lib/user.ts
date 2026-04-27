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
    return JSON.parse(raw) as UserStore;
  } catch {
    return defaultStore();
  }
}

export function saveStore(store: UserStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    console.error("Failed to save store to localStorage");
  }
}

export function getPoemProgress(store: UserStore, poemId: string): PoemProgress {
  return store.poems[poemId] ?? createInitialProgress(poemId);
}

export function setPoemProgress(
  store: UserStore,
  progress: PoemProgress
): void {
  store.poems[progress.poemId] = progress;
  saveStore(store);
}

export function upsertPoemProgress(
  store: UserStore,
  poemId: string,
  updater: (p: PoemProgress) => PoemProgress
): void {
  const current = getPoemProgress(store, poemId);
  const next = updater(current);
  setPoemProgress(store, next);
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
  const poems = getRankList();
  for (const poem of poems) {
    const id = `${poem.t}:${poem.a}`;
    if (!store.poems[id]) {
      store.poems[id] = createInitialProgress(id);
    }
  }
  store.initialized = true;
  saveStore(store);
}

/** 今日每日推荐（推进 rank） */
export function advanceDailyRank(store: UserStore): number {
  const today = new Date().toISOString().split("T")[0];
  if (store.lastDailyDate === today) {
    return store.currentRank; // 今天已经推送过了
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
    const id = `${poem.t}:${poem.a}`;
    const p = store.poems[id] ?? createInitialProgress(id);
    if (p.level >= 3) level3plus++;
    if (p.level === 5) level5++;
    if (p.nextReview <= today) dueToday++;
  }
  return { total: poems.length, level3plus, level5, dueToday };
}
