"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadStore, advanceDailyRank } from "@/lib/user";
import { getDailyPoem } from "@/lib/poems";
import { PoemCard } from "@/components/ui/PoemCard";

export default function DailyPage() {
  const [poem, setPoem] = useState<ReturnType<typeof getDailyPoem> | null>(null);
  const [rank, setRank] = useState(0);

  useEffect(() => {
    const store = loadStore();
    const newRank = advanceDailyRank(store);
    setRank(newRank);
    setPoem(getDailyPoem(newRank));
  }, []);

  if (!poem) return null;

  return (
    <div className="min-h-screen paper-texture px-6 py-8">
      <div className="mx-auto max-w-md space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/" className="text-2xl text-text-muted hover:text-accent transition">←</Link>
          <h1 className="text-xl font-bold text-ink">每日推荐</h1>
        </header>

        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="mb-1 text-xs uppercase tracking-widest text-text-muted">今日 · 第 {rank} 首</p>
          <h2 className="text-2xl font-bold text-ink">《{poem.title}》</h2>
          <p className="mt-1 text-sm text-text-muted">{poem.author} · {poem.dynasty}</p>
        </div>

        <PoemCard poem={poem} />

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
