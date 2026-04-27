"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadStore, advanceDailyRank } from "@/lib/user";
import { getDailyEntry } from "@/lib/poems";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";
import { searchOnline } from "@/lib/onlineSearch";

export default function DailyPage() {
  const [rank, setRank] = useState(0);
  const [entry, setEntry] = useState<ReturnType<typeof getDailyEntry> | null>(null);
  const [poemResult, setPoemResult] = useState<Awaited<ReturnType<typeof searchOnline>>[0] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const store = loadStore();
    const newRank = advanceDailyRank(store);
    setRank(newRank);
    const entry = getDailyEntry(newRank);
    setEntry(entry);

    // 在线获取完整诗词
    searchOnline(entry.t, 3).then((hits) => {
      const hit = hits.find((h) => h.poem.name === entry.t) ?? hits[0];
      if (hit) setPoemResult(hit);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen paper-texture flex items-center justify-center">
        <p className="text-text-muted animate-pulse">在线加载中…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen paper-texture px-6 py-8">
      <div className="mx-auto max-w-md space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/" className="text-2xl text-text-muted hover:text-accent transition">←</Link>
          <h1 className="text-xl font-bold text-ink">每日推荐</h1>
        </header>

        {entry && (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="mb-1 text-xs uppercase tracking-widest text-text-muted">今日 · 第 {rank} 首</p>
            <h2 className="text-2xl font-bold text-ink">《{entry.t}》</h2>
            <p className="mt-1 text-sm text-text-muted">{entry.a} · {entry.d}</p>
          </div>
        )}

        {poemResult && <OnlinePoemCard result={poemResult.poem} />}

        <Link
          href="/games/feihua/"
          className="block w-full rounded-2xl bg-accent py-4 text-center font-semibold text-white hover:bg-red-700 transition"
        >
          用「飞花令」开始学习
        </Link>
      </div>
    </div>
  );
}
