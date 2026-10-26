"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/userContext";
import { getDailyRecommendation, type PoemResult } from "@/lib/dbSearch";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";

export default function DailyPage() {
  const { store, setLevel, getPoemProgress } = useUser();
  const [rank, setRank] = useState(0);
  const [poem, setPoem] = useState<PoemResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setLoading(true);
    // 过滤掉已学习过的诗词（熟练度 >= 1）
    const excludedKeys = Object.keys(store.poems).filter(
      (k) => (store.poems[k]?.level ?? 0) >= 1
    );

    getDailyRecommendation(excludedKeys, offset).then((res) => {
      if (res.poem) {
        setPoem(res.poem);
        setRank(res.rank);
      }
      setLoading(false);
    });
  }, [store.poems, offset]);

  const poemKey = poem ? `${poem.name.trim()}:${poem.author.trim()}` : "";
  const currentProg = poemKey ? getPoemProgress(poemKey) : undefined;
  const currentLevel = currentProg?.level ?? 0;

  return (
    <div className="min-h-screen paper-texture px-6 pb-8 safe-pt">
      <div className="mx-auto max-w-md space-y-6">
        <header className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full text-2xl text-text-muted hover:text-accent hover:bg-black/5 active:bg-black/10 transition"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold text-ink">每日推荐</h1>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center">
            <p className="text-text-muted animate-pulse">正在精选千古名篇…</p>
          </div>
        ) : poem ? (
          <>
            <div className="rounded-2xl border border-border bg-surface p-5 text-center shadow-sm">
              <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-2">
                千古名篇热度榜 · 第 {rank} 首
              </span>
              <h2 className="text-2xl font-bold text-ink">《{poem.name}》</h2>
              <p className="mt-1 text-sm text-text-muted">{poem.author} · {poem.dynasty || "未知"}</p>
              {poem.tags && poem.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {poem.tags.slice(0, 5).map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[11px] bg-paper text-text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <OnlinePoemCard result={poem as any} highlightMatch={false} />

            {/* 熟练度设置 */}
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <p className="text-xs text-text-muted mb-2">
                {currentLevel > 0 ? `当前掌握度：Lv.${currentLevel}` : "尚未加入学习库"}
              </p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => {
                      if (poemKey) setLevel(poemKey, lvl);
                    }}
                    className={`h-9 w-9 rounded-full font-bold text-sm transition-all ${
                      currentLevel >= lvl
                        ? "bg-accent text-white shadow-sm scale-105"
                        : "bg-paper text-text-muted hover:bg-accent/20"
                    }`}
                  >
                    {lvl}★
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setOffset((prev) => prev + 1)}
                className="btn-secondary"
              >
                换一首未学名篇 ↻
              </button>
              <Link
                href="/games/feihua/"
                className="btn-primary text-center flex items-center justify-center"
              >
                去「飞花令」练习
              </Link>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center">
            <p className="text-lg font-bold text-ink mb-2">太厉害了！</p>
            <p className="text-sm text-text-muted">题库中所有精选知名名篇均已学习！</p>
          </div>
        )}
      </div>
    </div>
  );
}
