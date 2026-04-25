"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadStore } from "@/lib/user";
import { getAllPoems, getPoemById } from "@/lib/poems";
import { PoemProgress } from "@/lib/srs";
import { LEVEL_LABELS } from "@/lib/srs";

export default function ProgressPage() {
  const [store, setStore] = useState<ReturnType<typeof loadStore> | null>(null);

  useEffect(() => {
    setStore(loadStore());
  }, []);

  if (!store) return null;

  const poems = getAllPoems();
  type PoemEntry = { poem: ReturnType<typeof getAllPoems>[number]; p: PoemProgress };
  const byLevel: Record<string, PoemEntry[]> = {
    "1": [], "2": [], "3": [], "4": [], "5": [],
  };

  for (const poem of poems) {
    const p: PoemProgress = store.poems[poem.id] ?? {
      poemId: poem.id,
      level: 1,
      halfLifeDays: 1,
      nextReview: "",
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      lastResult: null,
      lastReviewed: "",
    };
    const lvl = String(p.level) as "1" | "2" | "3" | "4" | "5";
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push({ poem, p });
  }

  return (
    <div className="min-h-screen paper-texture px-6 py-8">
      <div className="mx-auto max-w-md space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/" className="text-2xl text-text-muted hover:text-accent transition">←</Link>
          <h1 className="text-xl font-bold text-ink">学习详情</h1>
        </header>

        {Object.entries(byLevel).map(([lvl, items]) => {
          const { name, desc } = LEVEL_LABELS[Number(lvl) as keyof typeof LEVEL_LABELS];
          return (
            <section key={lvl}>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                  {lvl}
                </span>
                <h2 className="font-semibold text-ink">{name}</h2>
                <span className="text-xs text-text-muted">— {desc}</span>
                <span className="ml-auto text-xs text-text-muted">{items.length}首</span>
              </div>
              <div className="space-y-1">
                {items.map(({ poem }) => (
                  <div
                    key={poem.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-2.5"
                  >
                    <div>
                      <span className="font-medium text-ink">{poem.title}</span>
                      <span className="ml-2 text-xs text-text-muted">{poem.author}</span>
                    </div>
                    <span className="text-xs text-text-muted">{poem.type}</span>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="py-2 text-center text-xs text-text-muted">暂无</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
