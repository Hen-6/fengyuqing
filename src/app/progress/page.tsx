"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadStore } from "@/lib/user";
import { getRankList } from "@/lib/poems";
import { PoemProgress } from "@/lib/srs";
import { LEVEL_LABELS } from "@/lib/srs";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";
import { getPoemByKeyExport as getPoemByKey } from "@/lib/localSearch";

const OBJECTID_RE = /^[0-9a-f]{24}$/i;

export default function ProgressPage() {
  const [store, setStore] = useState<ReturnType<typeof loadStore> | null>(null);
  const [rankMap, setRankMap] = useState<Map<string, { t: string; a: string; d: string }>>(new Map());

  useEffect(() => {
    setStore(loadStore());
    const list = getRankList();
    const map = new Map<string, { t: string; a: string; d: string }>();
    for (const p of list) {
      map.set(`${p.t}:${p.a}`, { t: p.t, a: p.a, d: p.d });
    }
    setRankMap(map);
  }, []);

  if (!store) return null;

  // 从 store.poems 提取已记录的诗，跳过旧 ObjectId key
  const practiced = Object.values(store.poems).filter(
    (p) => !OBJECTID_RE.test(p.poemId)
  );

  type PoemEntry = { key: string; title: string; author: string; dynasty: string; p: PoemProgress };
  const byLevel: Record<string, PoemEntry[]> = {
    "1": [], "2": [], "3": [], "4": [], "5": [],
  };

  for (const prog of practiced) {
    const info = rankMap.get(prog.poemId) ?? { t: prog.poemId.split(":")[0] || prog.poemId, a: "", d: "" };
    const lvl = String(prog.level) as "1" | "2" | "3" | "4" | "5";
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push({
      key: prog.poemId,
      title: info.t,
      author: info.a,
      dynasty: info.d,
      p: prog,
    });
  }

  for (const lvl of Object.keys(byLevel)) {
    byLevel[lvl].sort((a, b) => a.title.localeCompare(b.title));
  }

  const oldEntryCount = Object.values(store.poems).filter(
    (p) => OBJECTID_RE.test(p.poemId)
  ).length;

  return (
    <div className="min-h-screen paper-texture px-6 py-8">
      <div className="mx-auto max-w-md space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/" className="text-2xl text-text-muted hover:text-accent transition">←</Link>
          <h1 className="text-xl font-bold text-ink">学习详情</h1>
        </header>

        {oldEntryCount > 0 && (
          <div className="rounded-xl border border-yellow-400/40 bg-yellow-50 p-4 text-sm text-yellow-800">
            <p>有 <strong>{oldEntryCount}</strong> 条旧版数据因格式变更无法迁移，已忽略。</p>
            <p className="mt-1 text-xs text-yellow-600">
              可在「设置」中重置进度以清除旧数据。
            </p>
          </div>
        )}

        {practiced.length === 0 && (
          <p className="text-center text-text-muted py-8">
            还没有学习记录，从飞花令开始吧！
          </p>
        )}

        {Object.entries(byLevel).map(([lvl, items]) => {
          if (items.length === 0) return null;
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
                {items.map((item) => (
                  <PoemEntryRow key={item.key} item={item} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PoemEntryRow({ item }: { item: { key: string; title: string; author: string; dynasty: string } }) {
  const [showCard, setShowCard] = useState(false);
  const [poemData, setPoemData] = useState<Awaited<ReturnType<typeof getPoemByKey>>>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (showCard) { setShowCard(false); return; }
    setLoading(true);
    setShowCard(true);
    const result = await getPoemByKey(item.key);
    setPoemData(result);
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-2.5 text-left hover:border-accent transition"
      >
        <div>
          <span className="font-medium text-ink">{item.title}</span>
          <span className="ml-2 text-xs text-text-muted">{item.author}</span>
        </div>
        <span className="text-xs text-text-muted">{item.dynasty}</span>
      </button>

      {showCard && (
        <div className="rounded-xl border border-border bg-surface p-4">
          {loading && <p className="text-center text-text-muted text-sm animate-pulse">加载中…</p>}
          {poemData && <OnlinePoemCard result={poemData.poem} />}
          {!loading && !poemData && (
            <p className="text-center text-text-muted text-sm">未找到诗词内容</p>
          )}
        </div>
      )}
    </>
  );
}
