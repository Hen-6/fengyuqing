/**
 * srs.ts — 记忆算法 (Duolingo HLR + Leitner Box)
 *
 * 半衰期回归 (Half-Life Regression):
 *   答对 → 半衰期 × 2
 *   答错 → 半衰期 × 0.5
 *
 * Leitner Box 融合:
 *   连续答对 2 次 → 升级（level++）
 *   连续答错 2 次 → 降级（level--）
 */

export type ResultType = "correct" | "wrong";

export interface PoemProgress {
  poemId: string;
  level: number;             // 1-5
  halfLifeDays: number;      // 当前半衰期（天）
  nextReview: string;        // ISO 日期字符串，下次复习时间
  consecutiveCorrect: number;
  consecutiveWrong: number;
  lastResult: ResultType | null;
  lastReviewed: string;      // ISO 日期
}

export const INITIAL_HALF_LIFE = 1; // 天
export const MIN_HALF_LIFE = 0.25; // 最小半衰期（6小时）

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + Math.round(days));
  return d;
}

export function createInitialProgress(poemId: string): PoemProgress {
  const now = new Date().toISOString().split("T")[0];
  return {
    poemId,
    level: 1,
    halfLifeDays: INITIAL_HALF_LIFE,
    nextReview: now,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    lastResult: null,
    lastReviewed: now,
  };
}

export function updateProgress(
  p: PoemProgress,
  result: ResultType
): PoemProgress {
  const next = { ...p };

  if (result === "correct") {
    next.halfLifeDays = Math.min(next.halfLifeDays * 2, 365);
    next.consecutiveCorrect += 1;
    next.consecutiveWrong = 0;
    // Leitner: 连续对2次升一级
    if (next.consecutiveCorrect >= 2 && next.level < 5) {
      next.level += 1;
      next.consecutiveCorrect = 0;
    }
  } else {
    next.halfLifeDays = Math.max(next.halfLifeDays * 0.5, MIN_HALF_LIFE);
    next.consecutiveWrong += 1;
    next.consecutiveCorrect = 0;
    // Leitner: 连续错2次降一级
    if (next.consecutiveWrong >= 2 && next.level > 1) {
      next.level -= 1;
      next.consecutiveWrong = 0;
    }
  }

  const now = new Date();
  next.nextReview = addDays(now, next.halfLifeDays).toISOString().split("T")[0];
  next.lastResult = result;
  next.lastReviewed = now.toISOString().split("T")[0];

  return next;
}

/** 提升到指定等级（用于游戏回答后自动升级） */
export function upgradeToLevel(progress: PoemProgress, minLevel: number): PoemProgress {
  return { ...progress, level: Math.max(progress.level, minLevel) };
}

/** 获取今天应该复习的诗 */
export function getDuePoems(
  progressMap: Record<string, PoemProgress>
): string[] {
  const today = new Date().toISOString().split("T")[0];
  return Object.values(progressMap)
    .filter((p) => p.nextReview <= today)
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview))
    .map((p) => p.poemId);
}

/** 等级说明文字 */
export const LEVEL_LABELS: Record<number, { name: string; desc: string }> = {
  1: { name: "陌生", desc: "完全不认识" },
  2: { name: "认字", desc: "见过诗题或作者，但无法背诵" },
  3: { name: "识句", desc: "能找出一句以上的诗句" },
  4: { name: "成篇", desc: "能背诵整首" },
  5: { name: "全知", desc: "知道作者/背景/典故" },
};
